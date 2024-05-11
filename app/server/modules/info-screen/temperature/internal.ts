import { InternalTemperatureResult } from '@server/modules/info-screen/types';
import { LogObj } from '@server/lib/logger';
import { InfoScreen } from '..';

export async function get(
	name: string,
	logObj?: LogObj
): Promise<InternalTemperatureResult> {
	return await new (await InfoScreen.modules).temperature.External(
		logObj || {},
		'INFO_SCREEN.TEMPERATURE'
	).getTemp(name);
}
