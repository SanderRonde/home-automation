import { InfoScreen } from '.';
import { getEnv } from '../../lib/io';
import { LogObj } from '../../lib/logger';
import { XHR } from '../../lib/util';
import { InternalTemperatureResult, ExternalTemperatureResult } from './types';

export namespace Internal {
	export async function get(
		name: string,
		logObj?: LogObj
	): Promise<InternalTemperatureResult> {
		return await new (
			await InfoScreen.modules
		).temperature.External.Handler(
			logObj || {},
			'INFO_SCREEN.TEMPERATURE'
		).getTemp(name);
	}
}

export namespace External {
	const openweathermapSecrets = {
		api_key: getEnv('SECRET_OPENWEATHERMAP_API_KEY', true),
		city: getEnv('SECRET_OPENWEATHERMAP_CITY', true),
		units: getEnv('SECRET_OPENWEATHERMAP_UNITS', true),
	};

	export async function get(): Promise<ExternalTemperatureResult | null> {
		if (!openweathermapSecrets) {
			return null;
		}
		try {
			const response = await XHR.get(
				'http://api.openweathermap.org/data/2.5/weather',
				'openweathermap-weather',
				{
					q: openweathermapSecrets.city,
					appid: openweathermapSecrets.api_key,
					units: openweathermapSecrets.units,
				}
			);
			const parsed = JSON.parse(response) as {
				coord: {
					lon: number;
					lat: number;
				};
				weather: {
					id: number;
					main: string;
					description: string;
					icon: string;
				}[];
				base: string;
				main: {
					temp: number;
					feels_like: number;
					temp_min: number;
					temp_max: number;
					pressure: number;
					humidity: number;
				};
				visibility: number;
				wind: {
					speed: number;
					deg: number;
				};
				clouds: {
					all: number;
				};
				dt: number;
				sys: {
					type: number;
					id: number;
					country: string;
					sunrise: number;
					sunset: number;
				};
				timezone: number;
				id: number;
				name: string;
				cod: number;
			};
			return {
				temp: parsed.main.temp,
				icon: `${parsed.weather[0].icon}.svg`,
			};
		} catch (e) {
			console.log(e);
			return null;
		}
	}
}

export function getInternal(
	logObj?: LogObj,
	name = 'room'
): Promise<InternalTemperatureResult> {
	return Internal.get(name, logObj);
}

export function getExternal(): Promise<ExternalTemperatureResult | null> {
	return External.get();
}
