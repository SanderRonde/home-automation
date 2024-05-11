import { logTag } from '../../lib/logger';

export const smartHomeLogger = (...args: unknown[]): void =>
	logTag('smart-home', 'cyan', ...args);
