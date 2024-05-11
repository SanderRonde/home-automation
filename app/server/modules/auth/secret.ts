import { getEnv } from '../../lib/io';

const key: string = getEnv('SECRET_AUTH', true);
const botSecret: string = getEnv('SECRET_BOT', true);

export function authenticate(authKey: string): boolean {
	return key === authKey;
}

export function getKey(): string {
	return key;
}

export function redact(msg: string): string {
	return msg.replace(key, '[redacted]').replace(botSecret, '[redacted]');
}
