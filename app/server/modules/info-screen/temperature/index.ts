import {
	ExternalTemperatureResult,
	ExternalWeatherTimePeriod,
	InternalTemperatureResult,
} from '../types';
import { get as _getInternal } from './internal';
import { get as _getExternal } from './external';
import { LogObj } from '../../../lib/logging/lob-obj';

export function getInternal(
	logObj?: LogObj,
	name = 'room'
): Promise<InternalTemperatureResult> {
	return _getInternal(name, logObj);
}

export function getExternal(
	timePeriod: ExternalWeatherTimePeriod
): Promise<ExternalTemperatureResult | null> {
	return _getExternal(timePeriod);
}
