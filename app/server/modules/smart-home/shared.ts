import { logTag } from '../../lib/logging/logger';

export const smartHomeLogger = (...args: unknown[]): void =>
	logTag('smart-home', 'cyan', ...args);
