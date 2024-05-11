import { getKey } from '@server/modules/auth/secret';

const ids: Map<number, string> = new Map();

function createId(): number {
	const id = Math.floor(Math.random() * (1e6 - 1e5)) + 1e5;
	if (ids.has(id)) {
		return createId();
	}
	return id;
}

function createClientSecret(id: number) {
	const key = getKey();
	const idArr = String(id)
		.split('')
		.map((s) => parseInt(s, 10));

	return key
		.split('')
		.map((char) => {
			let charCode = char.charCodeAt(0);
			for (const idChar of idArr) {
				charCode = charCode ^ idChar;
			}
			return charCode;
		})
		.join('');
}

export function genId(): number {
	const id = createId();
	ids.set(id, createClientSecret(id));
	return id;
}

export function getClientSecret(id: number): string {
	if (ids.has(id)) {
		return ids.get(id)!;
	}
	const secret = createClientSecret(id);
	ids.set(id, secret);
	return secret;
}

export function authenticate(authKey: string, id: string): boolean {
	if (authKey === getKey()) {
		return true;
	}

	if (Number.isNaN(parseInt(id, 10))) {
		return false;
	}
	return getClientSecret(parseInt(id, 10)) === authKey;
}
