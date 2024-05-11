import { LogObj } from '@server/lib/logger';

export type ExplainHook = (
	description: string,
	source: string,
	logObj: LogObj
) => void;
