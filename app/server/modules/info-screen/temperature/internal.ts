import { InfoScreen } from '..';
import { LogObj } from '../../../lib/logger';
import { InternalTemperatureResult } from '../types';

export async function get(
	name: string,
	logObj?: LogObj
): Promise<InternalTemperatureResult> {
	return await new (
		await InfoScreen.modules
	).temperature.external(logObj || {}, 'INFO_SCREEN.TEMPERATURE').getTemp(
		name
	);
}
