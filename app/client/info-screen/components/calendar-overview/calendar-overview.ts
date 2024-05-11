import {
	Props,
	config,
	ComplexType,
	ConfigurableWebComponent,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { calendar_v3 } from 'googleapis/build/src/apis/calendar/v3';
import { CalendarOverviewHTML } from './calendar-overview.html.js';
import { CalendarOverviewCSS } from './calendar-overview.css.js';

interface ExtendedEvent extends calendar_v3.Schema$Event {
	color: {
		background: string;
		foreground: string;
	};
}

interface TimedEvent extends ExtendedEvent {
	startTime: string;
	endTime: string;
}

@config({
	is: 'calendar-overview',
	css: CalendarOverviewCSS,
	html: CalendarOverviewHTML,
})
export class CalendarOverview extends ConfigurableWebComponent<{
	events: {
		propChange: {
			args: [string, unknown, unknown];
		};
	};
}> {
	public props = Props.define(this, {
		priv: {
			events: {
				type: ComplexType<ExtendedEvent[]>(),
				value: [],
			},
		},
	});

	private _getDays() {
		return new Array(7).fill('').map((_, index) => {
			return this.getDay(index);
		});
	}

	private _getEndsOfDays() {
		return this._getDays().map((day) => {
			const copy = new Date(day);
			copy.setHours(23, 59, 59);
			return copy;
		});
	}

	public getDay(daysOffset: number): Date {
		const day = new Date();
		day.setDate(day.getDate() + daysOffset);
		return day;
	}

	public getEndOfDay(daysOffset: number): Date {
		const day = this.getDay(daysOffset);
		day.setHours(23, 59, 59);
		return day;
	}

	public getStartOfDay(daysOffset: number): Date {
		const day = this.getDay(daysOffset);
		day.setHours(0, 0, 0);
		return day;
	}

	public getDayIndex(date: Date, weekdays: Date[]): number {
		if (date < weekdays[0]) {
			return 0;
		}
		for (let i = 1; i < weekdays.length; i++) {
			if (date < weekdays[i]) {
				return i;
			}
		}
		return Infinity;
	}

	public getTimeSpacedEvents(): (TimedEvent & {
		columnStart: number;
		columnEnd: number;
	})[][] {
		const weekdayEvents = this.getWeekDayEvents();
		const max = Math.max(
			...weekdayEvents.map((weekDay) => weekDay.events.length)
		);

		const arr: (TimedEvent & {
			columnStart: number;
			columnEnd: number;
		})[][] = new Array(max).fill('').map(() => []);
		for (let i = 0; i < arr.length; i++) {
			for (let j = 0; j < 7; j++) {
				const event = weekdayEvents[j].events[i];
				if (event?.startTime) {
					arr[i].push({
						...weekdayEvents[j].events[i],
						columnStart: j + 1,
						columnEnd: j + 1,
					});
				}
			}
		}
		return arr;
	}

	public getFormattedAllDayEvents(): (ExtendedEvent & {
		startIndex: number;
		endIndex: number;
	})[][] {
		const formattedEvents: Map<Date, Map<number, true>> = new Map();
		const days = this._getDays();
		days.forEach((day) => {
			formattedEvents.set(day, new Map());
		});
		const endsOfDays = this._getEndsOfDays();

		const events = this.props.events;
		const levels: (ExtendedEvent & {
			startIndex: number;
			endIndex: number;
		})[][] = [];
		for (const event of events) {
			if (
				event.start?.dateTime ||
				!event.start?.date ||
				!event.end?.date
			) {
				continue;
			}
			const startIndex = this.getDayIndex(
				new Date(event.start?.date),
				endsOfDays
			);
			const endIndex = Math.min(
				endsOfDays.length - 1,
				this.getDayIndex(new Date(event.end?.date), endsOfDays) - 1
			);

			for (let i = 0; ; i++) {
				// Check if there is already an event that overlaps on this level
				let levelTaken = false;
				for (let j = startIndex; j < endIndex + 1; j++) {
					if (formattedEvents.get(days[j])!.has(i)) {
						levelTaken = true;
						break;
					}
				}

				if (!levelTaken) {
					levels[i] = levels[i] || [];
					levels[i].push({
						...event,
						startIndex,
						endIndex,
					});
					for (let k = 0; k < days.length; k++) {
						if (k >= startIndex && k <= endIndex) {
							formattedEvents.get(days[k])!.set(i, true);
						}
					}
					break;
				}
			}
		}

		return levels;
	}

	public getWeekDayEvents(): {
		date: Date;
		events: TimedEvent[];
	}[] {
		const days = this._getDays();
		const endsOfDays = this._getEndsOfDays();
		const dayEvents: {
			date: Date;
			events: TimedEvent[];
		}[] = days.map((d) => ({
			date: d,
			events: [],
		}));
		const formatter = new Intl.DateTimeFormat('nl-NL', {
			hour: '2-digit',
			minute: '2-digit',
		});
		for (const event of this.props.events) {
			if (!event.start?.dateTime || !event.end?.dateTime) {
				continue;
			}

			const eventStart = new Date(event.start.dateTime);
			const eventEnd = new Date(event.end.dateTime);

			const startIndex = this.getDayIndex(eventStart, endsOfDays);
			const endIndex = this.getDayIndex(eventEnd, endsOfDays);

			if (startIndex === Infinity || endIndex === Infinity) {
				continue;
			}

			if (
				// If the event is either on the same day
				startIndex === endIndex ||
				// Or the next day
				(startIndex + 1 === endIndex &&
					// Starting after 18:00 and ending before 12:00
					((eventStart.getHours() > 18 && eventEnd.getHours() < 12) ||
						// Or just ending before 4 again
						eventEnd.getHours() < 4))
			) {
				// Single-day event
				dayEvents[startIndex].events.push({
					...event,
					startTime: formatter.format(eventStart),
					endTime:
						this.getEndOfDay(startIndex) < eventEnd
							? formatter.format(this.getEndOfDay(startIndex))
							: formatter.format(eventEnd),
				});
			} else {
				// Multi-day event
				for (let i = startIndex; i <= endIndex; i++) {
					dayEvents[i].events.push({
						...event,
						startTime:
							days[i] > eventStart
								? formatter.format(days[i])
								: formatter.format(eventStart),
						endTime:
							endsOfDays[i] < eventEnd
								? formatter.format(endsOfDays[i])
								: formatter.format(eventEnd),
					});
				}
			}
		}

		dayEvents.forEach(({ events }) => {
			events.sort((a, b) => {
				const aDate = new Date(a.start!.dateTime!);
				const bDate = new Date(b.start!.dateTime!);
				if (aDate < bDate) {
					return -1;
				}
				if (aDate === bDate) {
					return 0;
				}
				return 1;
			});
		});

		return dayEvents;
	}

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

	public async updateCalendar(): Promise<void> {
		const response = await this.request(`${location.origin}/calendar`, {});
		if (!response) {
			return;
		}
		const { events } = await response.json();
		this.props.events = events;
	}

	public async setup(): Promise<void> {
		await this.updateCalendar();
		setInterval(
			() => {
				void this.updateCalendar();
			},
			1000 * 60 * 60
		);
	}

	public async mounted(): Promise<void> {
		await this.setup();
	}
}
