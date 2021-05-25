import { get as _getInternal } from './internal';
import { get as _getExternal } from './external';
import { LogObj } from '../../../lib/logger';
import { ExternalTemperatureResult, InternalTemperatureResult } from '../types';

export function getInternal(
	logObj?: LogObj,
	name = 'room'
): Promise<InternalTemperatureResult> {
	return _getInternal(name, logObj);
}

export function getExternal(): Promise<ExternalTemperatureResult | null> {
	return _getExternal();
}