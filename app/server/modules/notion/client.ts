import { Client } from '@notionhq/client';
import { getEnv } from '../../lib/io';

export function createClient(): Client | null {
	const secret = getEnv('SECRET_NOTION_API_KEY');
	if (!secret) {
		return null;
	}
	return new Client({
		auth: secret,
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
	} while (cursor);

	return results;
}
