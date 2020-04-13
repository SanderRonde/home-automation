import {
	TemplateFn,
	CHANGE_TYPE
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { CalendarOverview } from './calendar-overview.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const CalendarOverviewCSS = new TemplateFn<CalendarOverview>(
	function(html) {
		return html`
			<style>
				#container {
					margin-left: 4.5vw;
					margin-right: 4.5vw;
					display: flex;
					flex-direction: row;
					justify-content: center;
					max-height: 23vh;
				}

				#table {
					border-spacing: 0;
				}

				#container th:not(:last-child),
				#container td:not(:last-child) {
					border-right: 4px solid white;
				}

				.weekday {
					width: 13vw;
					overflow: hidden;
					border-bottom: 4px solid white;
				}

				.day-name {
					font-size: 300%;
					font-weight: bold;
					text-align: center;
					text-transform: uppercase;
				}

				.event {
					vertical-align: top;
					padding: 0;
					padding-bottom: 1px;
					height: 100%;
				}

				.event-location {
					color: #d7d7d7;
				}

				.event-background {
					height: 100%;
				}

				.event-name,
				.event-location {
					padding: 2px;
				}
			</style>
		`;
	},
	CHANGE_TYPE.THEME,
	render
);
