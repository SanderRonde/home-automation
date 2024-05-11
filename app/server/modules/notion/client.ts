import { splitIntoGroups, wait } from '@server/lib/util';
import { Client } from '@notionhq/client';
import { logTag } from '@server/lib/logger';
import { getEnv } from '@server/lib/io';
import AsyncLock from 'async-lock';

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
		const lock = await acquireLock();

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

		lock.release();
	} while (cursor);

	return results;
}

const notionLock = new AsyncLock();
async function acquireLock(): Promise<{
	release(): void;
}> {
	return new Promise<{
		release(): void;
	}>((resolve) => {
		void notionLock.acquire('notion', async (done) => {
			await wait(400);
			resolve({
				release() {
					done();
				},
			});
		});
	});
}

export async function notionRequest<R>(
	callback: () => Promise<R>
): Promise<R | null> {
	const lock = await acquireLock();
	let result: R | null = null;
	try {
		result = await callback();
	} catch (e) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		logTag('notion-error', 'red', e.message, e);
	} finally {
		lock.release();
	}
	return result;
}

export async function splitUpQuery<
	Q extends {
		filter: {
			or: F[];
		};
	},
	R,
	F,
>(
	fn: (args: Q & Record<string, unknown>) => Promise<{
		results: R[];
		object: 'list';
		next_cursor: null | string;
	}>,
	args: Q
): Promise<R[] | null> {
	const results: R[] = [];

	// Or list can be a max of 99 items, split up
	const groups = splitIntoGroups(args.filter.or, 99);
	for (const group of groups) {
		const ret = await notionRequest(async () => {
			return await fn({
				...args,
				filter: {
					...args.filter,
					or: group,
				},
			});
		});

		if (ret === null) {
			return null;
		}

		if (ret.object !== 'list') {
			throw new Error('Return type is not a list');
		}
		results.push(...ret.results);
	}

	return results;
}
