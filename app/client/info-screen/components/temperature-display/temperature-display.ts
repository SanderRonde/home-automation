import {
	Props,
	PROP_TYPE,
	config,
	ConfigurableWebComponent
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { TemperatureDisplayHTML } from './temperature-display.html.js';
import { TemperatureDisplayCSS } from './temperature-display.css.js';

export const enum TEMPERATURE_DISPLAY_TYPE {
	INSIDE = 'inside',
	OUTSIDE = 'outside',
	SERVER = 'server'
}

@config({
	is: 'temperature-display',
	css: TemperatureDisplayCSS,
	html: TemperatureDisplayHTML
})
export class TemperatureDisplay extends ConfigurableWebComponent<{
	events: {
		propChange: {
			args: [string, any, any];
		};
	};
}> {
	props = Props.define(this, {
		reflect: {
			tempType: {
				type: PROP_TYPE.STRING,
				exactType: ('' as unknown) as TEMPERATURE_DISPLAY_TYPE
			}
		},
		priv: {
			temperature: {
				type: PROP_TYPE.STRING,
				value: '0'
			},
			icon: {
				type: PROP_TYPE.STRING,
				value: 'questionmark.svg'
			}
		}
	});

	async request(
		url: string,
		postBody: {
			[key: string]: any;
		}
	) {
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ ...postBody }),
				credentials: 'include'
			});
			return response;
		} catch (e) {
			return null;
		}
	}

	async updateWeather() {
		const response = await this.request(`${location.origin}/weather`, {
			type: this.props.tempType
		});
		if (!response) {
			return;
		}
		const { temperature, icon } = await response.json();
		this.props.temperature = temperature;
		this.props.icon = icon;
	}

	private _initialized: boolean = false;
	setup() {
		if (this.props.tempType === undefined || this._initialized) return;
		this._initialized = true;

		this.updateWeather();
		setInterval(
			() => {
				this.updateWeather();
			},
			this.props.tempType === TEMPERATURE_DISPLAY_TYPE.OUTSIDE
				? 1000 * 60 * 60
				: 1000 * 60
		);
	}

	mounted() {
		this.listen('propChange', () => {
			this.setup();
		});
		this.setup();
	}
}
