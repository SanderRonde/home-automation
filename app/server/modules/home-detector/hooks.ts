import { attachMessage, logFixture, LogObj } from '@server/lib/logger';
import { createHookables } from '@server/lib/util';
import hooks from '@server/config/home-hooks';
import { HOME_STATE } from '@server/modules/home-detector/types';
import { HomeDetector } from '.';
import chalk from 'chalk';

export async function handleHooks(
	newState: HOME_STATE,
	name: string,
	logObj: LogObj = {}
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
			createHookables(
				await HomeDetector.modules,
				'HOMEHOOK',
				name,
				attachMessage(
					logObj,
					'Hook',
					chalk.bold(String(index++)),
					':',
					chalk.bold(name)
				)
			)
		);
	}
	logFixture(
		logObj,
		chalk.cyan('[hook]'),
		'State for',
		chalk.bold(name),
		'changed to',
		chalk.bold(newState)
	);
}
