export function generateRandomString(length = 64): string {
	let str = '';
	for (let i = 0; i < length; i++) {
		str += CHARS[Math.floor(CHARS.length * Math.random())];
	}
	return str;
}
const CHARS =
	'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split('');
