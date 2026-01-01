import type { BackupFileMetadata, BackupMetadata, RestoreSelection } from './types';
import { logTag } from '../../lib/logging/logger';
import { DB_FOLDER } from '../../lib/constants';
import { getAllModules } from '../modules';
import type { AllModules } from '..';
import * as fs from 'fs-extra';
import AdmZip from 'adm-zip';
import * as path from 'path';

export class BackupManager {
	private readonly _backupPath: string;
	private readonly _modules: AllModules;

	public constructor(backupPath: string, modules: AllModules) {
		this._backupPath = backupPath;
		this._modules = modules;
	}

	/**
	 * Create a backup of all module databases and Matter server
	 */
	public async createBackup(description: string): Promise<BackupMetadata> {
		logTag('backup', 'blue', 'Starting backup creation...');

		// Ensure backup directory exists
		await fs.ensureDir(this._backupPath);

		// Create temporary directory for backup files
		const tempDir = path.join(this._backupPath, `temp-${Date.now()}`);
		await fs.ensureDir(tempDir);

		try {
			const modules = getAllModules();
			const moduleNames: string[] = [];
			let deviceCount = 0;

			// Backup all module databases
			for (const [moduleName, moduleMeta] of Object.entries(modules)) {
				const dbName = moduleMeta.dbName;
				moduleNames.push(moduleName);

				// Backup JSON database
				const jsonPath = path.join(DB_FOLDER, `${dbName}.json`);
				if (await fs.pathExists(jsonPath)) {
					await fs.copy(jsonPath, path.join(tempDir, `${dbName}.json`));
				}

				// Backup SQLite database
				const dbPath = path.join(DB_FOLDER, `${dbName}.db`);
				if (await fs.pathExists(dbPath)) {
					await fs.copy(dbPath, path.join(tempDir, `${dbName}.db`));
				}

				// Also check for .sqlite extension
				const sqlitePath = path.join(DB_FOLDER, `${dbName}.sqlite`);
				if (await fs.pathExists(sqlitePath)) {
					await fs.copy(sqlitePath, path.join(tempDir, `${dbName}.sqlite`));
				}

				// Get device count from device module
				if (moduleName === 'device') {
					try {
						const deviceApi = await this._modules.device.api.value;
						const devices = deviceApi.devices.current();
						deviceCount = Object.keys(devices).length;
					} catch {
						// Device module might not be ready
					}
				}
			}

			// Backup Matter server directory
			const matterPath = path.join(DB_FOLDER, 'matter');
			if (await fs.pathExists(matterPath)) {
				const matterBackupPath = path.join(tempDir, 'matter');
				await fs.copy(matterPath, matterBackupPath);
			}

			// Create backup ID and metadata before creating ZIP
			const backupId = `backup-${Date.now()}`;
			const zipPath = path.join(this._backupPath, `${backupId}.zip`);

			// Create metadata
			const metadata: BackupMetadata = {
				id: backupId,
				timestamp: Date.now(),
				description,
				filePath: zipPath,
				deviceCount,
				moduleCount: moduleNames.length,
				modules: moduleNames,
			};

			// Save metadata to temp directory BEFORE creating ZIP (so it's included in the backup)
			await fs.writeJSON(path.join(tempDir, 'metadata.json'), metadata, { spaces: 2 });

			// Create ZIP archive (now includes metadata.json)
			await this._createZipArchive(tempDir, zipPath);

			// Get file size and update metadata
			const stats = await fs.stat(zipPath);

			// Clean up temp directory
			await fs.remove(tempDir);

			logTag(
				'backup',
				'green',
				`Backup created successfully: ${backupId} (${(stats.size / 1024 / 1024).toFixed(2)} MB) - ${description}`
			);
			return metadata;
		} catch (error) {
			// Clean up temp directory on error
			if (await fs.pathExists(tempDir)) {
				await fs.remove(tempDir).catch(() => {
					// Ignore cleanup errors
				});
			}
			logTag('backup', 'red', 'Failed to create backup:', error);
			throw error;
		}
	}

	/**
	 * Create a ZIP archive from a directory
	 */
	private async _createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
		const zip = new AdmZip();

		// Recursively add all files to ZIP
		async function addFilesToZip(dir: string, baseDir: string): Promise<void> {
			const entries = await fs.readdir(dir);
			for (const entry of entries) {
				const fullPath = path.join(dir, entry);
				const relativePath = path.relative(baseDir, fullPath);

				const isDirectory = (await fs.stat(fullPath)).isDirectory();
				if (isDirectory) {
					await addFilesToZip(fullPath, baseDir);
				} else {
					const data = await fs.readFile(fullPath);
					zip.addFile(relativePath, data);
				}
			}
		}

		await addFilesToZip(sourceDir, sourceDir);
		await fs.writeFile(outputPath, zip.toBuffer());
	}

	/**
	 * List all backups
	 */
	public async listBackups(): Promise<BackupFileMetadata[]> {
		if (!(await fs.pathExists(this._backupPath))) {
			return [];
		}

		const files = await fs.readdir(this._backupPath);
		const backups: BackupFileMetadata[] = [];

		for (const file of files) {
			if (!file.endsWith('.zip')) {
				continue;
			}

			const zipPath = path.join(this._backupPath, file);
			const backupId = file.replace('.zip', '');

			try {
				// Try to extract metadata from ZIP
				const metadata = this._extractMetadataFromZip(zipPath);
				const stats = await fs.stat(zipPath);
				if (metadata) {
					backups.push({
						...metadata,
						size: stats.size,
					});
				} else {
					// Create basic metadata from file
					backups.push({
						id: backupId,
						timestamp: stats.mtimeMs,
						description: 'Backup (no metadata)',
						filePath: zipPath,
						size: stats.size,
						deviceCount: 0,
						moduleCount: 0,
						modules: [],
					});
				}
			} catch (error) {
				logTag('backup', 'yellow', `Failed to read backup metadata for ${file}:`, error);
			}
		}

		// Sort by timestamp (newest first)
		return backups.sort((a, b) => b.timestamp - a.timestamp);
	}

	/**
	 * Extract metadata from a backup ZIP file
	 */
	private _extractMetadataFromZip(zipPath: string): BackupMetadata | null {
		try {
			const zip = new AdmZip(zipPath);
			const metadataEntry = zip.getEntry('metadata.json');

			if (metadataEntry) {
				const metadataContent = metadataEntry.getData().toString('utf8');
				return JSON.parse(metadataContent) as BackupMetadata;
			}
		} catch {
			// Metadata not found or invalid
		}

		return null;
	}

	/**
	 * Restore from a backup
	 */
	public async restoreBackup(backupId: string, selection: RestoreSelection): Promise<void> {
		logTag('backup', 'blue', `Starting restore from backup: ${backupId}`);

		const zipPath = path.join(this._backupPath, `${backupId}.zip`);
		if (!(await fs.pathExists(zipPath))) {
			throw new Error(`Backup not found: ${backupId}`);
		}

		// Extract ZIP to temporary directory
		const tempDir = path.join(this._backupPath, `restore-temp-${Date.now()}`);
		await fs.ensureDir(tempDir);

		try {
			const zip = new AdmZip(zipPath);
			zip.extractAllTo(tempDir, true);

			// Restore selected modules
			if (selection.modules.length > 0) {
				const modules = getAllModules();
				for (const moduleName of selection.modules) {
					const moduleMeta = modules[moduleName as keyof typeof modules];
					if (!moduleMeta) {
						continue;
					}

					const dbName = moduleMeta.dbName;

					// Restore JSON database
					const jsonSource = path.join(tempDir, `${dbName}.json`);
					if (await fs.pathExists(jsonSource)) {
						const jsonDest = path.join(DB_FOLDER, `${dbName}.json`);
						await fs.copy(jsonSource, jsonDest);
						logTag('backup', 'green', `Restored ${dbName}.json`);
					}

					// Restore SQLite database
					const dbSource = path.join(tempDir, `${dbName}.db`);
					if (await fs.pathExists(dbSource)) {
						const dbDest = path.join(DB_FOLDER, `${dbName}.db`);
						await fs.copy(dbSource, dbDest);
						logTag('backup', 'green', `Restored ${dbName}.db`);
					}

					// Restore .sqlite database
					const sqliteSource = path.join(tempDir, `${dbName}.sqlite`);
					if (await fs.pathExists(sqliteSource)) {
						const sqliteDest = path.join(DB_FOLDER, `${dbName}.sqlite`);
						await fs.copy(sqliteSource, sqliteDest);
						logTag('backup', 'green', `Restored ${dbName}.sqlite`);
					}
				}
			}

			// Restore Matter server if selected
			if (selection.restoreMatter) {
				const matterSource = path.join(tempDir, 'matter');
				if (await fs.pathExists(matterSource)) {
					const matterDest = path.join(DB_FOLDER, 'matter');
					// Remove existing matter directory
					if (await fs.pathExists(matterDest)) {
						await fs.remove(matterDest);
					}
					await fs.copy(matterSource, matterDest);
					logTag('backup', 'green', 'Restored Matter server database');
				}
			}

			logTag('backup', 'green', 'Restore completed successfully');
		} catch (error) {
			logTag('backup', 'red', 'Failed to restore backup:', error);
			throw error;
		} finally {
			// Clean up temp directory
			if (await fs.pathExists(tempDir)) {
				await fs.remove(tempDir).catch(() => {
					// Ignore cleanup errors
				});
			}
		}
	}

	/**
	 * Delete a backup
	 */
	public async deleteBackup(backupId: string): Promise<void> {
		const zipPath = path.join(this._backupPath, `${backupId}.zip`);
		if (await fs.pathExists(zipPath)) {
			await fs.remove(zipPath);
			logTag('backup', 'green', `Deleted backup: ${backupId}`);
		} else {
			throw new Error(`Backup not found: ${backupId}`);
		}
	}

	/**
	 * Clean up old backups based on retention policy
	 */
	public async cleanupOldBackups(retentionDays: number): Promise<number> {
		if (retentionDays <= 0) {
			return 0;
		}

		const backups = await this.listBackups();
		const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
		let deletedCount = 0;

		for (const backup of backups) {
			if (backup.timestamp < cutoffTime) {
				try {
					await this.deleteBackup(backup.id);
					deletedCount++;
				} catch (error) {
					logTag('backup', 'yellow', `Failed to delete old backup ${backup.id}:`, error);
				}
			}
		}

		if (deletedCount > 0) {
			logTag('backup', 'blue', `Cleaned up ${deletedCount} old backup(s)`);
		}

		return deletedCount;
	}

	/**
	 * Get backup file path for download
	 */
	public getBackupPath(backupId: string): string {
		return path.join(this._backupPath, `${backupId}.zip`);
	}
}
