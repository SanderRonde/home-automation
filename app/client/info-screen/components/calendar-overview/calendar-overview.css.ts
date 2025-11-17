import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import type { CalendarOverview } from './calendar-overview.js';

export const CalendarOverviewCSS = new TemplateFn<CalendarOverview>(
	(html) => {
		return html`
			<style>
				#container {
					margin-left: 4.5vw;
					margin-right: 4.5vw;
					flex-direction: row;
					justify-content: center;
					max-height: 40vh;

					display: grid;
					grid-template-columns:
						4px calc((90vw - 28px) / 7) 5px calc((90vw - 28px) / 7)
						5px calc((90vw - 28px) / 7) 5px calc((90vw - 28px) / 7)
						5px calc((90vw - 28px) / 7) 5px calc((90vw - 28px) / 7)
						5px calc((90vw - 28px) / 7);
				}

				#table {
					border-spacing: 0;
					min-height: 200px;
				}

				#container th:not(:last-child),
				#container td:not(:last-child) {
					border-right: 4px solid white;
				}

				#container td.all-day {
					border-right: 0px;
				}

				.weekday {
					overflow: hidden;
					border-bottom: 4px solid white;
					grid-row-start: 1;
					grid-row-end: 1;
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
					word-break: break-all;
					border-bottom: 1px solid black;
				}

				.event-name,
				.event-time {
					color: black;
				}

				.event-location {
					color: #646464;
				}

				.event-name {
					font-weight: bold;
				}

				.event-no-title {
					opacity: 0;
				}

				.event-background {
					border-bottom: 1px solid black;
				}

				.event-name,
				.event-location {
					padding: 2px;
				}

				#table td,
				#table th {
					word-wrap: break-word;
					max-width: calc((90vw - 28px) / 7);
				}

				.all-day-spacer {
					border-bottom: 4px solid rgba(255, 255, 255, 0.23);
				}

				.calendar-column-spacing {
					background-color: white;
				}
			</style>
		`;
	},
	CHANGE_TYPE.THEME,
	render
);
