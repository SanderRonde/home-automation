import {
	DEFAULT_MIN_TIME,
	MAX_PRESSURE,
	MAX_PRESSURE_TIME,
	MIN_PRESSURE,
	PRESSURE_SAMPLE_TIME,
} from '@server/lib/constants';
import {
	PRESSURE_REGISTER,
	PRESSURE_CHANGE_DIRECTION,
	PressureRange,
} from '@server/modules/pressure/types';
import { LogObj, attachMessage } from '@server/lib/logger';
import pressureConfig from '@server/config/pressures';
import { createHookables } from '@server/lib/util';
import { PressureStateKeeper } from '@server/modules/pressure/enabled';
import { Pressure } from '..';

export class PressureValueKeeper {
	private readonly _lastPressures: Map<string, number[]> = new Map();
	private readonly _pressures: Map<string, number> = new Map();
	private readonly _currentRanges: Map<string, PressureRange> = new Map();

	public constructor(private readonly _stateKeeper: PressureStateKeeper) {}

	public async setPressure(
		key: string,
		value: number,
		logObj: LogObj
	): Promise<void> {
		if (!this._lastPressures.get(key)) {
			this._lastPressures.set(key, []);
		}
		const lastPressureArr = this._lastPressures.get(key)!;
		lastPressureArr.push(value);
		if (lastPressureArr.length > MAX_PRESSURE_TIME / PRESSURE_SAMPLE_TIME) {
			lastPressureArr.shift();
		}

		this._pressures.set(key, value);
		if (this._stateKeeper.isEnabled()) {
			await this._handleChange(key, logObj);
		}
	}

	public getPressure(key: string): number | null {
		return this._pressures.get(key) || null;
	}

	public getAll(): Map<string, number> {
		return this._pressures;
	}

	private async _handleChange(key: string, logObj: LogObj) {
		if (!(key in pressureConfig)) {
			return;
		}

		const ranges = pressureConfig[key];
		for (const range of ranges) {
			if (range.type === 'range') {
				const {
					from = MIN_PRESSURE,
					to = MAX_PRESSURE,
					minTime = DEFAULT_MIN_TIME,
					handler,
				} = range;
				if (minTime >= MAX_PRESSURE_TIME) {
					throw new Error('MinTime too big');
				}

				const currentRange = this._currentRanges.get(key);
				if (currentRange === range) {
					continue;
				}

				if (
					this._lastPressures
						.get(key)!
						.slice(-(minTime / PRESSURE_SAMPLE_TIME))
						.every((value) => {
							return value >= from && value <= to;
						})
				) {
					const doUpdate: boolean = this._currentRanges.has(key);
					if (
						!doUpdate ||
						(await handler(
							createHookables(
								await Pressure.modules,
								'PRESSURE',
								key,
								attachMessage(logObj, 'Pressure hooks range')
							)
						)) === PRESSURE_REGISTER.REGISTER_CHANGED
					) {
						this._currentRanges.set(key, range);
					}
				}
			} else {
				const {
					amount,
					direction,
					handler,
					minTime = DEFAULT_MIN_TIME,
				} = range;

				const samples = minTime / PRESSURE_SAMPLE_TIME;
				const [initial, ...rest] = this._lastPressures
					.get(key)!
					.slice(-samples)
					.map((v) => ~~v);
				if (rest.length < samples - 1) {
					continue;
				}
				if (
					rest.every((value) => {
						if (direction === PRESSURE_CHANGE_DIRECTION.UP) {
							return value >= initial + amount;
						} else {
							return value <= initial - amount;
						}
					})
				) {
					await handler(
						createHookables(
							await Pressure.modules,
							'PRESSURE',
							key,
							attachMessage(logObj, 'Pressure hooks jump')
						)
					);
				}
			}
		}
	}
}
