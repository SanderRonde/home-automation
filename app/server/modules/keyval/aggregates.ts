import aggregates from '../../config/aggregates';
import { addListener } from './get-set-listener';
import { attachMessage } from '../../lib/logger';
import { createHookables } from '../../lib/util';
import { Database } from '../../lib/db';
import { KeyVal } from '.';
import chalk from 'chalk';

function registerAggregates(db: Database) {
	for (const key in aggregates) {
		const fullName = `aggregates.${key}`;
		if (db.get(fullName) === undefined) {
			db.setVal(fullName, '0');
		}
	}
}

function registerListeners() {
	for (const key in aggregates) {
		const config = aggregates[key];
		const fullName = `aggregates.${key}`;
		addListener(fullName, async (value, _key, logObj) => {
			const handlers = (() => {
				if (value === '1') {
					return config.on;
				} else if (value === '0') {
					return config.off;
				}
				return null;
			})();
			if (!handlers) {
				return;
			}

			let index = 0;
			await Promise.all(
				Object.keys(handlers).map(async (key) => {
					const fn = handlers[key];
					const mod = await KeyVal.modules;
					const hookables = createHookables(
						mod,
						'AGGREGATES',
						key,
						attachMessage(
							logObj,
							'Aggregate',
							chalk.bold(`${index++}`),
							':',
							chalk.bold(key)
						)
					);
					await fn(hookables);
				})
			);
		});
	}
}

export function initAggregates(db: Database): void {
	registerAggregates(db);
	registerListeners();
}
