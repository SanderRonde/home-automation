import {
	ExternalTemperatureResult,
	ExternalWeatherTimePeriod,
	InternalTemperatureResult,
} from '@server/modules/info-screen/types';
import { get as _getInternal } from '@server/modules/info-screen/temperature/internal';
import { get as _getExternal } from '@server/modules/info-screen/temperature/external';
import { LogObj } from '@server/lib/logger';

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
