import type { CalendarEvent } from '../../../server/modules/kiosk/calendar';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { apiGet } from '../../lib/fetch';
import { Home } from './Home';
import React from 'react';

interface TimedEvent extends CalendarEvent {
	startTime: string;
	endTime: string;
}

// Make things bigger when size md is hit
const CLOCK_HEIGHTS = { xs: 65, sm: 65, md: 200 };
const CALENDAR_HEIGHTS = { xs: 120, sm: 120, md: 370 };
const CALENDAR_MARGINS = { xs: 8, sm: 8, md: 16 };

export const Kiosk = (): JSX.Element => {
	const [time, setTime] = React.useState(new Date());
	const [events, setEvents] = React.useState<CalendarEvent[]>([]);
	const theme = useTheme();
	const isMd = useMediaQuery(theme.breakpoints.up('md'));
	const isSm = useMediaQuery(theme.breakpoints.up('sm'));

	const layoutViewVerticalSpacing = React.useMemo(() => {
		if (isMd) {
			return CLOCK_HEIGHTS.md + CALENDAR_HEIGHTS.md + CALENDAR_MARGINS.md;
		}
		if (isSm) {
			return CLOCK_HEIGHTS.sm + CALENDAR_HEIGHTS.sm + CALENDAR_MARGINS.sm;
		}
		return CLOCK_HEIGHTS.xs + CALENDAR_HEIGHTS.xs + CALENDAR_MARGINS.xs;
	}, [isMd, isSm]);

	React.useEffect(() => {
		const interval = setInterval(() => {
			setTime(new Date());
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	React.useEffect(() => {
		const fetchCalendar = async () => {
			try {
				const response = await apiGet('kiosk', '/calendar', {});
				if (!response.ok) {
					return;
				}

				const json = await response.json();
				if (json.success) {
					setEvents(json.events);
				} else if (json.error && json.redirect) {
					window.location.href = json.redirect;
				}
			} catch (error) {
				console.error('Failed to fetch calendar:', error);
			}
		};

		void fetchCalendar();
		const interval = setInterval(
			() => {
				void fetchCalendar();
			},
			1000 * 60 * 60
		);
		return () => clearInterval(interval);
	}, []);

	const getDay = (daysOffset: number): Date => {
		const day = new Date();
		day.setDate(day.getDate() + daysOffset);
		return day;
	};

	const getEndOfDay = (daysOffset: number): Date => {
		const day = getDay(daysOffset);
		day.setHours(23, 59, 59);
		return day;
	};

	const getDays = (): Date[] => {
		return new Array(7).fill('').map((_, index) => getDay(index));
	};

	const getEndsOfDays = (): Date[] => {
		return getDays().map((day) => {
			const copy = new Date(day);
			copy.setHours(23, 59, 59);
			return copy;
		});
	};

	const getDayIndex = (date: Date, weekdays: Date[]): number => {
		if (date < weekdays[0]) {
			return 0;
		}
		for (let i = 1; i < weekdays.length; i++) {
			if (date < weekdays[i]) {
				return i;
			}
		}
		return Infinity;
	};

	const getFormattedAllDayEvents = (): (CalendarEvent & {
		startIndex: number;
		endIndex: number;
	})[][] => {
		const formattedEvents: Map<Date, Map<number, true>> = new Map();
		const days = getDays();
		days.forEach((day) => {
			formattedEvents.set(day, new Map());
		});
		const endsOfDays = getEndsOfDays();

		const levels: (CalendarEvent & {
			startIndex: number;
			endIndex: number;
		})[][] = [];

		for (const event of events) {
			if (event.start?.dateTime || !event.start?.date || !event.end?.date) {
				continue;
			}
			const startIndex = getDayIndex(new Date(event.start?.date), endsOfDays);
			const endIndex = Math.min(
				endsOfDays.length - 1,
				getDayIndex(new Date(event.end?.date), endsOfDays) - 1
			);

			for (let i = 0; ; i++) {
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
	};

	const getWeekDayEvents = (): {
		date: Date;
		events: TimedEvent[];
	}[] => {
		const days = getDays();
		const endsOfDays = getEndsOfDays();
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

		for (const event of events) {
			if (!event.start?.dateTime || !event.end?.dateTime) {
				continue;
			}

			const eventStart = new Date(event.start.dateTime);
			const eventEnd = new Date(event.end.dateTime);

			const startIndex = getDayIndex(eventStart, endsOfDays);
			const endIndex = getDayIndex(eventEnd, endsOfDays);

			if (startIndex === Infinity || endIndex === Infinity) {
				continue;
			}

			if (
				startIndex === endIndex ||
				(startIndex + 1 === endIndex &&
					((eventStart.getHours() > 18 && eventEnd.getHours() < 12) ||
						eventEnd.getHours() < 4))
			) {
				dayEvents[startIndex].events.push({
					...event,
					startTime: formatter.format(eventStart),
					endTime:
						getEndOfDay(startIndex) < eventEnd
							? formatter.format(getEndOfDay(startIndex))
							: formatter.format(eventEnd),
				});
			} else {
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
	};

	const getTimeSpacedEvents = (): (TimedEvent & {
		columnStart: number;
		columnEnd: number;
	})[][] => {
		const weekdayEvents = getWeekDayEvents();
		const max = Math.max(...weekdayEvents.map((weekDay) => weekDay.events.length));

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
	};

	const allDayEvents = React.useMemo(() => getFormattedAllDayEvents(), [events]);
	const timeSpacedEvents = React.useMemo(() => getTimeSpacedEvents(), [events]);
	const weekDayEvents = React.useMemo(() => getWeekDayEvents(), [events]);

	return (
		<Box sx={{ px: { xs: 1, sm: 2, md: 4 } }}>
			<Box
				sx={{
					textAlign: 'center',
					fontSize: { xs: 22, sm: 28, md: 88 },
					fontWeight: 500,
					py: 0.5,
					height: {
						xs: `${CLOCK_HEIGHTS.xs}px`,
						sm: `${CLOCK_HEIGHTS.sm}px`,
						md: `${CLOCK_HEIGHTS.md}px`,
					},
				}}
			>
				<Box
					component="span"
					sx={{
						display: 'block',
						fontSize: { xs: 16, sm: 20, md: 60 },
						fontWeight: 400,
						color: 'text.secondary',
						lineHeight: 1.2,
						mb: 0.2,
					}}
				>
					{time.toLocaleDateString(undefined, {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
					})}
				</Box>
				<Box
					component="span"
					sx={{
						display: 'block',
						fontSize: { xs: 30, sm: 42, md: 128 },
						fontWeight: 600,
						letterSpacing: 1,
						mt: 0.4,
						lineHeight: 1.1,
					}}
				>
					{time.toLocaleTimeString(undefined, {
						hour: '2-digit',
						minute: '2-digit',
						second: '2-digit',
						hour12: false,
					})}
				</Box>
			</Box>
			<Home kiosk layoutViewVerticalSpacing={layoutViewVerticalSpacing} />

			{/* Calendar Overview */}
			<Box
				sx={{
					mt: {
						xs: `${CALENDAR_MARGINS.xs}px`,
						sm: `${CALENDAR_MARGINS.sm}px`,
						md: `${CALENDAR_MARGINS.md}px`,
					},
					mx: '20px',
					display: 'grid',
					gridTemplateColumns: '1px repeat(7, calc((100% - 8px) / 7) 1px)',
					height: {
						xs: `${CALENDAR_HEIGHTS.xs}px`,
						sm: `${CALENDAR_HEIGHTS.sm}px`,
						md: `${CALENDAR_HEIGHTS.md}px`,
					},
					boxSizing: 'border-box',
					gap: 0,
				}}
			>
				{/* Column spacing elements */}
				{new Array(
					timeSpacedEvents.length +
						(allDayEvents.length ? allDayEvents.length + 1 : 0) +
						2
				)
					.fill(null)
					.map((_, level) => {
						return new Array(6).fill(null).map((_, index) => {
							const offset = 0;
							return (
								<Box
									key={`spacing-${level}-${index}`}
									sx={{
										gridColumnStart: (index + 1) * 2 + 1,
										gridColumnEnd: (index + 1) * 2 + 2,
										gridRowStart: level + 1 + offset,
										gridRowEnd: level + 2 + offset,
										backgroundColor: 'white',
									}}
								/>
							);
						});
					})}

				{/* Weekday headers */}
				{weekDayEvents.map((weekDay, index) => (
					<Box
						key={`weekday-${index}`}
						sx={{
							gridColumnStart: (index + 1) * 2,
							gridColumnEnd: (index + 2) * 2,
							gridRowStart: 1,
							gridRowEnd: 1,
							overflow: 'hidden',
							borderBottom: '1px solid white',
							fontSize: { xs: '0.7rem', sm: '0.85rem', md: '1.7rem' },
							fontWeight: 'bold',
							textAlign: 'center',
							textTransform: 'uppercase',
						}}
					>
						{new Intl.DateTimeFormat('nl-NL', {
							weekday: 'short',
						}).format(weekDay.date)}
					</Box>
				))}

				{/* All-day events */}
				{allDayEvents.map((dayEvents, level) =>
					dayEvents.map((event, idx) => (
						<Box
							key={`allday-${level}-${idx}`}
							sx={{
								gridRowStart: level + 2,
								gridRowEnd: level + 3,
								gridColumnStart: (event.startIndex + 1) * 2,
								gridColumnEnd: (event.endIndex + 1) * 2 + 1,
								backgroundColor: event.color.background,
								borderBottom: '1px solid black',
								padding: { xs: '2px', md: '6px 4px' },
								wordBreak: 'break-word',
								fontSize: { xs: '0.5rem', sm: '0.8rem', md: '1.05rem' },
							}}
						>
							<Box sx={{ fontWeight: 'bold', color: 'black' }}>{event.summary}</Box>
						</Box>
					))
				)}

				{/* Spacer between all-day and timed events */}
				{allDayEvents.length > 0 && (
					<Box
						sx={{
							gridRowStart: allDayEvents.length + 2,
							gridRowEnd: allDayEvents.length + 3,
							gridColumnStart: 2,
							gridColumnEnd: 16,
							borderBottom: '1px solid rgba(255, 255, 255, 0.23)',
						}}
					/>
				)}

				{/* Timed events */}
				{timeSpacedEvents.map((timeslot, level) =>
					timeslot.map((event, idx) => {
						const offset = allDayEvents.length > 0 ? allDayEvents.length + 1 : 0;
						return (
							<Box
								key={`timed-${level}-${idx}`}
								sx={{
									gridRowStart: level + 2 + offset,
									gridRowEnd: level + 3 + offset,
									gridColumnStart: event.columnStart * 2,
									gridColumnEnd: event.columnEnd * 2 + 1,
									backgroundColor: event.color.background,
									borderBottom: '1px solid black',
									padding: { xs: '2px', md: '6px 4px' },
									wordBreak: 'break-word',
									fontSize: { xs: '0.5rem', sm: '0.8rem', md: '1.05rem' },
									lineHeight: 1,
								}}
							>
								<Box sx={{ fontWeight: 'bold', color: 'black' }}>
									{event.summary}
								</Box>
								<Box
									sx={{
										color: 'black',
										fontSize: { xs: '0.35rem', sm: '0.5rem', md: '0.75rem' },
									}}
								>
									{event.startTime} - {event.endTime}
								</Box>
							</Box>
						);
					})
				)}
			</Box>
		</Box>
	);
};
