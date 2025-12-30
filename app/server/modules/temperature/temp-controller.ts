import { logTag } from '../../lib/logging/logger';
import { LOG_INTERVAL_SECS } from './constants';
import type { SQL } from 'bun';
import chalk from 'chalk';

class TempControl {
	private _listeners: ((temperature: number) => void | Promise<void>)[] = [];

	public lastTemp = -1;
	public lastLogTime = 0;
	public lastLoggedTemp = -1;
	public readonly db: SQL;

	public constructor(
		db: SQL,
		public readonly name: string
	) {
		this.db = db;
	}

	private get sql() {
		return this.db;
	}

	public async setLastTemp(
		temp: number,
		store = true,
		doLog = true,
		targetTemperature: number | null = null,
		isHeating: boolean | null = null
	) {
		this.lastTemp = temp;

		// Write temp to database
		if (store) {
			// Try to insert with new columns, fall back to old schema if columns don't exist
			try {
				await this.sql`
					INSERT INTO temperatures (time, location, temperature, target_temperature, is_heating)
					VALUES (${Date.now()}, ${this.name}, ${temp}, ${targetTemperature}, ${isHeating})
				`;
			} catch (error) {
				// If columns don't exist, try without them (for backward compatibility)
				try {
					await this
						.sql`INSERT INTO temperatures (time, location, temperature) VALUES (${Date.now()}, ${this.name}, ${temp})`;
				} catch (fallbackError) {
					console.error(`Failed to log temperature for ${this.name}:`, fallbackError);
				}
			}
		}

		if (
			doLog &&
			Math.round(this.lastLoggedTemp) !== Math.round(temp) &&
			Date.now() - this.lastLogTime > LOG_INTERVAL_SECS * 1000
		) {
			logTag('temp', 'cyan', chalk.bold(`Current ${this.name} temperature: ${temp}°`));
			this.lastLogTime = Date.now();
		}

		void Promise.all(this._listeners.map(async (listener) => await listener(temp)));
	}

	public getLastTemp() {
		return this.lastTemp;
	}

	public addListener(listener: (temperature: number) => void | Promise<void>) {
		this._listeners.push(listener);
	}

	public async init() {
		const tableExists = await this.sql<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='temperatures'
		`;

		if (!tableExists.length) {
			await this.sql`
				CREATE TABLE temperatures (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					time INTEGER NOT NULL,
					location TEXT NOT NULL,
					temperature REAL NOT NULL,
					target_temperature REAL,
					is_heating INTEGER
				)
			`;
		} else {
			// Try to add new columns if they don't exist (migration)
			try {
				await this.sql`
					ALTER TABLE temperatures ADD COLUMN target_temperature REAL
				`;
			} catch {
				// Column already exists, that's fine
			}
			try {
				await this.sql`
					ALTER TABLE temperatures ADD COLUMN is_heating INTEGER
				`;
			} catch {
				// Column already exists, that's fine
			}
		}
		const temp =
			(
				await this.sql<{
					temperature: number;
				}>`SELECT temperature FROM temperatures WHERE location = ${this.name} ORDER BY time DESC LIMIT 1`
			)?.temperature ?? 20.0;

		await this.setLastTemp(temp, false, false);

		return this;
	}
}

const controllers: Map<string, TempControl> = new Map();

export async function getController(db: SQL, name = 'default'): Promise<TempControl> {
	if (!controllers.has(name)) {
		controllers.set(name, await new TempControl(db, name).init());
	}

	return controllers.get(name)!;
}
