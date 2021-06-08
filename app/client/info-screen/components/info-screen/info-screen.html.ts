import {
	CHANGE_TYPE,
	TemplateFn,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { TEMPERATURE_DISPLAY_TYPE } from '../temperature-display/temperature-display.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { InfoScreen } from './info-screen';
import { TEMPERATURE_DISPLAY_PERIOD } from '../advanced-temperature-display/advanced-temperature-display.js';

export const InfoScreenHTML = new TemplateFn<InfoScreen>(
	(html, { props }) => {
		return html`
			<div
				id="background"
				class="${{
					blank: props.blank,
				}}"
			>
				<div id="grid">
					<advanced-temperature-display
						id="daily-temp"
						temp-type="${TEMPERATURE_DISPLAY_TYPE.OUTSIDE}"
						period="${TEMPERATURE_DISPLAY_PERIOD.DAILY}"
					></advanced-temperature-display>
					<advanced-temperature-display
						id="current-temp"
						temp-type="${TEMPERATURE_DISPLAY_TYPE.OUTSIDE}"
						period="${TEMPERATURE_DISPLAY_PERIOD.CURRENT}"
					></advanced-temperature-display>
					<current-date id="top-date"></current-date>
					<temperature-display
						id="right-temp"
						temp-type="${TEMPERATURE_DISPLAY_TYPE.INSIDE}"
					></temperature-display>
					<temperature-display
						id="server-temp"
						temp-type="${TEMPERATURE_DISPLAY_TYPE.SERVER}"
					></temperature-display>
					<calendar-overview id="calendar"></calendar-overview>
					${props.offline
						? html`
								<div id="offline">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="white"
									>
										<path
											d="M0 0h24v24h-24z"
											fill="none"
										></path>
										<path
											d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48l10.33 10.32 5.46-6.8zm-6.6 8.22l-13.77-13.78-1.27 1.28 2.05 2.06c-2.14.98-3.46 2.04-3.69 2.22l11.63 14.49.01.01.01-.01 3.9-4.86 3.32 3.32 1.27-1.27-3.46-3.46z"
										></path>
									</svg>
								</div>
						  `
						: ''}
				</div>
			</div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);
