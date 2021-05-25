import {
	MIN_PRESSURE,
	MAX_PRESSURE,
	DEFAULT_MIN_TIME,
	MAX_PRESSURE_TIME,
	PRESSURE_SAMPLE_TIME,
} from '../../lib/constants';
import { Database } from '../../lib/db';
import { LogObj, attachMessage } from '../../lib/logger';
import { SettablePromise, createHookables } from '../../lib/util';
import pressureConfig from '../../config/pressures';
import { Pressure } from '.';
import {
	PRESSURE_REGISTER,
	PRESSURE_CHANGE_DIRECTION,
	PressureRange,
} from './types';

let enabled: boolean | null = null;
const db = new SettablePromise<Database>();

export async function enable(): Promise<void> {
	enabled = true;
	(await db.value).setVal('enabled', enabled);
	await new (
		await Pressure.modules
	).keyval.External.Handler({}, 'PRESSURE.ON').set(
		'state.pressure',
		'1',
		false
	);
}

export function isEnabled(): boolean {
	return enabled || false;
}

export async function disable(): Promise<void> {
	enabled = false;
	(await db.value).setVal('enabled', enabled);
	await new (
		await Pressure.modules
	).keyval.External.Handler({}, 'PRESSURE.OFF').set(
		'state.pressure',
		'0',
		false
	);
}

export function initRegister(_db: Database): void {
	db.set(_db);
	enabled = _db.get('enabled', true);
}

async function handleChange(key: string, logObj: LogObj) {
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

			const currentRange = currentRanges.get(key);
			if (currentRange === range) {
				continue;
			}

			if (
				lastPressures
					.get(key)!
					.slice(-(minTime / PRESSURE_SAMPLE_TIME))
					.every((value) => {
						return value >= from && value <= to;
					})
			) {
				const doUpdate: boolean = currentRanges.has(key);
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
					currentRanges.set(key, range);
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
			const [initial, ...rest] = lastPressures
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

const currentRanges: Map<string, PressureRange> = new Map();
const lastPressures: Map<string, number[]> = new Map();
const pressures: Map<string, number> = new Map();
export async function setPressure(
	key: string,
	value: number,
	logObj: LogObj
): Promise<void> {
	if (!lastPressures.get(key)) {
		lastPressures.set(key, []);
	}
	const lastPressureArr = lastPressures.get(key)!;
	lastPressureArr.push(value);
	if (lastPressureArr.length > MAX_PRESSURE_TIME / PRESSURE_SAMPLE_TIME) {
		lastPressureArr.shift();
	}

	pressures.set(key, value);
	if (enabled) {
		await handleChange(key, logObj);
	}
}

export function getPressure(key: string): number | null {
	return pressures.get(key) || null;
}

export function getAll(): Map<string, number> {
	return pressures;
}
