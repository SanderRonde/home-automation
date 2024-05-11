import {
	ExternalTemperatureResult,
	ExternalWeatherTimePeriod,
	WeatherAPIResponse,
} from '../types';
import { getEnv } from '../../../lib/io';
import { XHR } from '../../../lib/util';

const openweathermapSecrets = {
	api_key: getEnv('SECRET_OPENWEATHERMAP_API_KEY', false),
	lat: getEnv('SECRET_OPENWEATHERMAP_LAT', false),
	lon: getEnv('SECRET_OPENWEATHERMAP_LON', false),
	units: getEnv('SECRET_OPENWEATHERMAP_UNITS', false),
};

export async function get(
	timePeriod: ExternalWeatherTimePeriod
): Promise<ExternalTemperatureResult | null> {
	if (
		!openweathermapSecrets.api_key ||
		!openweathermapSecrets.lat ||
		!openweathermapSecrets.lon ||
		!openweathermapSecrets.units
	) {
		return null;
	}
	try {
		const response = await XHR.get(
			'http://api.openweathermap.org/data/2.5/onecall',
			'openweathermap-weather',
			{
				lat: openweathermapSecrets.lat,
				lon: openweathermapSecrets.lon,
				appid: openweathermapSecrets.api_key,
				units: openweathermapSecrets.units,
				mode: 'json',
			}
		);
		if (!response) {
			throw new Error('Failed to fetch weather data');
		}
		const parsed = JSON.parse(response) as WeatherAPIResponse;
		if (timePeriod === ExternalWeatherTimePeriod.CURRENT) {
			const hourlyForecast = parsed.hourly[0];
			return {
				chanceOfRain: Math.round(hourlyForecast.pop * 100),
				icon: `${hourlyForecast.weather[0].icon}.svg`,
				temp: parsed.current.temp,
				windDegrees: parsed.current.wind_deg,
				windSpeed: parsed.current.wind_speed,
			};
		}
		const currentDailyForecast = parsed.daily[0];
		return {
			chanceOfRain: currentDailyForecast.pop * 100,
			icon: `${currentDailyForecast.weather[0].icon}.svg`,
			temp: currentDailyForecast.temp.day,
			tempMin: currentDailyForecast.temp.min,
			tempMax: currentDailyForecast.temp.max,
			windDegrees: currentDailyForecast.wind_deg,
			windSpeed: currentDailyForecast.wind_speed,
		};
	} catch (e) {
		console.log(e);
		return null;
	}
}
