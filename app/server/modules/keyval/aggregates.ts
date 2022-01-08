import { createHookables } from '../../lib/util';
import { attachMessage } from '../../lib/logger';
import { addListener } from './get-set-listener';
import aggregates from '../../config/aggregates';
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
		addListener(fullName, async (value, logObj) => {
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
			for (const key in handlers) {
				const fn = handlers[key];
				await fn(
					createHookables(
						await KeyVal.modules,
						'AGGREGATES',
						key,
						attachMessage(
							logObj,
							'Aggregate',
							chalk.bold(`${index++}`),
							':',
							chalk.bold(key)
						)
					)
				);
			}
		});
	}
}

export function initAggregates(db: Database): void {
	registerAggregates(db);
	registerListeners();
}
