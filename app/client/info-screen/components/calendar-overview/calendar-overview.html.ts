import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import type { CalendarOverview } from './calendar-overview.js';

export const CalendarOverviewHTML = new TemplateFn<CalendarOverview>(
	function (html) {
		const allDayEvents = this.getFormattedAllDayEvents();
		const timeSpacedEvents = this.getTimeSpacedEvents();
		return html`
			<div id="container">
				${new Array(
					timeSpacedEvents.length +
						(allDayEvents.length ? allDayEvents.length + 1 : 0) +
						1 +
						1
				)
					.fill(null)
					.map((_, level) => {
						return new Array(6).fill(null).map((_, index) => {
							let offset = 2;
							if (allDayEvents.length > 0) {
								offset += allDayEvents.length + 1;
							}
							offset = 0;
							return html`
								<div
									class="calendar-column-spacing"
									style="${{
										'grid-column-start': (index + 1) * 2 + 1,
										'grid-column-end': (index + 1) * 2 + 2,
										'grid-row-start': level + 1 + offset,
										'grid-row-end': level + 2 + offset,
									}}"
								></div>
							`;
						});
					})}
				${this.getWeekDayEvents().map((weekDay, index) => {
					return html`
						<div
							class="weekday"
							style="${{
								'grid-column-start': (index + 1) * 2,
								'grid-column-end': (index + 1 + 1) * 2,
							}}"
						>
							<div class="day-name">
								${new Intl.DateTimeFormat('nl-NL', {
									weekday: 'short',
								}).format(weekDay.date)}
							</div>
						</div>
					`;
				})}
				${allDayEvents.map((allDayEvents, level) => {
					return html`
						${allDayEvents.map((event) => {
							return html`
								<div
									class="event event-background all-day"
									style="${{
										'background-color': event.color.background,
										'grid-row-start': level + 1 + 1,
										'grid-row-end': level + 2 + 1,
										'grid-column-start': (event.startIndex + 1) * 2,
										'grid-column-end': (event.endIndex + 1) * 2 + 1,
									}}"
								>
									<div class="event-name">${event.summary}</div>
								</div>
							`;
						})}
					`;
				})}
				${allDayEvents.length > 0
					? html`
							<div
								class="all-day-spacer"
								style="${{
									'grid-row-start': allDayEvents.length + 1 + 1,
									'grid-row-end': allDayEvents.length + 1 + 1 + 1,
									'grid-column-start': 2,
									'grid-column-end': 16,
								}}"
							></div>
						`
					: ''}
				${timeSpacedEvents.map((timeslot, level) => {
					return html`
						${timeslot.map((event) => {
							let offset = 2;
							if (allDayEvents.length > 0) {
								offset += allDayEvents.length + 1;
							}
							return html`
								<div
									class="event event-background all-day"
									style="${{
										'background-color': event.color.background,
										'grid-row-start': level + 1 + offset,
										'grid-row-end': level + 2 + offset,
										'grid-column-start': event.columnStart * 2,
										'grid-column-end': event.columnEnd * 2 + 1,
									}}"
								>
									<div class="event-name">${event.summary}</div>
									<div class="event-time">
										${event.startTime} - ${event.endTime}
									</div>
								</div>
							`;
						})}
					`;
				})}
			</div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);
