import chalk from 'chalk';
import { Temperature } from '..';
import { Database } from '../../lib/db';
import { logTag } from '../../lib/logger';
import { SettablePromise } from '../../lib/util';
import { LOG_INTERVAL_SECS } from './constants';
import { Mode } from './types';

class TempControl {
	private _listeners: ((temperature: number) => void)[] = [];

	target = 20.0;
	mode: Mode = 'auto';
	lastTemp = -1;
	db: Database | null = null;
	lastLogTime = 0;
	lastLoggedTemp = -1;
	name!: string;

	move: {
		direction: 'left' | 'right';
		ms: number;
	} | null = null;

	setTarget(targetTemp: number) {
		this.db!.setVal(`${this.name}.target`, targetTemp);
		this.target = targetTemp;
	}

	async setMode(newMode: Mode) {
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

	setMove(direction: 'left' | 'right', ms: number) {
		this.move = {
			direction,
			ms,
		};
	}

	setLastTemp(temp: number, store = true, doLog = true) {
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

		this._listeners.forEach((listener) => listener(temp));
	}

	getTarget() {
		return this.target;
	}

	getMode() {
		return this.mode;
	}

	getLastTemp() {
		return this.lastTemp;
	}

	getHeaterState() {
		if (this.mode !== 'auto') {
			return this.mode;
		}
		if (this.lastTemp > this.target) {
			return 'off';
		}
		return 'on';
	}

	getMove() {
		const move = this.move;
		this.move = null;
		return move;
	}

	addListener(listener: (temperature: number) => void) {
		this._listeners.push(listener);
	}

	async init(database: Database, name: string) {
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
