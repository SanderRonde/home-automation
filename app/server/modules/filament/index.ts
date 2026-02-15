import type { FilamentSpoolStored } from '../../../../types/filament';
import type { AMSSlotAssignment } from '../../../../types/filament';
import { SettablePromise } from '../../lib/settable-promise';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { FilamentAPI } from './api';

export interface FilamentDB {
	spools?: Record<string, FilamentSpoolStored>;
	assignments?: Record<string, AMSSlotAssignment>;
}

export const Filament = new (class Filament extends ModuleMeta {
	public name = 'filament';
	public api = new SettablePromise<FilamentAPI>();

	public async init(config: ModuleConfig): Promise<{ serve: ServeOptions<unknown> }> {
		const tableExists = await config.sqlDB<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='filament_history'
		`;
		if (!tableExists.length) {
			await config.sqlDB`
				CREATE TABLE filament_history (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					timestamp INTEGER NOT NULL,
					device_id TEXT NOT NULL,
					slot_index INTEGER NOT NULL,
					action TEXT NOT NULL,
					filament_id TEXT,
					old_percentage REAL,
					new_percentage REAL
				)
			`;
			await config.sqlDB`
				CREATE INDEX idx_filament_history_device ON filament_history(device_id, timestamp DESC)
			`;
			await config.sqlDB`
				CREATE INDEX idx_filament_history_filament ON filament_history(filament_id, timestamp DESC)
			`;
		}

		const api = new FilamentAPI(config.db as Database<FilamentDB>, config.sqlDB);
		this.api.set(api);

		return {
			serve: initRouting(api, config),
		};
	}
})();
