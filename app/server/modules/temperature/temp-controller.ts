import { LogObj } from '../../lib/logging/lob-obj';
import { logTag } from '../../lib/logging/logger';
import { LOG_INTERVAL_SECS } from './constants';
import type { ModuleConfig } from '..';
import { getEnv } from '../../lib/io';
import type { Mode } from './types';
import { Temperature } from '..';
import chalk from 'chalk';

class TempControl {
	private _listeners: ((temperature: number) => void | Promise<void>)[] = [];

	public target = 20.0;
	public mode: Mode = 'auto';
	public lastTemp = -1;
	public lastLogTime = 0;
	public lastLoggedTemp = -1;

	public move: {
		direction: 'left' | 'right';
		ms: number;
	} | null = null;

	public constructor(
		public readonly db: ModuleConfig<typeof Temperature>['sqlDB'],
		public readonly name: string
	) {}

	public async setTarget(targetTemp: number) {
		await this.db.targets.set(
			{
				location: this.name,
			},
			{
				target: targetTemp,
			}
		);
		this.target = targetTemp;
	}

	public async setMode(newMode: Mode, logObj: LogObj) {
		await this.db.modes.set(
			{
				location: this.name,
			},
			{
				mode: newMode,
			}
		);
		this.mode = newMode;

		if (getEnv('HEATING_KEY', false)) {
			const modules = await Temperature.modules;
			if (newMode === 'off') {
				await new modules.keyval.External(logObj).set(
					getEnv('HEATING_KEY', true),
					'0',
					false
				);
			} else {
				await new modules.keyval.External(logObj).set(
					getEnv('HEATING_KEY', true),
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

	public async init() {
		const target =
			(await this.db.targets.querySingle({ location: this.name }))
				?.target ?? 20.0;
		const prevMode =
			(await this.db.modes.querySingle({ location: this.name }))?.mode ??
			'auto';

		await this.setTarget(target);
		await this.setMode(prevMode, LogObj.fromEvent('TEMPERATURE.INIT'));

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
