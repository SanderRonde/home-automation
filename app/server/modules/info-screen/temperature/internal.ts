import { LogObj } from '../../../lib/logging/lob-obj';
import { InternalTemperatureResult } from '../types';
import { InfoScreen } from '..';

export async function get(
	name: string,
	logObj?: LogObj
): Promise<InternalTemperatureResult> {
	return await new (await InfoScreen.modules).temperature.External(
		logObj || LogObj.fromEvent('INFO_SCREEN.TEMPERATURE')
	).getTemp(name);
}
