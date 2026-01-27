import type { SystemDB, SystemConfigResponse, CommandExecutionResponse } from './types';
import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import { logTag } from '../../lib/logging/logger';
import type { Database } from '../../lib/db';
import type { ModuleConfig } from '..';
import { $ } from 'bun';

function _initRouting(config: ModuleConfig) {
	const db = config.db as Database<SystemDB>;

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

			// For stop/restart/reboot commands, the process might exit before returning
			// This is expected behavior, so we still return success
			if (
				commandName === 'Stop server' ||
				commandName === 'Restart server' ||
				commandName === 'Reboot system'
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
						rebootSystem: commands.rebootSystem || null,
						killChromium: commands.killChromium || null,
					},
				};

				return json(response);
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
			 * Reboot the system.
			 */
			'/reboot': {
				POST: async (_req, _server, { json, error }) => {
					const data = db.current();
					const command = data.commands?.rebootSystem;

					if (!command) {
						return error(
							{
								success: false,
								message:
									'Reboot command not configured. Please configure it in the system.json database file.',
							},
							400
						);
					}

					const result = await executeCommand(command, 'Reboot system');
					if (result.success) {
						return json(result);
					}
					return error(result, 500);
				},
			},

			/**
			 * Kill chromium processes (for kiosk mode screen management).
			 */
			'/kill-chromium': {
				POST: async (_req, _server, { json, error }) => {
					const data = db.current();
					const command = data.commands?.killChromium;

					if (!command) {
						return error(
							{
								success: false,
								message:
									'Kill chromium command not configured. Please configure it in the system.json database file.',
							},
							400
						);
					}

					const result = await executeCommand(command, 'Kill chromium');
					if (result.success) {
						return json(result);
					}
					return error(result, 500);
				},
			},
		},
		true // Require authentication
	);
}

export const initRouting = _initRouting as (config: ModuleConfig) => ServeOptions<unknown>;
export type SystemRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
