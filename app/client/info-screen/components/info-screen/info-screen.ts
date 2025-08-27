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
		// @ts-ignore
		super.props
	);
}
