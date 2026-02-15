import type {
	SystemDB,
	SystemConfigResponse,
	CommandExecutionResponse,
	LogTailResponse,
} from './types';
import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import { logTag } from '../../lib/logging/logger';
import type { Database } from '../../lib/db';
import { stat } from 'node:fs/promises';
import type { ModuleConfig } from '..';
import { watch } from 'node:fs';
import { $ } from 'bun';

function _initRouting(config: ModuleConfig) {
	const db = config.db as Database<SystemDB>;
	let logWatcher: ReturnType<typeof watch> | null = null;
	let lastLogPosition = 0;
	let currentLogPath: string | null = null;
	let recentLines: string[] = [];
	let tailSendInterval: ReturnType<typeof setInterval> | null = null;

	/**
	 * Start watching the log file and publish new lines via WebSocket.
	 */
	function startLogWatcher(logFilePath: string): void {
		// Stop existing watcher if any
		if (logWatcher) {
			logWatcher.close();
			logWatcher = null;
			lastLogPosition = 0;
		}

		const resolved = logFilePath.startsWith('/')
			? logFilePath
			: `${process.cwd()}/${logFilePath}`;

		if (resolved.includes('..')) {
			logTag('SYSTEM', 'red', 'Invalid log file path:', logFilePath);
			return;
		}

		currentLogPath = resolved;

		// Initialize: read current file size
		void (async () => {
			try {
				const { size } = await stat(resolved);
				lastLogPosition = size;
				// Send initial tail (last 100 lines)
				const file = Bun.file(resolved);
				const chunkSize = 512 * 1024;
				const start = Math.max(0, size - chunkSize);
				const chunk = file.slice(start);
				const text = await chunk.text();
				const allLines = text.split('\n');
				const lines = start > 0 ? allLines.slice(1) : allLines;
				const tailLines = lines.slice(-100);
				recentLines = tailLines;
				if (tailLines.length > 0) {
					void config.wsPublish(
						JSON.stringify({
							type: 'log_lines',
							lines: tailLines,
						})
					);
				}
				// Send tail periodically so new clients get it
				if (tailSendInterval) {
					clearInterval(tailSendInterval);
				}
				tailSendInterval = setInterval(() => {
					if (recentLines.length > 0) {
						void config.wsPublish(
							JSON.stringify({
								type: 'log_lines',
								lines: recentLines,
							})
						);
					}
				}, 10000); // Every 10 seconds
			} catch (err) {
				logTag('SYSTEM', 'red', 'Failed to initialize log watcher:', err);
			}
		})();

		// Watch for changes
		logWatcher = watch(resolved, async (eventType) => {
			if (eventType !== 'change') {
				return;
			}

			try {
				const { size } = await stat(resolved);
				if (size <= lastLogPosition) {
					// File might have been truncated or rotated
					lastLogPosition = size;
					return;
				}

				const file = Bun.file(resolved);
				const chunk = file.slice(lastLogPosition);
				const text = await chunk.text();
				const newLines = text.split('\n').filter((line) => line.length > 0);

				if (newLines.length > 0) {
					// Update recent lines (keep last 100)
					recentLines = [...recentLines, ...newLines].slice(-100);
					void config.wsPublish(
						JSON.stringify({
							type: 'log_lines',
							lines: newLines,
						})
					);
				}

				lastLogPosition = size;
			} catch (err) {
				logTag('SYSTEM', 'red', 'Log watcher error:', err);
			}
		});

		logWatcher.on('error', (err) => {
			logTag('SYSTEM', 'red', 'Log watcher error:', err);
		});

		logTag('SYSTEM', 'green', `Started watching log file: ${resolved}`);
	}

	/**
	 * Stop watching the log file.
	 */
	function stopLogWatcher(): void {
		if (logWatcher) {
			logWatcher.close();
			logWatcher = null;
			lastLogPosition = 0;
			currentLogPath = null;
			recentLines = [];
			if (tailSendInterval) {
				clearInterval(tailSendInterval);
				tailSendInterval = null;
			}
			logTag('SYSTEM', 'yellow', 'Stopped log watcher');
		}
	}

	// Watch for logFilePath changes in database
	const initialData = db.current();
	if (initialData.logFilePath) {
		startLogWatcher(initialData.logFilePath);
	}

	// Subscribe to database changes to restart watcher if logFilePath changes
	db.subscribe((data) => {
		if (!data) {
			return;
		}
		const newPath = data.logFilePath?.trim() || null;
		if (newPath !== currentLogPath) {
			if (newPath) {
				startLogWatcher(newPath);
			} else {
				stopLogWatcher();
			}
		}
	});

	/**
	 * Execute a shell command and return the result.
	 */
	async function executeCommand(
		command: string,
		commandName: string
	): Promise<CommandExecutionResponse> {
		logTag('SYSTEM', 'yellow', `Executing ${commandName}: ${command}`);

		try {
			// Use Bun shell for command execution
			const result = await $`sh -c ${command}`.quiet();
			const output = result.text();

			logTag('SYSTEM', 'green', `${commandName} completed successfully`);

			return {
				success: true,
				message: `${commandName} executed successfully`,
				output: output.trim() || undefined,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logTag('SYSTEM', 'red', `${commandName} failed: ${errorMessage}`);

			// For stop/restart/kill-chromium commands, the process might exit before returning
			// This is expected behavior, so we still return success
			if (
				commandName === 'Stop server' ||
				commandName === 'Restart server' ||
				commandName === 'Kill chromium'
			) {
				return {
					success: true,
					message: `${commandName} initiated (connection may be lost)`,
				};
			}

			return {
				success: false,
				message: `${commandName} failed: ${errorMessage}`,
			};
		}
	}

	return createServeOptions(
		{
			/**
			 * Get the current system configuration (read-only).
			 * Shows which commands are configured.
			 */
			'/config': (_req, _server, { json }) => {
				const data = db.current();
				const commands = data.commands || {};

				const response: SystemConfigResponse = {
					commands: {
						restartServer: commands.restartServer || null,
						stopServer: commands.stopServer || null,
						killChromium: commands.killChromium || null,
					},
					logFilePath: data.logFilePath || null,
				};

				return json(response);
			},

			/**
			 * Get the last N lines of the configured log file (tail).
			 * Query params: lines (default 100, max 1000).
			 */
			'/logs/tail': {
				GET: async (req, _server, { json }) => {
					const data = db.current();
					const logFilePath = data.logFilePath?.trim();

					if (!logFilePath) {
						return json({
							success: false,
							logFilePath: null,
							lines: [],
							error: 'Log file path not configured. Edit database/system.json and set logFilePath.',
						} satisfies LogTailResponse);
					}

					// Reject path traversal and require absolute path
					const resolved = logFilePath.startsWith('/')
						? logFilePath
						: `${process.cwd()}/${logFilePath}`;
					if (resolved.includes('..')) {
						return json({
							success: false,
							logFilePath,
							lines: [],
							error: 'Invalid log file path',
						} satisfies LogTailResponse);
					}

					const url = new URL(req.url);
					const linesParam = url.searchParams.get('lines');
					let limit = 100;
					if (linesParam !== null) {
						const parsed = parseInt(linesParam, 10);
						if (!Number.isNaN(parsed) && parsed > 0) {
							limit = Math.min(parsed, 1000);
						}
					}

					try {
						const file = Bun.file(resolved);
						const exists = await file.exists();
						if (!exists) {
							return json({
								success: false,
								logFilePath,
								lines: [],
								error: `Log file not found: ${resolved}`,
							} satisfies LogTailResponse);
						}

						const { size } = await stat(resolved);
						const chunkSize = 512 * 1024; // 512 KB
						const start = Math.max(0, size - chunkSize);
						const chunk = file.slice(start);
						const text = await chunk.text();
						const allLines = text.split('\n');
						// If we read from middle of file, first line may be partial; drop it
						const lines = start > 0 ? allLines.slice(1) : allLines;
						const tailLines = lines.slice(-limit);

						return json({
							success: true,
							logFilePath,
							lines: tailLines,
						} satisfies LogTailResponse);
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						logTag('SYSTEM', 'red', 'Log tail failed:', message);
						return json({
							success: false,
							logFilePath,
							lines: [],
							error: message,
						} satisfies LogTailResponse);
					}
				},
			},

			/**
			 * Restart the server.
			 */
			'/restart': {
				POST: async (_req, _server, { json, error }) => {
					const data = db.current();
					const command = data.commands?.restartServer;

					if (!command) {
						return error(
							{
								success: false,
								message:
									'Restart command not configured. Please configure it in the system.json database file.',
							},
							400
						);
					}

					const result = await executeCommand(command, 'Restart server');
					if (result.success) {
						return json(result);
					}
					return error(result, 500);
				},
			},

			/**
			 * Stop the server.
			 */
			'/stop': {
				POST: async (_req, _server, { json, error }) => {
					const data = db.current();
					const command = data.commands?.stopServer;

					if (!command) {
						return error(
							{
								success: false,
								message:
									'Stop command not configured. Please configure it in the system.json database file.',
							},
							400
						);
					}

					const result = await executeCommand(command, 'Stop server');
					if (result.success) {
						return json(result);
					}
					return error(result, 500);
				},
			},

			/**
			 * Kill chromium processes (for kiosk mode screen management).
			 * If commands.killChromium is set in the database, runs that command (e.g. sudo script).
			 * Otherwise runs pgrep/killall in-process (current user only).
			 */
			'/kill-chromium': {
				POST: async (_req, _server, { json }) => {
					const data = db.current();
					const command = data.commands?.killChromium?.trim();

					if (command) {
						const result = await executeCommand(command, 'Kill chromium');
						return json(result);
					}

					// Fallback: in-process kill (current user only)
					logTag('SYSTEM', 'yellow', 'Starting chromium cleanup (in-process)...');
					try {
						const checkResult = await $`pgrep -x chromium`.quiet().nothrow();
						const isRunning = checkResult.exitCode === 0;

						if (isRunning) {
							logTag('SYSTEM', 'yellow', 'Chromium processes found, killing...');
							await $`killall chromium`.quiet().nothrow();
							logTag('SYSTEM', 'green', 'Chromium processes killed successfully');
							return json({
								success: true,
								message: 'Chromium processes killed successfully',
							});
						}
						logTag('SYSTEM', 'green', 'No chromium processes found');
						return json({
							success: true,
							message: 'No chromium processes found',
						});
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						logTag('SYSTEM', 'red', 'Kill chromium failed:', errorMessage);
						return json({
							success: false,
							message: `Kill chromium failed: ${errorMessage}`,
						});
					}
				},
			},

			/**
			 * Restart the Matter server.
			 */
			'/restart-matter': {
				POST: async (_req, _server, { json }) => {
					// Restart but don't await
					void (await config.modules.matter.server.value).restart();
					return json({
						success: true,
						message: 'Matter server restarted successfully',
					});
				},
			},
		},
		true, // Require authentication
		{
			// WebSocket handler so /system/ws is registered; clients subscribe to 'system' and receive log_lines via wsPublish
			open: (_ws) => {
				// No-op; subscription is done by the server in app.ts
			},
		}
	);
}

export const initRouting = _initRouting as (config: ModuleConfig) => ServeOptions<unknown>;
export type SystemRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
