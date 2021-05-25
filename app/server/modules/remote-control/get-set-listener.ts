import { LogObj } from '../../lib/logger';
import { Commands } from './types';

const _listeners: Map<
	number,
	(
		| {
				key: string;
				any?: boolean;
		  }
		| {
				any: true;
				key?: string;
		  }
	) & {
		listener: (command: Commands, logObj: LogObj) => Promise<void> | void;
		once: boolean;
	}
> = new Map();
let _lastIndex = 0;

export function addListener(
	command: Commands,
	listener: (command: Commands, logObj: LogObj) => void,
	once = false
): number {
	const index = _lastIndex++;
	_listeners.set(index, {
		key: command['action'],
		listener,
		once,
		any: false,
	});
	return index;
}

export function listenAny(
	listener: (command: Commands, logObj: LogObj) => void,
	once = false
): number {
	const index = _lastIndex++;
	_listeners.set(index, {
		any: true,
		listener,
		once,
		key: '',
	});
	return index;
}

export function removeListener(index: number): void {
	_listeners.delete(index);
}

export async function update(
	command: Commands,
	logObj: LogObj
): Promise<number> {
	let updated = 0;
	const updatedKeyParts = command['action'].split('.');

	const promises: Promise<unknown>[] = [];
	_listeners.forEach(({ any, key: listenerKey, listener, once }, index) => {
		promises.push(
			(async () => {
				if (!any) {
					const listenerParts = listenerKey!.split('.');
					let next = false;
					for (
						let i = 0;
						i <
						Math.min(updatedKeyParts.length, listenerParts.length);
						i++
					) {
						if (updatedKeyParts[i] !== listenerParts[i]) {
							next = true;
							break;
						}
					}
					if (next) {
						return;
					}
				}

				await listener(command, logObj);
				updated++;
				if (once) {
					_listeners.delete(index);
				}
			})()
		);
	});
	await Promise.all(promises);
	return updated;
}
