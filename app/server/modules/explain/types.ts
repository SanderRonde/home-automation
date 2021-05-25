import { LogObj } from '../../lib/logger';

export type ExplainHook = (
	description: string,
	source: string,
	logObj: LogObj
) => void;
