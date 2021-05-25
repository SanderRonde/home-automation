import { errorHandle, requireParams } from '../../lib/decorators';
import { ResponseLike, attachMessage } from '../../lib/logger';
import { ExternalTemperatureResult } from './types';
import { getExternal, getInternal } from './temperature';
import { CalendarEvent, getEvents } from './calendar';

export class APIHandler {
	constructor() {}

	@errorHandle
	@requireParams('type')
	public async getTemperature(
		res: ResponseLike,
		{
			type,
		}: {
			type: 'inside' | 'outside' | 'server';
		}
	): Promise<ExternalTemperatureResult | number> {
		const { temp, icon } = await (async (): Promise<{
			temp: number;
			icon: string;
		}> => {
			if (type === 'inside') {
				// Use temperature module
				const temp = await getInternal(res);
				return { temp: temp.temp, icon: 'inside.png' };
			} else if (type === 'server') {
				const temp = await getInternal(res, 'server');
				return { temp: temp.temp, icon: 'server.png' };
			} else {
				// Use openweathermap
				const openweathermapResponse = await getExternal();
				if (openweathermapResponse === null) {
					return {
						temp: 0,
						icon: 'questionmark.svg',
					};
				}
				return openweathermapResponse;
			}
		})();

		attachMessage(res, `Temp: "${String(temp)}", icon: ${icon}`);
		res.status(200).write(
			JSON.stringify({
				temperature: `${Math.round(temp * 10) / 10}°`,
				icon: icon,
			})
		);
		res.end();
		return temp;
	}

	@errorHandle
	public async getEvents(res: ResponseLike): Promise<CalendarEvent[]> {
		try {
			const events = await getEvents(7);
			attachMessage(res, `Fetched ${events.length} events`);
			res.status(200).write(
				JSON.stringify({
					events,
				})
			);
			res.end();
			return events;
		} catch (e) {
			console.log(e);
			res.status(500);
			res.write('calendar API not authenticated');
			res.end();
			return [];
		}
	}
}
