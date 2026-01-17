import {
	DeviceThermostat as DeviceThermostatIcon,
	ExpandMore as ExpandMoreIcon,
	LocalFireDepartment as FireIcon,
	Add as AddIcon,
	Remove as RemoveIcon,
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
	Chip,
} from '@mui/material';
import type { TemperatureWebsocketServerMessage } from '../../../server/modules/temperature/routing';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import useWebsocket from '../../shared/resilient-socket';
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
	const [averageTarget, setAverageTarget] = useState<number | null>(null);
	const [targetControlsOpen, setTargetControlsOpen] = useState(false);

	const [activeState, setActiveState] = useState<{
		state: { id: string; name: string } | null;
		activeStateId: string | null;
	} | null>(null);
	const [allStates, setAllStates] = useState<Array<{ id: string; name: string }>>([]);
	const [updatingState, setUpdatingState] = useState(false);

	// Helper function to update all state from WebSocket message
	const updateFromWebSocketMessage = useCallback((message: TemperatureWebsocketServerMessage) => {
		// Update inside temperature
		setTemperature(message.insideTemperature);

		// Update thermostat data
		if (message.centralThermostat) {
			setThermostatData({
				configured: true,
				...message.centralThermostat,
			});
			// Update slider value if it's null or very close to the current target
			// (meaning user hasn't manually changed it or has already committed)
			const currentNewTarget = newTargetRef.current;
			if (
				currentNewTarget === null ||
				Math.abs(currentNewTarget - message.centralThermostat.targetTemperature) < 0.1
			) {
				setNewTarget(message.centralThermostat.targetTemperature);
			}
		} else {
			setThermostatData({ configured: false });
		}

		// Update average target from rooms
		if (message.rooms && message.rooms.length > 0) {
			const avg =
				message.rooms.reduce((acc: number, r) => acc + r.targetTemperature, 0) /
				message.rooms.length;
			setAverageTarget(avg);
		} else if (message.centralThermostat) {
			// Fallback to global target if no rooms
			setAverageTarget(message.globalTarget);
		}

		// Update active state
		setActiveState(message.activeState);

		// Update all states
		setAllStates(message.states);

		// Mark as loaded once we receive first message
		setLoading(false);
	}, []);

	// Subscribe to temperature WebSocket updates
	const newTargetRef = useRef<number | null>(null);
	newTargetRef.current = newTarget;

	useWebsocket<TemperatureWebsocketServerMessage, never>('/temperature/ws', {
		onMessage: (message) => {
			if (message.type === 'update') {
				updateFromWebSocketMessage(message);
			}
		},
	});

	const handleToggle = () => {
		props.onExpandedChange(!props.expanded);
	};

	useEffect(() => {
		if (!props.expanded) {
			setTargetControlsOpen(false);
		}
	}, [props.expanded]);

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
			if (!response.ok) {
				console.error('Failed to update target temperature');
			}
			// WebSocket will handle state updates automatically
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

	const handleStateActivation = useCallback(
		async (stateId: string) => {
			if (updatingState) {
				return;
			}
			setUpdatingState(true);
			try {
				const response = await apiPost('temperature', '/states/active', {}, { stateId });
				if (response.ok) {
					const data = await response.json();
					if (data.success) {
						// Refresh active state data
						const activeStateResponse = await apiGet(
							'temperature',
							'/states/active',
							{}
						);
						if (activeStateResponse.ok) {
							const activeData = await activeStateResponse.json();
							setActiveState({
								state: activeData.state,
								activeStateId: activeData.activeStateId,
							});
						}
					}
				}
			} catch (error) {
				console.error('Failed to activate temperature state:', error);
			} finally {
				setUpdatingState(false);
			}
		},
		[updatingState]
	);

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
									<Box sx={{ mb: 1 }}>
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 1,
											}}
										>
											<Typography
												variant="caption"
												sx={{
													color: 'text.secondary',
													display: 'block',
												}}
											>
												Target temperature
											</Typography>
											<Box
												sx={{
													display: 'flex',
													alignItems: 'center',
													gap: 0.5,
													ml: 'auto',
												}}
											>
												<IconButton
													size="small"
													onClick={() => void handleTargetChange(-0.5)}
													disabled={
														updating ||
														newTarget === null ||
														newTarget <= 5
													}
													sx={{ p: 0.5 }}
												>
													<RemoveIcon fontSize="small" />
												</IconButton>
												<Typography
													variant="body2"
													sx={{
														fontWeight: 600,
														minWidth: 40,
														textAlign: 'center',
													}}
												>
													{newTarget !== null ? `${newTarget}°` : '--°'}
												</Typography>
												<IconButton
													size="small"
													onClick={() => void handleTargetChange(0.5)}
													disabled={
														updating ||
														newTarget === null ||
														newTarget >= 30
													}
													sx={{ p: 0.5 }}
												>
													<AddIcon fontSize="small" />
												</IconButton>
												{updating && <CircularProgress size={14} />}
												<IconButton
													size="small"
													onClick={() => {
														setTargetControlsOpen(
															(previous) => !previous
														);
													}}
													sx={{
														p: 0.5,
														transition: 'transform 0.2s ease',
														transform: targetControlsOpen
															? 'rotate(180deg)'
															: 'rotate(0deg)',
													}}
													aria-label="Toggle target temperature slider"
												>
													<ExpandMoreIcon fontSize="small" />
												</IconButton>
											</Box>
										</Box>
										<Collapse in={targetControlsOpen}>
											<Box sx={{ mt: 1, px: 0.5 }}>
												<Slider
													value={newTarget ?? 20}
													min={5}
													max={30}
													step={0.5}
													onChange={handleSliderChange}
													disabled={updating}
													valueLabelDisplay="auto"
													valueLabelFormat={(v) => `${v}°`}
													size="small"
													sx={{
														'& .MuiSlider-thumb': {
															width: 18,
															height: 18,
														},
													}}
												/>
											</Box>
										</Collapse>
									</Box>
								)}

								{/* Temperature States Selector */}
								{allStates.length > 0 && (
									<Box
										sx={{
											mt: props.kiosk ? 0 : 1,
											mb: props.kiosk ? 0 : 1,
											pt: props.kiosk ? 0 : 1,
											borderTop: props.kiosk ? 'none' : '1px solid',
											borderColor: 'divider',
										}}
									>
										<Typography
											variant="caption"
											sx={{
												color: 'text.secondary',
												mb: 1,
												display: 'block',
											}}
										>
											Temperature States
										</Typography>
										<Box
											sx={{
												display: 'flex',
												flexWrap: 'wrap',
												gap: 0.75,
											}}
										>
											{allStates.map((state) => {
												const isActive =
													activeState?.activeStateId === state.id;
												return (
													<Chip
														key={state.id}
														label={state.name}
														onClick={() => {
															if (!isActive && !updatingState) {
																void handleStateActivation(
																	state.id
																);
															}
														}}
														variant={isActive ? 'filled' : 'outlined'}
														color={isActive ? 'primary' : 'default'}
														size="small"
														disabled={updatingState}
														sx={{
															cursor: isActive
																? 'default'
																: 'pointer',
															'&:hover': {
																backgroundColor: isActive
																	? undefined
																	: 'action.hover',
															},
														}}
													/>
												);
											})}
										</Box>
										{updatingState && (
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
