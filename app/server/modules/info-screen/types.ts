export interface InternalTemperatureResult {
	temp: number;
}

export interface ExternalTemperatureResult {
	temp: number;
	tempMin?: number;
	tempMax?: number;
	chanceOfRain: number;
	windDegrees: number;
	windSpeed: number;
	icon: string;
}

interface Weather {
	id: number;
	main: string;
	description: string;
	icon: string;
}

interface Current {
	dt: number;
	sunrise: number;
	sunset: number;
	temp: number;
	feels_like: number;
	pressure: number;
	humidity: number;
	dew_point: number;
	uvi: number;
	clouds: number;
	visibility: number;
	wind_speed: number;
	wind_deg: number;
	wind_gust: number;
	weather: Weather[];
}

interface Minutely {
	dt: number;
	precipitation: number;
}

interface Hourly {
	dt: number;
	temp: number;
	feels_like: number;
	pressure: number;
	humidity: number;
	dew_point: number;
	uvi: number;
	clouds: number;
	visibility: number;
	wind_speed: number;
	wind_deg: number;
	wind_gust: number;
	weather: Weather[];
	pop: number;
}

interface Temp {
	day: number;
	min: number;
	max: number;
	night: number;
	eve: number;
	morn: number;
}

interface FeelsLike {
	day: number;
	night: number;
	eve: number;
	morn: number;
}

interface Daily {
	dt: number;
	sunrise: number;
	sunset: number;
	moonrise: number;
	moonset: number;
	moon_phase: number;
	temp: Temp;
	feels_like: FeelsLike;
	pressure: number;
	humidity: number;
	dew_point: number;
	wind_speed: number;
	wind_deg: number;
	wind_gust: number;
	weather: Weather[];
	clouds: number;
	pop: number;
	uvi: number;
}

export interface WeatherAPIResponse {
	lat: number;
	lon: number;
	timezone: string;
	timezone_offset: number;
	current: Current;
	minutely: Minutely[];
	hourly: Hourly[];
	daily: Daily[];
}

export enum ExternalWeatherTimePeriod {
	CURRENT,
	DAILY,
}
