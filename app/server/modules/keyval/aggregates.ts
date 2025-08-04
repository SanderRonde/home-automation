import { LogObj } from '../../lib/logging/lob-obj';
import aggregates from '../../config/aggregates';
import type { Database } from '../../lib/db';
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

function registerListeners(keyval: typeof KeyVal) {
	for (const key in aggregates) {
		const config = aggregates[key];
		const fullName = `aggregates.${key}`;
		keyval.addListener(
			LogObj.fromEvent('KEYVAL.REGISTER_LISTENERS'),
			fullName,
			async (value, _key, logObj) => {
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

				await Promise.all(
					Object.keys(handlers).map(async (key, index) => {
						const fn = handlers[key];
						const mod = await KeyVal.modules;
						await fn(
							mod,
							logObj.attachMessage(
								'Aggregate',
								chalk.bold(`${index++}`),
								':',
								chalk.bold(key)
							)
						);
					})
				);
			}
		);
	}
}

export function initAggregates(db: Database, keyval: typeof KeyVal): void {
	registerAggregates(db);
	registerListeners(keyval);
}
