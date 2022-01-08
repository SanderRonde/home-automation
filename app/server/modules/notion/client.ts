import { splitIntoGroups, wait } from '../../lib/util';
import { Client } from '@notionhq/client';
import { getEnv } from '../../lib/io';

export function createClient(): Client | null {
	const secret = getEnv('SECRET_NOTION_API_KEY');
	if (!secret) {
		return null;
	}
	return new Client({
		auth: secret,
		// logLevel: LogLevel.INFO,
		// logger: (
		// 	level: LogLevel,
		// 	message: string,
		// 	extraInfo: Record<string, unknown>
		// ): void => {
		// 	console.log(level, message, extraInfo);
		// },
	});
}

export async function getAllForQuery<Q, R>(
	fn: (args: Q) => Promise<{
		results: R[];
		object: 'list';
		next_cursor: null | string;
	}>,
	args: Q
): Promise<R[]> {
	const results: R[] = [];

	let cursor;
	do {
		const ret: {
			results: R[];
			object: 'list';
			next_cursor: null | string;
		} = await fn({
			...args,
			start_cursor: cursor,
		});
		if (ret.object !== 'list') {
			throw new Error('Return type is not a list');
		}
		results.push(...ret.results);
		cursor = ret.next_cursor ?? undefined;
		await wait(400);
	} while (cursor);

	return results;
}

export async function splitUpQuery<
	Q extends {
		filter: {
			or: F[];
		};
	},
	R,
	F
>(
	fn: (args: Q & Record<string, unknown>) => Promise<{
		results: R[];
		object: 'list';
		next_cursor: null | string;
	}>,
	args: Q
): Promise<R[]> {
	const results: R[] = [];

	// Or list can be a max of 99 items, split up
	const groups = splitIntoGroups(args.filter.or, 99);
	for (const group of groups) {
		await wait(400);
		const ret = await fn({
			...args,
			filter: {
				...args.filter,
				or: group,
			},
		});

		if (ret.object !== 'list') {
			throw new Error('Return type is not a list');
		}
		results.push(...ret.results);
	}

	return results;
}
