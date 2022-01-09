import { SettablePromise } from '../../lib/util';
import { LOG_INTERVAL_SECS } from './constants';
import { logTag } from '../../lib/logger';
import { Database } from '../../lib/db';
import { Temperature } from '..';
import { Mode } from './types';
import chalk from 'chalk';

class TempControl {
	private _listeners: ((temperature: number) => void | Promise<void>)[] = [];

	public target = 20.0;
	public mode: Mode = 'auto';
	public lastTemp = -1;
	public db: Database | null = null;
	public lastLogTime = 0;
	public lastLoggedTemp = -1;
	public name!: string;

	public move: {
		direction: 'left' | 'right';
		ms: number;
	} | null = null;

	public setTarget(targetTemp: number) {
		this.db!.setVal(`${this.name}.target`, targetTemp);
		this.target = targetTemp;
	}

	public async setMode(newMode: Mode) {
		this.db!.setVal(`${this.name}.mode`, newMode);
		this.mode = newMode;

		if (this.name === 'room') {
			const modules = await Temperature.modules;
			if (newMode === 'off') {
				await new modules.keyval.External({}, 'HEATING.off').set(
					'room.heating',
					'0',
					false
				);
			} else {
				await new modules.keyval.External({}, 'HEATING.on').set(
					'room.heating',
					'1',
					false
				);
			}
		}
	}

	public setMove(direction: 'left' | 'right', ms: number) {
		this.move = {
			direction,
			ms,
		};
	}

	public setLastTemp(temp: number, store = true, doLog = true) {
		this.lastTemp = temp;

		// Write temp to database
		if (store) {
			this.db!.setVal(`${this.name}.temp`, temp);
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

	public getTarget() {
		return this.target;
	}

	public getMode() {
		return this.mode;
	}

	public getLastTemp() {
		return this.lastTemp;
	}

	public getHeaterState() {
		if (this.mode !== 'auto') {
			return this.mode;
		}
		if (this.lastTemp > this.target) {
			return 'off';
		}
		return 'on';
	}

	public getMove() {
		const move = this.move;
		this.move = null;
		return move;
	}

	public addListener(
		listener: (temperature: number) => void | Promise<void>
	) {
		this._listeners.push(listener);
	}

	public async init(database: Database, name: string) {
		this.db = database;
		this.name = name;

		const target = database.get(`${name}.target`, 20.0);
		const prevMode = database.get(`${name}.mode`, 'auto');

		this.setTarget(target);
		await this.setMode(prevMode);

		const temp = database.get(`${name}.temp`, 20.0);

		this.setLastTemp(temp, false, false);

		return this;
	}
}

const db = new SettablePromise<Database>();
const controllers: Map<string, TempControl> = new Map();

export async function getController(name = 'default'): Promise<TempControl> {
	if (!controllers.has(name)) {
		controllers.set(
			name,
			await new TempControl().init((await db.value)!, name)
		);
	}

	return controllers.get(name)!;
}

export function initTempController(_db: Database): void {
	db.set(_db);
}

export function getAll(): TempControl[] {
	return Array.from(controllers.values());
}
