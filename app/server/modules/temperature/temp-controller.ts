import { logTag } from '../../lib/logging/logger';
import { LOG_INTERVAL_SECS } from './constants';
import type { ModuleConfig } from '..';
import type { Temperature } from '..';
import chalk from 'chalk';

class TempControl {
	private _listeners: ((temperature: number) => void | Promise<void>)[] = [];

	public lastTemp = -1;
	public lastLogTime = 0;
	public lastLoggedTemp = -1;

	public constructor(
		public readonly db: ModuleConfig<typeof Temperature>['sqlDB'],
		public readonly name: string
	) {}

	public async setLastTemp(temp: number, store = true, doLog = true) {
		this.lastTemp = temp;

		// Write temp to database
		if (store) {
			await this.db.temperatures.insert({
				time: Date.now(),
				location: this.name,
				temperature: temp,
			});
		}

		if (
			doLog &&
			Math.round(this.lastLoggedTemp) !== Math.round(temp) &&
			Date.now() - this.lastLogTime > LOG_INTERVAL_SECS * 1000
		) {
			logTag(
				'temp',
				'cyan',
				chalk.bold(`Current ${this.name} temperature: ${temp}°`)
			);
			this.lastLogTime = Date.now();
		}

		void Promise.all(this._listeners.map((listener) => listener(temp)));
	}

	public getLastTemp() {
		return this.lastTemp;
	}

	public addListener(
		listener: (temperature: number) => void | Promise<void>
	) {
		this._listeners.push(listener);
	}

	public async init() {
		const temp =
			(
				await this.db.temperatures.querySingle(
					{ location: this.name },
					'last'
				)
			)?.temperature ?? 20.0;

		await this.setLastTemp(temp, false, false);

		return this;
	}
}

const controllers: Map<string, TempControl> = new Map();

export async function getController(
	db: ModuleConfig<typeof Temperature>['sqlDB'],
	name = 'default'
): Promise<TempControl> {
	if (!controllers.has(name)) {
		controllers.set(name, await new TempControl(db, name).init());
	}

	return controllers.get(name)!;
}

export function getAll(): TempControl[] {
	return Array.from(controllers.values());
}
