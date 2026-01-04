import {
	DeviceThermostat as DeviceThermostatIcon,
	ExpandMore as ExpandMoreIcon,
	LocalFireDepartment as FireIcon,
	Add as AddIcon,
	Remove as RemoveIcon,
	Schedule as ScheduleIcon,
} from '@mui/icons-material';
import {
	Box,
	Card,
	CardContent,
	Typography,
	CircularProgress,
	IconButton,
	Collapse,
	Slider,
} from '@mui/material';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

interface ThermostatData {
	configured: boolean;
	deviceId?: string;
	currentTemperature?: number;
	targetTemperature?: number;
	hardwareTargetTemperature?: number;
	isHeating?: boolean;
	mode?: string;
}

interface NextScheduleData {
	hasNext: boolean;
	nextTriggerTime?: string;
	targetTemperature?: number;
	averageTargetTemperature?: number;
	name?: string;
}

interface RoomStatus {
	name: string;
	currentTemperature: number;
	targetTemperature: number;
	isHeating: boolean;
	overrideActive: boolean;
}

interface TemperatureDisplayProps {
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
	kiosk?: boolean;
}

export const TemperatureDisplay = (props: TemperatureDisplayProps): JSX.Element => {
	const [temperature, setTemperature] = useState<number | null>(null);
	const [thermostatData, setThermostatData] = useState<ThermostatData | null>(null);
	const [loading, setLoading] = useState(true);
	const [newTarget, setNewTarget] = useState<number | null>(null);
	const [updating, setUpdating] = useState(false);
	const [nextSchedule, setNextSchedule] = useState<NextScheduleData | null>(null);
	const [timeUntilNext, setTimeUntilNext] = useState<string>('');
	const [averageTarget, setAverageTarget] = useState<number | null>(null);

	const [activeState, setActiveState] = useState<{
		state: { id: string; name: string } | null;
		activeStateId: string | null;
	} | null>(null);

	const loadData = useCallback(async () => {
		try {
			const [
				tempResponse,
				thermostatResponse,
				scheduleResponse,
				roomsResponse,
				activeStateResponse,
			] = await Promise.all([
				apiGet('temperature', '/inside-temperature', {}),
				apiGet('temperature', '/central-thermostat', {}),
				apiGet('temperature', '/schedule/next', {}),
				apiGet('temperature', '/rooms', {}),
				apiGet('temperature', '/states/active', {}),
			]);

			if (tempResponse.ok) {
				const data = await tempResponse.json();
				setTemperature(data.temperature);
			}

			if (thermostatResponse.ok) {
				const data = await thermostatResponse.json();
				setThermostatData(data);
				// Initialize slider with the configured global target
				if (data.configured && data.targetTemperature !== undefined) {
					setNewTarget(data.targetTemperature);
				}
			}

			if (scheduleResponse.ok) {
				const data = await scheduleResponse.json();
				setNextSchedule(data);
			}

			if (roomsResponse.ok) {
				const data = await roomsResponse.json();
				if (data.rooms && data.rooms.length > 0) {
					const avg =
						data.rooms.reduce(
							(acc: number, r: RoomStatus) => acc + r.targetTemperature,
							0
						) / data.rooms.length;
					setAverageTarget(avg);
				} else if (thermostatResponse.ok) {
					// Fallback to global target if no rooms
					const tData = await thermostatResponse.json();
					if (tData.configured && 'targetTemperature' in tData) {
						setAverageTarget(tData.targetTemperature);
					}
				}
			}

			if (activeStateResponse.ok) {
				const data = await activeStateResponse.json();
				setActiveState({
					state: data.state,
					activeStateId: data.activeStateId,
				});
			}
		} catch (error) {
			console.error('Failed to load temperature data:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadData();
		// Update temperature every 60 seconds
		const interval = setInterval(() => {
			void loadData();
		}, 60000);
		return () => clearInterval(interval);
	}, [loadData]);

	// Update time until next schedule every minute
	useEffect(() => {
		const updateTimeUntilNext = () => {
			if (!nextSchedule?.hasNext || !nextSchedule.nextTriggerTime) {
				setTimeUntilNext('');
				return;
			}

			const nextTime = new Date(nextSchedule.nextTriggerTime);
			const now = new Date();
			const diffMs = nextTime.getTime() - now.getTime();

			if (diffMs <= 0) {
				// Schedule has passed, reload data
				void loadData();
				return;
			}

			const diffMins = Math.floor(diffMs / 60000);
			const diffHours = Math.floor(diffMins / 60);
			const remainingMins = diffMins % 60;

			if (diffHours > 24) {
				const days = Math.floor(diffHours / 24);
				setTimeUntilNext(`in ${days}d ${diffHours % 24}h`);
			} else if (diffHours > 0) {
				setTimeUntilNext(`in ${diffHours}h ${remainingMins}m`);
			} else {
				setTimeUntilNext(`in ${diffMins}m`);
			}
		};

		updateTimeUntilNext();
		const interval = setInterval(updateTimeUntilNext, 60000);
		return () => clearInterval(interval);
	}, [nextSchedule, loadData]);

	const formatNextScheduleTime = (): string => {
		if (!nextSchedule?.hasNext || !nextSchedule.nextTriggerTime) {
			return '';
		}
		const nextTime = new Date(nextSchedule.nextTriggerTime);
		return nextTime.toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		});
	};

	const handleToggle = () => {
		props.onExpandedChange(!props.expanded);
	};

	// Debounced temperature update
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingTargetRef = useRef<number | null>(null);

	const sendTemperatureUpdate = useCallback(async (targetTemp: number) => {
		setUpdating(true);
		try {
			const response = await apiPost(
				'temperature',
				'/central-thermostat',
				{},
				{ targetTemperature: targetTemp }
			);
			if (response.ok) {
				const data = await response.json();
				if (data.success) {
					setThermostatData({
						...data,
						configured: true,
					});
				}
			}
		} catch (error) {
			console.error('Failed to update target temperature:', error);
		} finally {
			setUpdating(false);
		}
	}, []);

	const debouncedSetTemperature = useCallback(
		(targetTemp: number) => {
			pendingTargetRef.current = targetTemp;

			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}

			debounceTimerRef.current = setTimeout(() => {
				if (pendingTargetRef.current !== null) {
					void sendTemperatureUpdate(pendingTargetRef.current);
					pendingTargetRef.current = null;
				}
			}, 1000);
		},
		[sendTemperatureUpdate]
	);

	// Cleanup debounce timer on unmount
	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	const handleTargetChange = (delta: number) => {
		if (newTarget === null) {
			return;
		}

		const updatedTarget = Math.round((newTarget + delta) * 2) / 2; // Round to 0.5
		const clampedTarget = Math.max(5, Math.min(30, updatedTarget));
		setNewTarget(clampedTarget);
		debouncedSetTemperature(clampedTarget);
	};

	const handleSliderChange = (_event: Event, value: number | number[]) => {
		const targetValue = value as number;
		setNewTarget(targetValue);
		debouncedSetTemperature(targetValue);
	};

	const formatTemp = (temp: number | null | undefined): string => {
		if (temp === null || temp === undefined) {
			return '--';
		}
		return `${Math.round(temp * 10) / 10}`;
	};

	const hasThermostat = thermostatData?.configured && !!thermostatData.deviceId;

	return (
		<Box>
			<Card
				sx={{
					pointerEvents: 'auto',
					borderRadius: 4,
					boxShadow: 3,
					transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
					transform: props.expanded ? 'scale(1.02)' : 'scale(1)',
				}}
			>
				<CardContent
					sx={{
						display: 'flex',
						flexDirection: 'column',
						py: { xs: 1, sm: 1.5 },
						px: { xs: 1.5, sm: 2 },
						'&:last-child': {
							pb: { xs: 1, sm: 1.5 },
						},
					}}
				>
					{/* Main row */}
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						<DeviceThermostatIcon
							color="primary"
							sx={{
								fontSize: { xs: 24, sm: 28 },
							}}
						/>
						{loading ? (
							<CircularProgress size={20} />
						) : (
							<Box
								sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}
							>
								{/* Average temperature */}
								<Typography
									variant="h6"
									sx={{ fontWeight: 600 }}
									title="Average temperature"
								>
									{formatTemp(temperature)}°
								</Typography>

								{/* Thermostat info */}
								{hasThermostat && (
									<>
										<Typography
											variant="body2"
											sx={{ color: 'text.secondary', mx: 0.5 }}
										>
											|
										</Typography>
										<Typography
											variant="body2"
											sx={{ color: 'text.secondary' }}
											title="Thermostat current"
										>
											{formatTemp(thermostatData.currentTemperature)}°
										</Typography>
										<Typography
											variant="body2"
											sx={{ color: 'text.secondary' }}
										>
											→
										</Typography>
										<Typography
											variant="body2"
											sx={{
												fontWeight: 600,
												color: 'primary.main',
											}}
											title="Target temperature"
										>
											{formatTemp(
												averageTarget ?? thermostatData.targetTemperature
											)}
											°
										</Typography>
										{thermostatData.isHeating && (
											<FireIcon
												sx={{
													fontSize: 18,
													color: '#f97316',
													animation: 'pulse 1.5s infinite',
													'@keyframes pulse': {
														'0%, 100%': { opacity: 1 },
														'50%': { opacity: 0.5 },
													},
												}}
												titleAccess="Heating"
											/>
										)}
									</>
								)}
							</Box>
						)}
						<IconButton
							size="small"
							onClick={handleToggle}
							sx={{
								transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
								transform: props.expanded ? 'rotate(180deg)' : 'rotate(0deg)',
							}}
						>
							<ExpandMoreIcon />
						</IconButton>
					</Box>

					{/* Expanded controls */}
					<Collapse in={props.expanded && hasThermostat}>
						{props.expanded && (
							<Box
								sx={{
									mt: 2,
									pt: 2,
									borderTop: '1px solid',
									borderColor: 'divider',
								}}
							>
								{/* Target temperature controls - hidden in kiosk mode */}
								{!props.kiosk && (
									<>
										<Typography
											variant="caption"
											sx={{
												color: 'text.secondary',
												mb: 1,
												display: 'block',
											}}
										>
											Set target temperature
										</Typography>
										<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
											<IconButton
												size="small"
												onClick={() => void handleTargetChange(-0.5)}
												disabled={
													updating || newTarget === null || newTarget <= 5
												}
											>
												<RemoveIcon />
											</IconButton>
											<Box sx={{ flexGrow: 1, px: 1 }}>
												<Slider
													value={newTarget ?? 20}
													min={5}
													max={30}
													step={0.5}
													onChange={handleSliderChange}
													disabled={updating}
													valueLabelDisplay="auto"
													valueLabelFormat={(v) => `${v}°`}
													sx={{
														'& .MuiSlider-thumb': {
															width: 20,
															height: 20,
														},
													}}
												/>
											</Box>
											<IconButton
												size="small"
												onClick={() => void handleTargetChange(0.5)}
												disabled={
													updating ||
													newTarget === null ||
													newTarget >= 30
												}
											>
												<AddIcon />
											</IconButton>
											<Typography
												variant="body1"
												sx={{
													fontWeight: 600,
													minWidth: 45,
													textAlign: 'right',
												}}
											>
												{newTarget !== null ? `${newTarget}°` : '--°'}
											</Typography>
										</Box>
										{updating && (
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'center',
													mt: 1,
												}}
											>
												<CircularProgress size={16} />
											</Box>
										)}
									</>
								)}

								{/* Active state indicator */}
								{activeState?.activeStateId && activeState.state && (
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 1,
											mb: 1,
											p: 1,
											bgcolor: 'primary.50',
											borderRadius: 1,
										}}
									>
										<ScheduleIcon fontSize="small" color="primary" />
										<Typography variant="caption" color="primary.main">
											Active State: <strong>{activeState.state.name}</strong>
										</Typography>
									</Box>
								)}

								{/* Next scheduled temperature */}
								{nextSchedule?.hasNext && (
									<Box
										sx={{
											mt: props.kiosk ? 0 : 2,
											pt: props.kiosk ? 0 : 1,
											borderTop: props.kiosk ? 'none' : '1px solid',
											borderColor: 'divider',
											display: 'flex',
											alignItems: 'center',
											gap: 1,
										}}
									>
										<ScheduleIcon
											sx={{ fontSize: 16, color: 'text.secondary' }}
										/>
										<Typography variant="caption" color="text.secondary">
											Next:{' '}
											<Box
												component="span"
												sx={{ fontWeight: 500, color: 'text.primary' }}
											>
												{nextSchedule.name}
											</Box>
											{' @ '}
											<Box component="span" sx={{ color: 'text.primary' }}>
												{formatNextScheduleTime()}
											</Box>
											{' → '}
											<Box
												component="span"
												sx={{ fontWeight: 600, color: 'primary.main' }}
											>
												{nextSchedule.averageTargetTemperature
													? formatTemp(
															nextSchedule.averageTargetTemperature
														)
													: nextSchedule.targetTemperature}
												°
											</Box>
											<Box
												component="span"
												sx={{ color: 'text.disabled', ml: 0.5 }}
											>
												({timeUntilNext})
											</Box>
										</Typography>
									</Box>
								)}
							</Box>
						)}
					</Collapse>
				</CardContent>
			</Card>
		</Box>
	);
};
