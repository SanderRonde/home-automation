import { logTag } from '../../lib/logger';

export const smartHomeLogger = (...args: unknown[]) =>
	logTag('smart-home', 'cyan', ...args);
