export interface BackupConfig {
	backupPath: string; // Default: database/backups/
	intervalDays: number; // 0 = disabled, 7 = weekly
	retentionDays: number; // Delete backups older than this
}

export interface BackupMetadata {
	id: string; // UUID or timestamp-based
	timestamp: number;
	description: string;
	filePath: string;
	deviceCount: number;
	moduleCount: number;
	modules: string[]; // List of module names included
}

export interface BackupFileMetadata extends BackupMetadata {
	size: number;
}

export interface BackupDB {
	backups: BackupMetadata[];
	config: BackupConfig;
	lastBackupTimestamp?: number;
}

export interface RestoreSelection {
	modules: string[]; // Module names to restore
	restoreMatter: boolean;
}
