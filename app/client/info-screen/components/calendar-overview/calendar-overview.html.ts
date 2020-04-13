import {
	TemplateFn,
	CHANGE_TYPE
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { CalendarOverview } from './calendar-overview.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const CalendarOverviewHTML = new TemplateFn<CalendarOverview>(
	function(html) {
		return html`
			<div id="container">
				<table id="table">
					<tbody>
						<tr>
							${this.getWeekDayEvents().map(weekDay => {
								return html`
									<th class="weekday">
										<div class="day-name">
											${new Intl.DateTimeFormat('nl-NL', {
												weekday: 'short'
											}).format(weekDay.date)}
										</div>
									</th>
								`;
							})}
						</tr>
						${this.getTimeSpacedEvents().map(timeslot => {
							return html`
								<tr>
									${timeslot.map(event => {
										if (!event)
											return html`
												<td class="event empty"></td>
											`;
										const colorStyle = `background-color: ${
											event!.color.background
										};`;
										return html`
											<td class="event">
												<div
													class="event-background"
													style="${colorStyle}"
												>
													<div class="event-name">
														${event.summary}
													</div>
													${event.location &&
														html`
															<div
																class="event-location"
															>
																${event.location}
															</div>
														`}
												</div>
											</td>
										`;
									})}
								</tr>
							`;
						})}
					</tbody>
				</table>
			</div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);
