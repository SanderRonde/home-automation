import {
	Props,
	PROP_TYPE,
	config,
	ConfigurableWebComponent,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { TemperatureDisplayHTML } from './temperature-display.html.js';
import { TemperatureDisplayCSS } from './temperature-display.css.js';

export const enum TEMPERATURE_DISPLAY_TYPE {
	INSIDE = 'inside',
	OUTSIDE = 'outside',
	SERVER = 'server',
}

@config({
	is: 'temperature-display',
	css: TemperatureDisplayCSS,
	html: TemperatureDisplayHTML,
})
export class TemperatureDisplay extends ConfigurableWebComponent<{
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
		});
		if (!response) {
			return;
		}
		const { temperature, icon } = await response.json();
		this.props.temperature = temperature;
		this.props.icon = icon;
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
}
