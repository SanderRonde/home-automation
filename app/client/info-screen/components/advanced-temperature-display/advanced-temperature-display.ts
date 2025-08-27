import {
	Props,
	PROP_TYPE,
	config,
	ConfigurableWebComponent,
} from 'wc-lib/build/es/wc-lib';
import { AdvancedTemperatureDisplayHTML } from './advanced-temperature-display.html.js';
import { AdvancedTemperatureDisplayCSS } from './advanced-temperature-display.css.js';

const enum TEMPERATURE_DISPLAY_TYPE {
	INSIDE = 'inside',
	OUTSIDE = 'outside',
	SERVER = 'server',
}

export const enum TEMPERATURE_DISPLAY_PERIOD {
	CURRENT = 'current',
	DAILY = 'daily',
}

@config({
	is: 'advanced-temperature-display',
	css: AdvancedTemperatureDisplayCSS,
	html: AdvancedTemperatureDisplayHTML,
})
export class AdvancedTemperatureDisplay extends ConfigurableWebComponent<{
	events: {
		propChange: {
			args: [string, unknown, unknown];
		};
	};
}> {
	private _initialized = false;

	public props = Props.define(this, {
		reflect: {
			tempType: {
				type: PROP_TYPE.STRING,
				exactType: '' as unknown as TEMPERATURE_DISPLAY_TYPE,
			},
			period: {
				type: PROP_TYPE.STRING,
				exactType: '' as unknown as TEMPERATURE_DISPLAY_PERIOD,
			},
		},
		priv: {
			temperature: {
				type: PROP_TYPE.STRING,
				value: '0',
			},
			icon: {
				type: PROP_TYPE.STRING,
				value: 'questionmark.svg',
			},
			tempMin: {
				type: PROP_TYPE.STRING,
			},
			tempMax: {
				type: PROP_TYPE.STRING,
			},
			chanceOfRain: {
				type: PROP_TYPE.NUMBER,
				value: 0,
			},
			windDegrees: {
				type: PROP_TYPE.NUMBER,
				value: 0,
			},
			windSpeed: {
				type: PROP_TYPE.NUMBER,
				value: 0,
			},
		},
	});

	public async request(
		url: string,
		postBody: {
			[key: string]: unknown;
		}
	): Promise<Response | null> {
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ ...postBody }),
				credentials: 'include',
			});
			return response;
		} catch (e) {
			return null;
		}
	}

	public async updateWeather(): Promise<void> {
		const response = await this.request(`${location.origin}/weather`, {
			type: this.props.tempType,
			period: this.props.period,
		});
		if (!response) {
			return;
		}
		const {
			temperature,
			icon,
			tempMin,
			tempMax,
			chanceOfRain,
			windDegrees,
			windSpeed,
		} = (await response.json()) as {
			temp: number;
			temperature: string;
			tempMin?: number;
			tempMax?: number;
			chanceOfRain: number;
			windDegrees: number;
			windSpeed: number;
			icon: string;
		};
		this.props.temperature = temperature;
		this.props.icon = icon;
		this.props.tempMin = tempMin
			? `${Math.round(tempMin * 10) / 10}°`
			: undefined;
		this.props.tempMax = tempMax
			? `${Math.round(tempMax * 10) / 10}°`
			: undefined;
		this.props.chanceOfRain = chanceOfRain;
		this.props.windDegrees = windDegrees;
		this.props.windSpeed = windSpeed;
	}

	public async setup(): Promise<void> {
		if (this.props.tempType === undefined || this._initialized) {
			return;
		}
		this._initialized = true;

		await this.updateWeather();
		setInterval(
			() => {
				void this.updateWeather();
			},
			this.props.tempType === TEMPERATURE_DISPLAY_TYPE.OUTSIDE
				? 1000 * 60 * 60
				: 1000 * 60
		);
	}

	public async mounted(): Promise<void> {
		this.listen('propChange', async () => {
			await this.setup();
		});
		await this.setup();
	}

	public postRender(): void {
		const windIcon = this.$$('#wind-icon')[0] as HTMLImageElement;
		if (!windIcon) {
			return;
		}
		windIcon.style.transform = `rotate(${this.props.windDegrees}deg)`;
	}
}
