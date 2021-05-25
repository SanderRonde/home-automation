import { db } from '.';
import { SettablePromise } from '../../../lib/util';
import { smartHomeLogger } from '../shared';

export const currentUsers = new SettablePromise<string[]>();

export async function addUser(username: string): Promise<void> {
	(await db.value).pushVal('homegraph-users', username, 'ignore');
	if (!(await currentUsers.value).includes(username)) {
		(await currentUsers.value).push(username);
	}
	smartHomeLogger('Added user', username);
}

export async function removeUser(username: string): Promise<void> {
	(await db.value).deleteArrayVal(
		'homegraph-users',
		(item) => item === username
	);
	(await currentUsers.value).splice(
		(await currentUsers.value).indexOf(username),
		1
	);
	smartHomeLogger('Removed user', username);
}

export async function initHomeGraphUsers(): Promise<void> {
	currentUsers.set((await db.value).get('homegraph-users', []));
	smartHomeLogger(`Found ${(await currentUsers.value).length} users`);
}
