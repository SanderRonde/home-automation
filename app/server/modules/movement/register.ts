import { SettablePromise } from '../../lib/settable-promise';
import movementConfig from '../../config/movements';
import { LogObj } from '../../lib/logging/lob-obj';
import type { Database } from '../../lib/db';
import { Movement } from '.';

let enabled: boolean | null = null;
const db = new SettablePromise<Database>();

export function initRegister(_db: Database): void {
	enabled = _db.get('enabled', true);
	db.set(_db);
}

export async function enable(): Promise<void> {
	enabled = true;
	(await db.value).setVal('enabled', enabled);
	const modules = await Movement.modules;
	await modules.keyval.set(
		LogObj.fromEvent('MOVEMENT.ON'),
		'state.movement',
		'1',
		false
	);
}

export async function disable(): Promise<void> {
	enabled = false;
	(await db.value).setVal('enabled', enabled);
	const modules = await Movement.modules;
	await modules.keyval.set(
		LogObj.fromEvent('MOVEMENT.OFF'),
		'state.movement',
		'0',
		false
	);
}

async function handleChange(key: string, logObj: LogObj) {
	if (!enabled || !(key in movementConfig)) {
		return;
	}

	const handlers = movementConfig[key];
	for (const handler of handlers) {
		await handler(
			await Movement.modules,
			logObj.attachMessage('Movement hook')
		);
	}
}

export async function reportMovement(
	key: string,
	logObj: LogObj
): Promise<void> {
	await handleChange(key, logObj);
}
