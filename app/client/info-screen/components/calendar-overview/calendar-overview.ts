import {
	Props,
	config,
	ComplexType,
	ConfigurableWebComponent
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
	html: CalendarOverviewHTML
})
export class CalendarOverview extends ConfigurableWebComponent<{
	events: {
		propChange: {
			args: [string, any, any];
		};
	};
}> {
	props = Props.define(this, {
		priv: {
			events: {
				type: ComplexType<ExtendedEvent[]>(),
				value: []
			}
		}
	});

	getDay(daysOffset: number) {
		const day = new Date();
		day.setDate(day.getDate() + daysOffset);
		return day;
	}

	getEndOfDay(daysOffset: number) {
		const day = this.getDay(daysOffset);
		day.setHours(23, 59, 59);
		return day;
	}

	getStartOfDay(daysOffset: number) {
		const day = this.getDay(daysOffset);
		day.setHours(0, 0, 0);
		return day;
	}

	getDayIndex(date: Date, weekdays: Date[]) {
		if (date < weekdays[0]) return 0;
		for (let i = 1; i < weekdays.length; i++) {
			if (date < weekdays[i]) {
				return i;
			}
		}
		return weekdays.length - 1;
	}

	getTimeSpacedEvents() {
		const weekdayEvents = this.getWeekDayEvents();
		const max = Math.max(
			...weekdayEvents.map(weekDay => weekDay.events.length)
		);

		const arr: (TimedEvent | null)[][] = new Array(max)
			.fill('')
			.map(_ => new Array(7).fill(null));
		for (let i = 0; i < arr.length; i++) {
			for (let j = 0; j < 7; j++) {
				arr[i][j] = weekdayEvents[j].events[i] || null;
			}
		}
		return arr;
	}

	getWeekDayEvents() {
		const days = new Array(7).fill('').map((_, index) => {
			return this.getDay(index);
		});
		const endsOfDays = days.map(day => {
			const copy = new Date(day);
			copy.setHours(23, 59, 59);
			return copy;
		});
		const dayEvents: {
			date: Date;
			events: TimedEvent[];
		}[] = days.map(d => ({
			date: d,
			events: []
		}));
		const formatter = new Intl.DateTimeFormat('nl-NL', {
			hour: '2-digit',
			minute: '2-digit'
		});
		debugger;
		for (const event of this.props.events) {
			const eventStart = new Date(event.start?.dateTime || 0);
			const eventEnd = new Date(event.end?.dateTime || 0);

			const startIndex = this.getDayIndex(eventStart, endsOfDays);
			const endIndex = this.getDayIndex(eventEnd, endsOfDays);

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
							: formatter.format(eventEnd)
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
								: formatter.format(eventEnd)
					});
				}
			}
		}

		dayEvents.forEach(({ events }) => {
			events.sort((a, b) => {
				const aDate = new Date(a.start!.dateTime!);
				const bDate = new Date(b.start!.dateTime!);
				if (aDate < bDate) return -1;
				if (aDate === bDate) return 0;
				return 1;
			});
		});

		console.log(dayEvents);

		return dayEvents;
	}

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

	async updateCalendar() {
		const response = await this.request(`${location.origin}/calendar`, {});
		if (!response) {
			return;
		}
		const { events } = await response.json();
		this.props.events = events;
	}

	setup() {
		this.updateCalendar();
		setInterval(() => {
			this.updateCalendar();
		}, 1000 * 60 * 60);
	}

	mounted() {
		this.setup();
	}
}
