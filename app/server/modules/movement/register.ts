import { SettablePromise, createHookables } from '../../lib/util';
import { LogObj, attachMessage } from '../../lib/logger';
import movementConfig from '../../config/movements';
import { Database } from '../../lib/db';
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
	await new modules.keyval.External({}, 'MOVEMENT.ON').set(
		'state.movement',
		'1',
		false
	);
}

export async function disable(): Promise<void> {
	enabled = false;
	(await db.value).setVal('enabled', enabled);
	const modules = await Movement.modules;
	await new modules.keyval.External({}, 'MOVEMENT.OFF').set(
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
			createHookables(
				await Movement.modules,
				'MOVEMENT',
				key,
				attachMessage(logObj, 'Movement hook')
			)
		);
	}
}

export async function reportMovement(
	key: string,
	logObj: LogObj
): Promise<void> {
	await handleChange(key, logObj);
}
