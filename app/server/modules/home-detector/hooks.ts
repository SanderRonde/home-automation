import type { LogObj } from '../../lib/logging/lob-obj';
import hooks from '../../config/home-hooks';
import { HOME_STATE } from './types';
import { HomeDetector } from '.';
import chalk from 'chalk';

export async function handleHooks(
	newState: HOME_STATE,
	name: string,
	logObj: LogObj
): Promise<void> {
	if (!(name in hooks)) {
		return;
	}

	const nameHooks = hooks[name];
	const changeHooks = (() => {
		if (newState === HOME_STATE.HOME) {
			return nameHooks.home;
		} else {
			return nameHooks.away;
		}
	})();
	if (!changeHooks) {
		return;
	}

	let index = 0;
	for (const name in changeHooks) {
		const fn = changeHooks[name];
		await fn(
			await HomeDetector.modules,
			logObj.attachMessage(
				'Hook',
				chalk.bold(String(index++)),
				':',
				chalk.bold(name)
			)
		);
	}
	logObj.attachMessage(
		'State for',
		chalk.bold(name),
		'changed to',
		chalk.bold(newState)
	);
}
