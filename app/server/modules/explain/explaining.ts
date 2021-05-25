import { Explain } from './index';
import { addLogListener, LogCapturer, LogObj } from '../../lib/logger';
import { AllModules } from '..';

const ACTION_TIMEOUT_TIME = 30 * 60 * 1000;

export interface Action {
	moduleName: string;
	description: string;
	source: string;
	logs: LogCapturer | null;
	timestamp: number;
}

const hooks: Set<Action> = new Set();

function hook(
	moduleName: string,
	description: string,
	source: string,
	logObj: LogObj
) {
	if (moduleName === Explain.name) {
		return;
	}

	const action: Action = {
		moduleName,
		description,
		source,
		logs: null,
		timestamp: Date.now(),
	};
	addLogListener(logObj, (captured) => {
		action.logs = captured;
	});
	hooks.add(action);
	setTimeout(() => {
		hooks.delete(action);
	}, ACTION_TIMEOUT_TIME);
}

export function initHooks(modules: AllModules): void {
	for (const moduleName in modules) {
		const moduleObj = modules[moduleName as keyof AllModules];
		const meta = 'meta' in moduleObj ? moduleObj.meta : moduleObj;
		meta.addExplainHookFromExternal((description, source, logObj) => {
			hook(moduleName, description, source, logObj);
		});
	}
}

function sortChronological(actions: Action[]) {
	return actions.sort((a, b) => {
		return a.timestamp - b.timestamp;
	});
}

export function getInTimeWindow(ms: number): Action[] {
	const now = Date.now();
	const minTime = now - ms;

	const values = Array.from(hooks.values()).reverse();

	const retVals: Action[] = [];
	for (let i = 0; i < values.length; i++) {
		const action = values[i];
		if (action.timestamp < minTime) {
			break;
		}
		retVals.push(action);
	}

	return sortChronological(retVals);
}

export function getLastX(amount = 1): Action[] {
	return Array.from(hooks.values()).slice(-amount);
}
