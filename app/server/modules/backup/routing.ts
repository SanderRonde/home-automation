import { createServeOptions, staticResponse, withRequestBody } from '../../lib/routes';
import type { BackupDB, BackupConfig } from './types';
import type { ServeOptions } from '../../lib/routes';
import { BackupManager } from './backup-manager';
import { DB_FOLDER } from '../../lib/constants';
import { BackupScheduler } from './scheduler';
import type { Database } from '../../lib/db';
import type { ModuleConfig } from '..';
import * as path from 'path';
import * as z from 'zod';

let backupManager: BackupManager | null = null;
let scheduler: BackupScheduler | null = null;

function _initRouting(config: ModuleConfig) {
	const db = config.db as Database<BackupDB>;
	const defaultBackupPath = path.join(DB_FOLDER, 'backups');

	// Initialize backup manager
	backupManager = new BackupManager(
		db.current().config?.backupPath || defaultBackupPath,
		config.modules
	);

	// Initialize scheduler
	scheduler = new BackupScheduler(backupManager, db);

	// Initialize database with default config if needed
	const currentData = db.current();
	if (!currentData.config) {
		db.update((old) => ({
			...old,
			config: {
				backupPath: defaultBackupPath,
				intervalDays: 7, // Weekly by default
				retentionDays: 30, // Keep backups for 30 days
			},
			backups: [],
		}));
	}

	// Start scheduler if configured
	const dbData = db.current();
	if (dbData.config) {
		scheduler.start(dbData.config);
	}

	return createServeOptions(
		{
			'/list': async (_req, _server, { json }) => {
				if (!backupManager) {
					return json({ backups: [] });
				}
				const backups = await backupManager.listBackups();
				return json({ backups });
			},
			'/create': withRequestBody(
				z.object({
					description: z.string().optional(),
				}),
				async (body, _req, _server, { json, error }) => {
					if (!backupManager) {
						return error('Backup manager not initialized', 500);
					}

					try {
						const description =
							body.description || `Manual backup - ${new Date().toISOString()}`;
						const metadata = await backupManager.createBackup(description);

						// Save metadata to database
						db.update((old) => ({
							...old,
							backups: [metadata, ...(old.backups || [])],
							lastBackupTimestamp: Date.now(),
						}));

						return json({ success: true, backup: metadata });
					} catch (err) {
						return error(
							{
								error: 'Failed to create backup',
								message: err instanceof Error ? err.message : String(err),
							},
							500
						);
					}
				}
			),
			'/restore': withRequestBody(
				z.object({
					backupId: z.string(),
					selection: z.object({
						modules: z.array(z.string()),
						restoreMatter: z.boolean(),
					}),
				}),
				async (body, _req, _server, { json, error }) => {
					if (!backupManager) {
						return error('Backup manager not initialized', 500);
					}

					try {
						await backupManager.restoreBackup(body.backupId, body.selection);
						return json({ success: true });
					} catch (err) {
						return error(
							{
								error: 'Failed to restore backup',
								message: err instanceof Error ? err.message : String(err),
							},
							500
						);
					}
				}
			),
			'/delete/:backupId': async (req, _server, { json, error }) => {
				if (!backupManager) {
					return error('Backup manager not initialized', 500);
				}

				const url = new URL(req.url);
				const backupId = url.pathname.split('/').pop();

				if (!backupId) {
					return error('Backup ID required', 400);
				}

				try {
					await backupManager.deleteBackup(backupId);

					// Remove from database
					db.update((old) => ({
						...old,
						backups: (old.backups || []).filter((b) => b.id !== backupId),
					}));

					return json({ success: true });
				} catch (err) {
					return error(
						{
							error: 'Failed to delete backup',
							message: err instanceof Error ? err.message : String(err),
						},
						500
					);
				}
			},
			'/config': {
				GET: (_req, _server, { json }) => {
					const dbData = db.current();
					return json({ config: dbData.config || null });
				},
				POST: withRequestBody(
					z.object({
						backupPath: z.string().optional(),
						intervalDays: z.number().optional(),
						retentionDays: z.number().optional(),
					}),
					(body, _req, _server, { json, error }) => {
						try {
							const currentConfig = db.current().config || {
								backupPath: defaultBackupPath,
								intervalDays: 7,
								retentionDays: 30,
							};

							const newConfig: BackupConfig = {
								...currentConfig,
								backupPath: body.backupPath ?? currentConfig.backupPath,
								intervalDays: body.intervalDays ?? currentConfig.intervalDays,
								retentionDays: body.retentionDays ?? currentConfig.retentionDays,
							};

							// Update backup manager path if changed
							if (
								newConfig.backupPath !== currentConfig.backupPath &&
								backupManager
							) {
								backupManager = new BackupManager(
									newConfig.backupPath,
									config.modules
								);
								if (scheduler) {
									scheduler = new BackupScheduler(backupManager, db);
									scheduler.start(newConfig);
								}
							}

							// Update scheduler
							if (scheduler) {
								scheduler.updateConfig(newConfig);
							}

							// Save to database
							db.update((old) => ({
								...old,
								config: newConfig,
							}));

							return json({ success: true, config: newConfig });
						} catch (err) {
							return error(
								{
									error: 'Failed to update config',
									message: err instanceof Error ? err.message : String(err),
								},
								500
							);
						}
					}
				),
			},
			'/download/:backupId': async (req, _server, { error }) => {
				if (!backupManager) {
					return error('Backup manager not initialized', 500);
				}

				const url = new URL(req.url);
				const backupId = url.pathname.split('/').pop();

				if (!backupId) {
					return error('Backup ID required', 400);
				}

				try {
					const filePath = backupManager.getBackupPath(backupId);
					const file = Bun.file(filePath);

					if (!(await file.exists())) {
						return error('Backup file not found', 404);
					}

					return staticResponse(
						new Response(file, {
							headers: {
								'Content-Type': 'application/zip',
								'Content-Disposition': `attachment; filename="${backupId}.zip"`,
							},
						})
					);
				} catch (err) {
					return error(
						{
							error: 'Failed to download backup',
							message: err instanceof Error ? err.message : String(err),
						},
						500
					);
				}
			},
		},
		true // Require authentication
	);
}

export const initRouting = _initRouting as (config: unknown) => ServeOptions<unknown>;
export type BackupRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
