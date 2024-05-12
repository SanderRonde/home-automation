import { LogObj, createLogObjWithName } from '../../../lib/logger';
import { InternalTemperatureResult } from '../types';
import { InfoScreen } from '..';

export async function get(
	name: string,
	logObj?: LogObj
): Promise<InternalTemperatureResult> {
	return await new (await InfoScreen.modules).temperature.External(
		logObj || createLogObjWithName('INFO_SCREEN.TEMPERATURE')
	).getTemp(name);
}
