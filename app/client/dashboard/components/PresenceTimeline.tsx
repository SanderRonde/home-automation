import {
	Box,
	Typography,
	ToggleButtonGroup,
	ToggleButton,
	Tooltip,
	Chip,
	CircularProgress,
} from '@mui/material';
import { HOME_STATE } from '../../../server/modules/home-detector/types';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { apiGet } from '../../lib/fetch';

type Timeframe = '24h' | '1week' | '1month';

const TIMEFRAME_MS: Record<Timeframe, number> = {
	'24h': 24 * 60 * 60 * 1000,
	'1week': 7 * 24 * 60 * 60 * 1000,
	'1month': 30 * 24 * 60 * 60 * 1000,
};

// How many events to request per timeframe
const TIMEFRAME_LIMITS: Record<Timeframe, number> = {
	'24h': 500,
	'1week': 2000,
	'1month': 5000,
};

interface EventHistoryItem {
	id: number;
	host_name: string;
	state: string;
	timestamp: number;
	trigger_type?: string | null;
	scenes_triggered?: string | null;
}

interface PresenceSegment {
	state: 'HOME' | 'AWAY';
	startTime: number;
	endTime: number;
}

interface TimelineRow {
	hostName: string;
	segments: PresenceSegment[];
	currentState: HOME_STATE;
}

interface PresenceTimelineProps {
	hostsState: Record<string, HOME_STATE>;
	hosts: Array<{ name: string }>;
}

function formatDuration(ms: number): string {
	const hours = Math.floor(ms / (1000 * 60 * 60));
	const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

	if (hours > 24) {
		const days = Math.floor(hours / 24);
		const remainingHours = hours % 24;
		return `${days}d ${remainingHours}h`;
	}
	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
}

function formatTime(timestamp: number, timeframe: Timeframe): string {
	const date = new Date(timestamp);
	if (timeframe === '24h') {
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
		});
	}
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function getTimeAxisLabels(
	startTime: number,
	endTime: number,
	timeframe: Timeframe
): Array<{ time: number; label: string }> {
	const labels: Array<{ time: number; label: string }> = [];

	let interval: number;
	let formatFn: (date: Date) => string;

	if (timeframe === '24h') {
		interval = 4 * 60 * 60 * 1000; // 4 hours
		formatFn = (date) =>
			date.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
			});
	} else if (timeframe === '1week') {
		interval = 24 * 60 * 60 * 1000; // 1 day
		formatFn = (date) =>
			date.toLocaleDateString('en-US', {
				weekday: 'short',
			});
	} else {
		interval = 7 * 24 * 60 * 60 * 1000; // 1 week
		formatFn = (date) =>
			date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
			});
	}

	// Start from the first interval boundary after startTime
	const firstLabel = Math.ceil(startTime / interval) * interval;
	for (let t = firstLabel; t <= endTime; t += interval) {
		labels.push({
			time: t,
			label: formatFn(new Date(t)),
		});
	}

	return labels;
}

export const PresenceTimeline = ({ hostsState, hosts }: PresenceTimelineProps): JSX.Element => {
	const [timeframe, setTimeframe] = useState<Timeframe>('24h');
	const [events, setEvents] = useState<EventHistoryItem[]>([]);
	const [loading, setLoading] = useState(true);

	const loadEventHistory = useCallback(async (limit: number) => {
		setLoading(true);
		try {
			const response = await apiGet(
				'home-detector',
				`/events/history?limit=${limit}` as '/events/history',
				{}
			);
			if (response.ok) {
				const data = await response.json();
				setEvents(data.events || []);
			}
		} catch (error) {
			console.error('Failed to load event history:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	// Reload events when timeframe changes
	useEffect(() => {
		const limit = TIMEFRAME_LIMITS[timeframe];
		void loadEventHistory(limit);
	}, [timeframe, loadEventHistory]);

	const { timelineData, timeRange } = useMemo(() => {
		const now = Date.now();
		const timeframeMs = TIMEFRAME_MS[timeframe];
		const startTime = now - timeframeMs;
		const endTime = now;

		// Get all unique host names from both hosts config and events
		const hostNames = new Set<string>();
		for (const host of hosts) {
			hostNames.add(host.name);
		}

		// Filter events within timeframe and exclude system events
		const filteredEvents = events.filter(
			(e) =>
				e.timestamp >= startTime &&
				e.host_name !== 'system' &&
				(e.state.toLowerCase() === 'home' || e.state.toLowerCase() === 'away')
		);

		// Add hosts from events that might not be in current config
		for (const event of filteredEvents) {
			hostNames.add(event.host_name);
		}

		// Build timeline data for each host
		const timelineRows: TimelineRow[] = [];

		for (const hostName of hostNames) {
			// Get events for this host, sorted by timestamp ascending
			const hostEvents = filteredEvents
				.filter((e) => e.host_name === hostName)
				.sort((a, b) => a.timestamp - b.timestamp);

			const segments: PresenceSegment[] = [];
			const currentState = hostsState[hostName] ?? HOME_STATE.AWAY;

			if (hostEvents.length === 0) {
				// No events in this timeframe - show current state for entire period
				segments.push({
					state: currentState === HOME_STATE.HOME ? 'HOME' : 'AWAY',
					startTime,
					endTime,
				});
			} else {
				// Determine the state at the start of the timeframe
				// Find the most recent event before the timeframe
				const eventsBeforeTimeframe = events
					.filter(
						(e) =>
							e.host_name === hostName &&
							e.timestamp < startTime &&
							(e.state.toLowerCase() === 'home' || e.state.toLowerCase() === 'away')
					)
					.sort((a, b) => b.timestamp - a.timestamp);

				let initialState: 'HOME' | 'AWAY';
				if (eventsBeforeTimeframe.length > 0) {
					initialState =
						eventsBeforeTimeframe[0].state.toLowerCase() === 'home' ? 'HOME' : 'AWAY';
				} else {
					// No prior events, assume opposite of first event in timeframe
					initialState = hostEvents[0].state.toLowerCase() === 'home' ? 'AWAY' : 'HOME';
				}

				// Build segments
				let currentSegmentStart = startTime;
				let currentSegmentState = initialState;

				for (const event of hostEvents) {
					const eventState = event.state.toLowerCase() === 'home' ? 'HOME' : 'AWAY';

					if (eventState !== currentSegmentState) {
						// State changed - close current segment and start new one
						if (event.timestamp > currentSegmentStart) {
							segments.push({
								state: currentSegmentState,
								startTime: currentSegmentStart,
								endTime: event.timestamp,
							});
						}
						currentSegmentStart = event.timestamp;
						currentSegmentState = eventState;
					}
				}

				// Close the final segment to the end of the timeframe
				segments.push({
					state: currentSegmentState,
					startTime: currentSegmentStart,
					endTime,
				});
			}

			timelineRows.push({
				hostName,
				segments,
				currentState,
			});
		}

		return {
			timelineData: timelineRows,
			timeRange: { startTime, endTime },
		};
	}, [events, hostsState, hosts, timeframe]);

	const timeAxisLabels = useMemo(
		() => getTimeAxisLabels(timeRange.startTime, timeRange.endTime, timeframe),
		[timeRange, timeframe]
	);

	const totalDuration = timeRange.endTime - timeRange.startTime;

	// Header component (reused in multiple places)
	const header = (
		<Box
			sx={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				mb: 3,
				flexWrap: 'wrap',
				gap: 2,
			}}
		>
			<Box>
				<Typography variant="h6">Presence Timeline</Typography>
				<Typography variant="body2" color="text.secondary">
					Visual history of home/away states
				</Typography>
			</Box>
			<ToggleButtonGroup
				value={timeframe}
				exclusive
				onChange={(_, value) => value && setTimeframe(value)}
				size="small"
			>
				<ToggleButton value="24h">24h</ToggleButton>
				<ToggleButton value="1week">1 week</ToggleButton>
				<ToggleButton value="1month">1 month</ToggleButton>
			</ToggleButtonGroup>
		</Box>
	);

	if (loading) {
		return (
			<Box>
				{header}
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center',
						height: '200px',
					}}
				>
					<CircularProgress />
				</Box>
			</Box>
		);
	}

	if (timelineData.length === 0) {
		return (
			<Box>
				{header}
				<Typography
					variant="body2"
					color="text.secondary"
					textAlign="center"
					sx={{ py: 4 }}
				>
					No devices configured. Add hosts in the Devices tab to see presence timeline.
				</Typography>
			</Box>
		);
	}

	return (
		<Box>
			{header}

			{/* Legend */}
			<Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
					<Box
						sx={{
							width: 16,
							height: 16,
							borderRadius: 0.5,
							bgcolor: 'success.main',
						}}
					/>
					<Typography variant="caption" color="text.secondary">
						Home
					</Typography>
				</Box>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
					<Box
						sx={{
							width: 16,
							height: 16,
							borderRadius: 0.5,
							bgcolor: 'action.disabled',
						}}
					/>
					<Typography variant="caption" color="text.secondary">
						Away
					</Typography>
				</Box>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
					<Box
						sx={{
							width: 0,
							height: 0,
							borderLeft: '5px solid transparent',
							borderRight: '5px solid transparent',
							borderBottom: '6px solid #4caf50',
						}}
					/>
					<Typography variant="caption" color="text.secondary">
						Arrived
					</Typography>
				</Box>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
					<Box
						sx={{
							width: 0,
							height: 0,
							borderLeft: '5px solid transparent',
							borderRight: '5px solid transparent',
							borderTop: '6px solid #f44336',
						}}
					/>
					<Typography variant="caption" color="text.secondary">
						Left
					</Typography>
				</Box>
			</Box>

			{/* Timeline rows */}
			<Box
				sx={{
					display: 'flex',
					flexDirection: 'column',
					gap: 1.5,
					mb: 1,
				}}
			>
				{timelineData.map((row) => (
					<Box
						key={row.hostName}
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 2,
						}}
					>
						{/* Host name label */}
						<Box
							sx={{
								width: 100,
								flexShrink: 0,
								display: 'flex',
								alignItems: 'center',
								gap: 1,
							}}
						>
							<Typography
								variant="body2"
								sx={{
									fontWeight: 500,
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap',
								}}
							>
								{row.hostName}
							</Typography>
						</Box>

						{/* Timeline bar */}
						<Box
							sx={{
								flex: 1,
								position: 'relative',
								height: 32,
								borderRadius: 1,
								overflow: 'visible',
								bgcolor: 'background.paper',
								border: '1px solid',
								borderColor: 'divider',
							}}
						>
							{/* Segment bars */}
							<Box
								sx={{
									display: 'flex',
									height: '100%',
									borderRadius: 1,
									overflow: 'hidden',
								}}
							>
								{row.segments.map((segment, idx) => {
									const segmentDuration = segment.endTime - segment.startTime;
									const widthPercent = (segmentDuration / totalDuration) * 100;

									// Skip very tiny segments that wouldn't be visible
									if (widthPercent < 0.1) {
										return null;
									}

									const isHome = segment.state === 'HOME';
									const isShortSegment = widthPercent < 2;
									const tooltipContent = (
										<Box>
											<Typography variant="body2" fontWeight={500}>
												{isHome ? 'Home' : 'Away'}
											</Typography>
											<Typography variant="caption" display="block">
												From: {formatTime(segment.startTime, timeframe)}
											</Typography>
											<Typography variant="caption" display="block">
												To: {formatTime(segment.endTime, timeframe)}
											</Typography>
											<Typography variant="caption" display="block">
												Duration: {formatDuration(segmentDuration)}
											</Typography>
										</Box>
									);

									return (
										<Tooltip
											key={idx}
											title={tooltipContent}
											arrow
											placement="top"
											enterDelay={200}
										>
											<Box
												sx={{
													width: `${widthPercent}%`,
													// Ensure short segments have minimum visible width
													minWidth: isShortSegment ? 4 : 0,
													height: '100%',
													bgcolor: isHome
														? 'success.main'
														: 'action.disabled',
													transition: 'opacity 0.2s',
													cursor: 'pointer',
													'&:hover': {
														opacity: 0.8,
													},
												}}
											/>
										</Tooltip>
									);
								})}
							</Box>

							{/* Transition markers - small triangles at state change points */}
							{row.segments.slice(1).map((segment, idx) => {
								const position =
									((segment.startTime - timeRange.startTime) / totalDuration) *
									100;
								const isArrivingHome = segment.state === 'HOME';
								const prevSegment = row.segments[idx];

								const tooltipContent = (
									<Box>
										<Typography variant="body2" fontWeight={500}>
											{isArrivingHome ? 'Arrived home' : 'Left home'}
										</Typography>
										<Typography variant="caption" display="block">
											{formatTime(segment.startTime, timeframe)}
										</Typography>
										{prevSegment && (
											<Typography variant="caption" display="block">
												Was {isArrivingHome ? 'away' : 'home'} for:{' '}
												{formatDuration(
													prevSegment.endTime - prevSegment.startTime
												)}
											</Typography>
										)}
									</Box>
								);

								return (
									<Tooltip
										key={`marker-${idx}`}
										title={tooltipContent}
										arrow
										placement="top"
									>
										<Box
											sx={{
												position: 'absolute',
												left: `${position}%`,
												top: isArrivingHome ? -6 : 'auto',
												bottom: isArrivingHome ? 'auto' : -6,
												transform: 'translateX(-50%)',
												width: 0,
												height: 0,
												borderLeft: '5px solid transparent',
												borderRight: '5px solid transparent',
												borderTop: isArrivingHome
													? 'none'
													: '6px solid #f44336',
												borderBottom: isArrivingHome
													? '6px solid #4caf50'
													: 'none',
												cursor: 'pointer',
												zIndex: 1,
												'&:hover': {
													borderTopColor: isArrivingHome
														? 'transparent'
														: '#ff7961',
													borderBottomColor: isArrivingHome
														? '#80e27e'
														: 'transparent',
												},
											}}
										/>
									</Tooltip>
								);
							})}
						</Box>

						{/* Current state indicator */}
						<Chip
							label={row.currentState === HOME_STATE.HOME ? 'Home' : 'Away'}
							color={row.currentState === HOME_STATE.HOME ? 'success' : 'default'}
							size="small"
							sx={{ minWidth: 60 }}
						/>
					</Box>
				))}
			</Box>

			{/* Time axis */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'flex-start',
					gap: 2,
					mt: 0.5,
				}}
			>
				{/* Spacer for label column */}
				<Box sx={{ width: 100, flexShrink: 0 }} />

				{/* Time labels */}
				<Box
					sx={{
						flex: 1,
						position: 'relative',
						height: 20,
					}}
				>
					{timeAxisLabels.map((label, idx) => {
						const position = ((label.time - timeRange.startTime) / totalDuration) * 100;
						return (
							<Typography
								key={idx}
								variant="caption"
								color="text.secondary"
								sx={{
									position: 'absolute',
									left: `${position}%`,
									transform: 'translateX(-50%)',
									whiteSpace: 'nowrap',
								}}
							>
								{label.label}
							</Typography>
						);
					})}
				</Box>

				{/* Spacer for status chip column */}
				<Box sx={{ minWidth: 60 }} />
			</Box>
		</Box>
	);
};
