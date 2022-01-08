import { AdvancedTemperatureDisplay } from '../advanced-temperature-display/advanced-temperature-display.js';
import {
	Props,
	config,
	PROP_TYPE,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { TemperatureDisplay } from '../temperature-display/temperature-display.js';
import { CalendarOverview } from '../calendar-overview/calendar-overview.js';
import { ServerComm } from '../../../shared/server-comm/server-comm.js';
import { CurrentDate } from '../current-date/current-date.js';
import { InfoScreenHTML } from './info-screen.html.js';
import { InfoScreenCSS } from './info-screen.css.js';

@config({
	is: 'info-screen',
	html: InfoScreenHTML,
	css: InfoScreenCSS,
	dependencies: [
		CurrentDate,
		TemperatureDisplay,
		CalendarOverview,
		AdvancedTemperatureDisplay,
	],
})
export class InfoScreen extends ServerComm {
	public props = Props.define(
		this,
		{
			reflect: {
				blank: {
					type: PROP_TYPE.BOOL,
					value: false,
				},
				offline: {
					type: PROP_TYPE.BOOL,
					value: false,
				},
			},
		},
		super.props
	);

	public connectWebsocket(): void {
		const connection = new WebSocket(`ws://${location.host}/blanking`);
		connection.onmessage = (m) => {
			const data = JSON.parse(m.data) as {
				blank?: boolean;
				refresh?: boolean;
			};
			if ('blank' in data && data.blank !== undefined) {
				this.props.blank = data.blank;
			}
			if ('refresh' in data && data.refresh !== undefined) {
				location.reload();
			}
		};
		connection.onopen = () => {
			this.props.offline = false;
		};
		connection.onclose = () => {
			this.props.offline = true;
			setTimeout(() => {
				this.connectWebsocket();
			}, 1000 * 5);
		};
	}

	public mounted(): void {
		this.connectWebsocket();
	}
}
