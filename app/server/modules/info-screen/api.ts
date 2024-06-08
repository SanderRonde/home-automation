import type { ResponseLike } from '../../lib/logging/response-logger';
import { errorHandle, requireParams } from '../../lib/decorators';
import { getInternal, getExternal } from './temperature/';
import type { ExternalTemperatureResult } from './types';
import { ExternalWeatherTimePeriod } from './types';
import { LogObj } from '../../lib/logging/lob-obj';
import type { CalendarEvent } from './calendar';
import { getEvents } from './calendar';

export class APIHandler {
	@errorHandle
	@requireParams('type')
	public async getTemperature(
		res: ResponseLike,
		{
			type,
			period,
		}: {
			type: 'inside' | 'outside' | 'server';
			period: 'current' | 'daily';
		}
	): Promise<ExternalTemperatureResult | number> {
		const response = await (async () => {
			if (type === 'inside') {
				// Use temperature module
				const temp = await getInternal(LogObj.fromRes(res));
				return { temperature: temp.temp, icon: 'inside.png' };
			} else if (type === 'server') {
				const temp = await getInternal(LogObj.fromRes(res), 'server');
				return { temperature: temp.temp, icon: 'server.png' };
			} else {
				// Use openweathermap
				const openweathermapResponse = await getExternal(
					period === 'current'
						? ExternalWeatherTimePeriod.CURRENT
						: ExternalWeatherTimePeriod.DAILY
				);
				if (openweathermapResponse === null) {
					return {
						temperature: 0,
						icon: 'questionmark.svg',
					};
				}
				return {
					...openweathermapResponse,
					temperature: openweathermapResponse.temp,
				};
			}
		})();
		const { temperature, icon } = response;

		LogObj.fromRes(res).attachMessage(
			`Temp: "${String(temperature)}", icon: ${icon}`
		);
		res.status(200).write(
			JSON.stringify({
				...response,
				temperature: `${Math.round(temperature * 10) / 10}°`,
			})
		);
		res.end();
		return temperature;
	}

	@errorHandle
	public async getEvents(res: ResponseLike): Promise<CalendarEvent[]> {
		try {
			const events = await getEvents(7);
			LogObj.fromRes(res).attachMessage(
				`Fetched ${events.length} events`
			);
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
