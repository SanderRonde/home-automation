import { logTag } from '@server/lib/logger';

export const smartHomeLogger = (...args: unknown[]): void =>
	logTag('smart-home', 'cyan', ...args);
