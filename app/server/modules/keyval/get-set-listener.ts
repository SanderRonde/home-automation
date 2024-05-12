import { attachMessage, LogObj } from '../../lib/logger';
import groups from '../../config/keyval-groups';
import { KEYVAL_GROUP_EFFECT } from './types';
import { ExternalHandler } from './external';
import { Database } from '../../lib/db';

const _listeners: Map<
	number,
	{
		key: string | null;
		listener: (
			value: string,
			key: string,
			logObj: LogObj
		) => void | Promise<void>;
		once: boolean;
	}
> = new Map();
let _lastIndex = 0;

export function addListener(
	key: string | null,
	listener: (
		value: string,
		key: string,
		logObj: LogObj
	) => void | Promise<void>,
	{
		once = false,
		notifyOnInitial = false,
	}: { once?: boolean; notifyOnInitial?: boolean } = {}
): number {
	if (notifyOnInitial && key !== null) {
		const logObj = {};
		void new ExternalHandler(logObj, 'KEYVAL.ADD_LISTENER')
			.get(key)
			.then((value) => {
				return listener(value, key, logObj);
			});
	}
	const index = _lastIndex++;
	_listeners.set(index, {
		key,
		listener,
		once,
	});
	return index;
}

export function removeListener(index: number): void {
	_listeners.delete(index);
}

function triggerGroups(
	key: string,
	value: string,
	logObj: LogObj,
	db: Database
): void {
	if (!(key in groups)) {
		attachMessage(logObj, 'No groups');
		return;
	}

	const group = groups[key];
	for (const key in group) {
		const effect = group[key];

		const newValue = (() => {
			const opposite = value === '1' ? '0' : '1';
			switch (effect) {
				case KEYVAL_GROUP_EFFECT.SAME_ALWAYS:
					return value;
				case KEYVAL_GROUP_EFFECT.INVERT_ALWAYS:
					return opposite;
				case KEYVAL_GROUP_EFFECT.SAME_ON_TRUE:
					return value === '1' ? value : undefined;
				case KEYVAL_GROUP_EFFECT.SAME_ON_FALSE:
					return value === '0' ? value : undefined;
				case KEYVAL_GROUP_EFFECT.INVERT_ON_TRUE:
					return value === '1' ? opposite : undefined;
				case KEYVAL_GROUP_EFFECT.INVERT_ON_FALSE:
					return value === '0' ? opposite : undefined;
			}
		})();

		if (newValue === undefined) {
			continue;
		}

		attachMessage(logObj, `Setting "${key}" to "${newValue}" (db only)`);
		db.setVal(key, newValue);
	}
}

export async function update(
	key: string,
	value: string,
	logObj: LogObj,
	db: Database
): Promise<number> {
	let updated = 0;
	const updatedKeyParts = key.split('.');

	for (const [index, { key: listenerKey, listener, once }] of _listeners) {
		if (listenerKey !== null) {
			const listenerParts = listenerKey.split('.');
			let next = false;
			for (
				let i = 0;
				i < Math.min(updatedKeyParts.length, listenerParts.length);
				i++
			) {
				if (updatedKeyParts[i] !== listenerParts[i]) {
					next = true;
					break;
				}
			}
			if (next) {
				continue;
			}
		}

		await listener(value, key, logObj);
		updated++;
		if (once) {
			_listeners.delete(index);
		}
	}

	triggerGroups(key, value, attachMessage(logObj, 'Triggering groups'), db);

	return updated;
}
