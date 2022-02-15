import { SettablePromise } from '../../../lib/util';
import { smartHomeLogger } from '../shared';
import { db } from '.';

export const currentUsers = new SettablePromise<{
	[prefix: string]: {
		[user: string]: unknown;
	};
}>();

export async function addUser(
	username: string,
	prefix: string,
	data: unknown = {}
): Promise<void> {
	const value = await currentUsers.value;
	if (!value[prefix]) {
		value[prefix] = {};
	}
	if (!value[prefix][username]) {
		value[prefix][username] = data;
	}
	(await db.value).setVal('homegraph-users', currentUsers);
	smartHomeLogger('Added user', username);
}

export async function removeUser(
	username: string,
	prefix: string
): Promise<void> {
	const value = await currentUsers.value;
	if (!value[prefix]) {
		value[prefix] = {};
	}
	delete value[prefix][username];
	(await db.value).setVal('homegraph-users', currentUsers);
	smartHomeLogger('Removed user', username);
}

export async function initHomeGraphUsers(): Promise<void> {
	currentUsers.set((await db.value).get('homegraph-users', {}));
	const users = Object.values(await currentUsers.value)
		.map((v) => Object.values(v).length)
		.reduce((a, b) => a + b, 0);
	smartHomeLogger(`Found ${users} users`);
}
