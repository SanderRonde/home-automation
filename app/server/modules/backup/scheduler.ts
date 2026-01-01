import type { BackupManager } from './backup-manager';
import type { BackupConfig, BackupDB } from './types';
import { logTag } from '../../lib/logging/logger';
import type { Database } from '../../lib/db';

export class BackupScheduler {
	private _intervalId: ReturnType<typeof setInterval> | null = null;
	private readonly _backupManager: BackupManager;
	private _config: BackupConfig | null = null;
	private _db: Database<BackupDB> | null = null;

	public constructor(backupManager: BackupManager, db?: Database<BackupDB>) {
		this._backupManager = backupManager;
		this._db = db || null;
	}

	/**
	 * Start the scheduler with the given configuration
	 */
	public start(config: BackupConfig): void {
		this._config = config;
		this.stop(); // Stop any existing interval

		if (config.intervalDays <= 0) {
			logTag('backup', 'blue', 'Backup scheduler disabled');
			return;
		}

		const intervalMs = config.intervalDays * 24 * 60 * 60 * 1000;
		logTag(
			'backup',
			'blue',
			`Starting backup scheduler (interval: ${config.intervalDays} days)`
		);

		// Check immediately on start
		void this._checkAndBackup();

		// Then check at the configured interval
		this._intervalId = setInterval(() => {
			void this._checkAndBackup();
		}, intervalMs);
	}

	/**
	 * Stop the scheduler
	 */
	public stop(): void {
		if (this._intervalId) {
			clearInterval(this._intervalId);
			this._intervalId = null;
		}
	}

	/**
	 * Update configuration and restart scheduler if needed
	 */
	public updateConfig(config: BackupConfig): void {
		const wasRunning = this._intervalId !== null;
		this.stop();
		this._config = config;
		if (wasRunning || config.intervalDays > 0) {
			this.start(config);
		}
	}

	/**
	 * Check if backup is needed and create one
	 */
	private async _checkAndBackup(): Promise<void> {
		if (!this._config) {
			return;
		}

		try {
			const now = Date.now();
			const lastBackup = this._db?.current()?.lastBackupTimestamp || 0;
			const intervalMs = this._config.intervalDays * 24 * 60 * 60 * 1000;

			if (now - lastBackup >= intervalMs) {
				logTag('backup', 'blue', 'Creating scheduled backup...');
				const description = `Scheduled backup - ${new Date().toISOString()}`;
				await this._backupManager.createBackup(description);

				// Update last backup timestamp in database
				if (this._db) {
					this._db.update((old) => ({
						...old,
						lastBackupTimestamp: now,
					}));
				}

				// Clean up old backups
				if (this._config.retentionDays > 0) {
					await this._backupManager.cleanupOldBackups(this._config.retentionDays);
				}
			}
		} catch (error) {
			logTag('backup', 'red', 'Failed to create scheduled backup:', error);
		}
	}
}
