import type {
	DashboardDeviceClusterOccupancySensing,
	DashboardDeviceClusterWithState,
	DashboardDeviceClusterTemperatureMeasurement,
	DashboardDeviceClusterRelativeHumidityMeasurement,
	DashboardDeviceClusterIlluminanceMeasurement,
	DashboardDeviceClusterWindowCovering,
	DashboardDeviceClusterColorControlXY,
	DashboardDeviceClusterActions,
	DashboardDeviceClusterOccupancySensorGroup,
	DashboardDeviceClusterAirQualityGroup,
	DashboardDeviceClusterThermostat,
	DeviceListWithValuesResponse,
	DashboardDeviceClusterSwitch,
	DashboardDeviceClusterBooleanState,
	DashboardDeviceClusterOnOff,
	DashboardDeviceClusterFridge,
	DashboardDeviceClusterWasher,
} from '../../../server/modules/device/routing';
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Legend,
	Filler,
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore - chart.js is an ESM module, Bun handles it at runtime
} from 'chart.js';
import {
	Box,
	Card,
	CardContent,
	Typography,
	IconButton,
	CircularProgress,
	List,
	ListItem,
	ListItemText,
	Chip,
	Slider,
	ToggleButtonGroup,
	ToggleButton,
	Switch,
	FormControlLabel,
	Alert,
	Link,
	Button,
} from '@mui/material';
import {
	pageVariants,
	cardVariants,
	staggerContainer,
	staggerItem,
	smoothSpring,
	bouncySpring,
} from '../../lib/animations';
import { DeviceClusterName, ThermostatMode } from '../../../server/modules/device/cluster';
import { WindowCoveringVisualization } from './WindowCoveringVisualization';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CircularSlider from '@fseehawer/react-circular-slider';
import React, { useState, useEffect, useRef } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DeviceActionsCard } from './DeviceActionsCard';
import { apiGet, apiPost } from '../../lib/fetch';
import { ColorPresets } from './ColorPresets';
import { Wheel } from '@uiw/react-color';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - react-chartjs-2 is an ESM module, Bun handles it at runtime
import { Line } from 'react-chartjs-2';
import { motion } from 'framer-motion';

// Register Chart.js components
ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Legend,
	Filler
);

interface DeviceDetailBaseProps<C extends DashboardDeviceClusterWithState> {
	device: DeviceListWithValuesResponse[number];
	cluster: C;
	onExit: () => void;
}

interface OccupancyEvent {
	occupied: boolean;
	timestamp: number;
}

interface OccupancyDetailProps
	extends DeviceDetailBaseProps<DashboardDeviceClusterOccupancySensing> {}

const OccupancyDetail = (props: OccupancyDetailProps): JSX.Element => {
	const [history, setHistory] = useState<OccupancyEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deviceName, setDeviceName] = useState<string>('');
	const roomColor = props.device.roomColor || '#555';

	const deviceId = props.device.uniqueId;
	const fetchHistory = React.useCallback(async () => {
		if (!deviceId) {
			setError('No device ID provided');
			setLoading(false);
			return;
		}

		try {
			setLoading(true);

			// Fetch device details
			const devicesResponse = await apiGet('device', '/listWithValues', {});
			if (devicesResponse.ok) {
				const devicesData = await devicesResponse.json();
				const device = devicesData.devices.find(
					(d: { uniqueId: string }) => d.uniqueId === deviceId
				);
				if (device) {
					setDeviceName(device.name);
				}
			}

			// Fetch history
			const response = await apiGet('device', '/occupancy/:deviceId', {
				deviceId: deviceId,
			});
			if (!response.ok) {
				throw new Error('Failed to fetch occupancy history');
			}

			const data = (await response.json()) as { history?: OccupancyEvent[] };
			setHistory(data.history || []);
		} catch (err) {
			setError('Failed to load occupancy history');
			console.error('Failed to fetch occupancy history:', err);
		} finally {
			setLoading(false);
		}
	}, [deviceId]);

	useEffect(() => {
		void fetchHistory();
	}, [fetchHistory]);

	// Refetch history when occupancy state changes (WebSocket update)
	const prevOccupiedRef = React.useRef(props.cluster.occupied);
	React.useEffect(() => {
		if (prevOccupiedRef.current !== props.cluster.occupied) {
			prevOccupiedRef.current = props.cluster.occupied;
			void fetchHistory();
		}
	}, [props.cluster.occupied, fetchHistory]);

	const formatTimestamp = (timestamp: number): string => {
		const date = new Date(timestamp);
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();
		const isYesterday =
			date.toDateString() === new Date(now.getTime() - 86400000).toDateString();

		const timeStr = date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
		});

		if (isToday) {
			return `Today at ${timeStr}`;
		}
		if (isYesterday) {
			return `Yesterday at ${timeStr}`;
		}
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const currentState = history.length > 0 ? history[0] : props.cluster;

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					style={{ color: '#2f2f2f', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					Occupancy Sensor
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				{loading && (
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'center',
							py: 4,
						}}
					>
						<CircularProgress />
					</Box>
				)}

				{error && (
					<Card>
						<CardContent>
							<Typography color="error">{error}</Typography>
						</CardContent>
					</Card>
				)}

				{!loading && !error && (
					<>
						<motion.div variants={cardVariants} initial="initial" animate="animate">
							<Card
								sx={{
									mb: 3,
									borderRadius: 3,
									boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
									background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
								}}
							>
								<CardContent sx={{ p: 3 }}>
									<Typography
										variant="h6"
										gutterBottom
										sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
									>
										{deviceName || 'Unknown Device'}
									</Typography>
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 2,
											mt: 2,
										}}
									>
										<Typography
											variant="body1"
											color="text.secondary"
											sx={{ fontWeight: 500 }}
										>
											Current State:
										</Typography>
										<motion.div
											initial={{ scale: 0.8 }}
											animate={{ scale: 1 }}
											transition={{ delay: 0.2, ...bouncySpring }}
										>
											<Chip
												label={
													currentState?.occupied ? 'Occupied' : 'Clear'
												}
												color={
													currentState?.occupied ? 'success' : 'default'
												}
												sx={{
													fontWeight: 600,
													px: 1,
												}}
											/>
										</motion.div>
									</Box>
									{currentState && 'timestamp' in currentState && (
										<Typography
											variant="body2"
											color="text.secondary"
											sx={{ mt: 1.5, fontSize: '0.875rem' }}
										>
											Last updated: {formatTimestamp(currentState.timestamp)}
										</Typography>
									)}
								</CardContent>
							</Card>
						</motion.div>

						<motion.div
							variants={cardVariants}
							initial="initial"
							animate="animate"
							transition={{ delay: 0.1 }}
						>
							<Card
								sx={{
									borderRadius: 3,
									boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
									background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
								}}
							>
								<CardContent sx={{ p: 3 }}>
									<Typography
										variant="h6"
										gutterBottom
										sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
									>
										History
									</Typography>
									{history.length === 0 ? (
										<Typography color="text.secondary">
											No history available
										</Typography>
									) : (
										<motion.div
											variants={staggerContainer}
											initial="initial"
											animate="animate"
										>
											<List sx={{ py: 1 }}>
												{history.map((event, index) => (
													<motion.div key={index} variants={staggerItem}>
														<ListItem
															sx={{
																borderLeft: 4,
																borderColor: event.occupied
																	? 'success.main'
																	: 'grey.400',
																mb: 1.5,
																bgcolor: 'background.paper',
																borderRadius: 2,
																boxShadow:
																	'0 2px 8px rgba(0,0,0,0.06)',
																transition: 'all 0.2s',
																'&:hover': {
																	boxShadow:
																		'0 4px 12px rgba(0,0,0,0.1)',
																	transform: 'translateX(4px)',
																},
															}}
														>
															<ListItemText
																primary={
																	event.occupied
																		? 'Occupied'
																		: 'Clear'
																}
																secondary={formatTimestamp(
																	event.timestamp
																)}
																primaryTypographyProps={{
																	fontWeight: 600,
																	color: event.occupied
																		? 'success.main'
																		: 'text.secondary',
																}}
																secondaryTypographyProps={{
																	fontSize: '0.875rem',
																}}
															/>
														</ListItem>
													</motion.div>
												))}
											</List>
										</motion.div>
									)}
								</CardContent>
							</Card>
						</motion.div>
					</>
				)}
			</Box>
		</motion.div>
	);
};

interface BooleanStateEvent {
	state: boolean;
	timestamp: number;
}

interface ProcessedBooleanStateEvent extends BooleanStateEvent {
	duration?: number; // Duration in ms for "door opened" events
}

interface BooleanStateDetailProps
	extends DeviceDetailBaseProps<DashboardDeviceClusterBooleanState> {}

const BooleanStateDetail = (props: BooleanStateDetailProps): JSX.Element => {
	const [history, setHistory] = useState<BooleanStateEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const roomColor = props.device.roomColor || '#555';

	const deviceId = props.device.uniqueId;
	const fetchHistory = React.useCallback(async () => {
		if (!deviceId) {
			setError('No device ID provided');
			setLoading(false);
			return;
		}

		try {
			setLoading(true);

			// Fetch history
			const response = await apiGet('device', '/boolean-state/:deviceId', {
				deviceId: deviceId,
			});
			if (!response.ok) {
				throw new Error('Failed to fetch boolean state history');
			}

			const data = (await response.json()) as { history?: BooleanStateEvent[] };
			setHistory(data.history || []);
		} catch (err) {
			setError('Failed to load door sensor history');
			console.error('Failed to fetch boolean state history:', err);
		} finally {
			setLoading(false);
		}
	}, [deviceId]);

	useEffect(() => {
		void fetchHistory();
	}, [fetchHistory]);

	// Refetch history when state changes (WebSocket update)
	const prevStateRef = React.useRef(props.cluster.state);
	React.useEffect(() => {
		if (prevStateRef.current !== props.cluster.state) {
			prevStateRef.current = props.cluster.state;
			void fetchHistory();
		}
	}, [props.cluster.state, fetchHistory]);

	const formatTimestamp = (timestamp: number): string => {
		const date = new Date(timestamp);
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();
		const isYesterday =
			date.toDateString() === new Date(now.getTime() - 86400000).toDateString();

		const timeStr = date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
		});

		if (isToday) {
			return `Today at ${timeStr}`;
		}
		if (isYesterday) {
			return `Yesterday at ${timeStr}`;
		}
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const formatDuration = (ms: number): string => {
		const minutes = Math.round(ms / 60000);
		if (minutes < 1) {
			return 'less than a minute';
		}
		if (minutes === 1) {
			return '1 minute';
		}
		if (minutes < 60) {
			return `${minutes} minutes`;
		}
		const hours = Math.floor(minutes / 60);
		const remainingMins = minutes % 60;
		if (remainingMins === 0) {
			return `${hours} hour${hours > 1 ? 's' : ''}`;
		}
		return `${hours}h ${remainingMins}m`;
	};

	// Process history to deduplicate consecutive same-state events and calculate open duration
	const processedHistory = React.useMemo(() => {
		const deduplicated: ProcessedBooleanStateEvent[] = [];
		for (let i = 0; i < history.length; i++) {
			const event = history[i];
			// Skip if same state as previous (history is DESC order, so we're going backwards in time)
			if (
				deduplicated.length > 0 &&
				deduplicated[deduplicated.length - 1].state === event.state
			) {
				continue;
			}
			// For "door opened" events, calculate duration until closed
			let duration: number | undefined;
			if (!event.state) {
				// door opened (state=false)
				// Find the most recent "door closed" event we've added (previous in array since DESC)
				const closedEvent = deduplicated.find((e) => e.state === true);
				if (closedEvent) {
					duration = closedEvent.timestamp - event.timestamp;
				}
			}
			deduplicated.push({ ...event, duration });
		}
		return deduplicated;
	}, [history]);

	const currentState =
		processedHistory.length > 0 ? processedHistory[0].state : props.cluster.state;
	const isOpen = !currentState;

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					style={{ color: '#2f2f2f', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					Door Sensor
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				{loading && (
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'center',
							py: 4,
						}}
					>
						<CircularProgress />
					</Box>
				)}

				{error && (
					<Card>
						<CardContent>
							<Typography color="error">{error}</Typography>
						</CardContent>
					</Card>
				)}

				{!loading && !error && (
					<>
						<motion.div variants={cardVariants} initial="initial" animate="animate">
							<Card
								sx={{
									mb: 3,
									borderRadius: 3,
									boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
									background: isOpen
										? 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)'
										: 'linear-gradient(135deg, #1a472a 0%, #166534 100%)',
								}}
							>
								<CardContent sx={{ p: 3 }}>
									<Typography
										variant="h6"
										gutterBottom
										sx={{
											fontWeight: 600,
											letterSpacing: '-0.01em',
											color: 'white',
										}}
									>
										{props.device.name}
									</Typography>
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 2,
											mt: 2,
										}}
									>
										<Typography
											variant="body1"
											sx={{
												fontWeight: 500,
												color: 'rgba(255, 255, 255, 0.9)',
											}}
										>
											Current State:
										</Typography>
										<motion.div
											initial={{ scale: 0.8 }}
											animate={{ scale: 1 }}
											transition={{ delay: 0.2, ...bouncySpring }}
										>
											<Chip
												label={isOpen ? 'OPEN' : 'CLOSED'}
												sx={{
													fontWeight: 700,
													px: 2,
													fontSize: '1rem',
													backgroundColor: isOpen
														? 'rgba(249, 115, 22, 0.3)'
														: 'rgba(76, 175, 80, 0.3)',
													color: 'white',
													border: '2px solid',
													borderColor: isOpen ? '#f97316' : '#4caf50',
												}}
											/>
										</motion.div>
									</Box>
									{props.cluster.lastChanged && (
										<Typography
											variant="body2"
											sx={{
												mt: 1.5,
												fontSize: '0.875rem',
												color: 'rgba(255, 255, 255, 0.8)',
											}}
										>
											Last changed:{' '}
											{formatTimestamp(props.cluster.lastChanged)}
										</Typography>
									)}
								</CardContent>
							</Card>
						</motion.div>

						<motion.div
							variants={cardVariants}
							initial="initial"
							animate="animate"
							transition={{ delay: 0.1 }}
						>
							<Card
								sx={{
									borderRadius: 3,
									boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
									background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
								}}
							>
								<CardContent sx={{ p: 3 }}>
									<Typography
										variant="h6"
										gutterBottom
										sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
									>
										History
									</Typography>
									{processedHistory.length === 0 ? (
										<Typography color="text.secondary">
											No history available
										</Typography>
									) : (
										<motion.div
											variants={staggerContainer}
											initial="initial"
											animate="animate"
										>
											<List sx={{ py: 1 }}>
												{processedHistory.map((event, index) => (
													<motion.div key={index} variants={staggerItem}>
														<ListItem
															sx={{
																borderLeft: 4,
																borderColor: event.state
																	? '#4caf50'
																	: '#f97316',
																mb: 1.5,
																bgcolor: 'background.paper',
																borderRadius: 2,
																boxShadow:
																	'0 2px 8px rgba(0,0,0,0.06)',
																transition: 'all 0.2s',
																'&:hover': {
																	boxShadow:
																		'0 4px 12px rgba(0,0,0,0.1)',
																	transform: 'translateX(4px)',
																},
															}}
														>
															<ListItemText
																primary={
																	event.state
																		? 'Door Closed'
																		: event.duration
																			? `Door Opened for ${formatDuration(event.duration)}`
																			: 'Door Opened'
																}
																secondary={formatTimestamp(
																	event.timestamp
																)}
																primaryTypographyProps={{
																	fontWeight: 600,
																	color: event.state
																		? '#4caf50'
																		: '#f97316',
																}}
																secondaryTypographyProps={{
																	fontSize: '0.875rem',
																}}
															/>
														</ListItem>
													</motion.div>
												))}
											</List>
										</motion.div>
									)}
								</CardContent>
							</Card>
						</motion.div>
					</>
				)}
			</Box>
		</motion.div>
	);
};

interface ButtonPressEvent {
	buttonIndex?: number;
	timestamp: number;
}

interface SwitchDetailProps extends DeviceDetailBaseProps<DashboardDeviceClusterWithState> {}

const SwitchDetail = (props: SwitchDetailProps): JSX.Element => {
	const [history, setHistory] = useState<ButtonPressEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const roomColor = props.device.roomColor || '#555';

	const deviceId = props.device.uniqueId;

	const fetchHistory = React.useCallback(async () => {
		if (!deviceId) {
			setError('No device ID provided');
			setLoading(false);
			return;
		}

		try {
			setLoading(true);

			const response = await apiGet('device', '/button-press/:deviceId', {
				deviceId: deviceId,
			});
			if (!response.ok) {
				throw new Error('Failed to fetch button press history');
			}

			const data = (await response.json()) as { history?: ButtonPressEvent[] };
			setHistory(data.history || []);
		} catch (err) {
			setError('Failed to load button press history');
			console.error('Failed to fetch button press history:', err);
		} finally {
			setLoading(false);
		}
	}, [deviceId]);

	useEffect(() => {
		void fetchHistory();
	}, [fetchHistory]);

	// Refetch history when device updates (WebSocket update)
	// We track the device's clusters as a dependency to detect any changes
	const deviceClustersJson = JSON.stringify(props.device.flatAllClusters);
	const prevDeviceClustersRef = React.useRef(deviceClustersJson);
	React.useEffect(() => {
		if (prevDeviceClustersRef.current !== deviceClustersJson) {
			prevDeviceClustersRef.current = deviceClustersJson;
			void fetchHistory();
		}
	}, [deviceClustersJson, fetchHistory]);

	const formatTimestamp = (timestamp: number): string => {
		const date = new Date(timestamp);
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();
		const isYesterday =
			date.toDateString() === new Date(now.getTime() - 86400000).toDateString();

		const timeStr = date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
		});

		if (isToday) {
			return `Today at ${timeStr}`;
		}
		if (isYesterday) {
			return `Yesterday at ${timeStr}`;
		}
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const formatButtonLabel = (buttonIndex?: number): string => {
		if (buttonIndex === undefined || buttonIndex === null) {
			return 'Pressed';
		}
		return `${buttonIndexLabels[buttonIndex] || `Button ${buttonIndex + 1}`} pressed`;
	};

	const lastPress = history.length > 0 ? history[0] : null;
	const switchClusters = props.device.flatAllClusters.filter(
		(cluster): cluster is DashboardDeviceClusterSwitch =>
			cluster.name === DeviceClusterName.SWITCH
	);
	const buttonIndexLabels: Record<number, string> = {};
	for (const cluster of switchClusters) {
		buttonIndexLabels[cluster.index] = cluster.label;
	}

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					style={{ color: '#2f2f2f', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					Switch
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				{loading && (
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'center',
							py: 4,
						}}
					>
						<CircularProgress />
					</Box>
				)}

				{error && (
					<Card>
						<CardContent>
							<Typography color="error">{error}</Typography>
						</CardContent>
					</Card>
				)}

				{!loading && !error && (
					<>
						<motion.div variants={cardVariants} initial="initial" animate="animate">
							<Card
								sx={{
									mb: 3,
									borderRadius: 3,
									boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
									background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
								}}
							>
								<CardContent sx={{ p: 3 }}>
									<Typography
										variant="h6"
										gutterBottom
										sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
									>
										{props.device.name}
									</Typography>
									{lastPress && (
										<Typography
											variant="body2"
											color="text.secondary"
											sx={{ mt: 1.5, fontSize: '0.875rem' }}
										>
											Last pressed: {formatTimestamp(lastPress.timestamp)}
										</Typography>
									)}
									{!lastPress && (
										<Typography
											variant="body2"
											color="text.secondary"
											sx={{ mt: 1.5, fontSize: '0.875rem' }}
										>
											No press events recorded
										</Typography>
									)}
								</CardContent>
							</Card>
						</motion.div>

						<motion.div
							variants={cardVariants}
							initial="initial"
							animate="animate"
							transition={{ delay: 0.1 }}
						>
							<Card
								sx={{
									borderRadius: 3,
									boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
									background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
								}}
							>
								<CardContent sx={{ p: 3 }}>
									<Typography
										variant="h6"
										gutterBottom
										sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
									>
										History
									</Typography>
									{history.length === 0 ? (
										<Typography color="text.secondary">
											No history available
										</Typography>
									) : (
										<motion.div
											variants={staggerContainer}
											initial="initial"
											animate="animate"
										>
											<List sx={{ py: 1 }}>
												{history.map((event, index) => (
													<motion.div key={index} variants={staggerItem}>
														<ListItem
															sx={{
																borderLeft: 4,
																borderColor: 'primary.main',
																mb: 1.5,
																bgcolor: 'background.paper',
																borderRadius: 2,
																boxShadow:
																	'0 2px 8px rgba(0,0,0,0.06)',
																transition: 'all 0.2s',
																'&:hover': {
																	boxShadow:
																		'0 4px 12px rgba(0,0,0,0.1)',
																	transform: 'translateX(4px)',
																},
															}}
														>
															<ListItemText
																primary={formatButtonLabel(
																	event.buttonIndex
																)}
																secondary={formatTimestamp(
																	event.timestamp
																)}
																primaryTypographyProps={{
																	fontWeight: 600,
																	color: 'primary.main',
																}}
																secondaryTypographyProps={{
																	fontSize: '0.875rem',
																}}
															/>
														</ListItem>
													</motion.div>
												))}
											</List>
										</motion.div>
									)}
								</CardContent>
							</Card>
						</motion.div>
					</>
				)}
			</Box>
		</motion.div>
	);
};

type Timeframe = '1h' | '6h' | '24h' | '1week';

const TIMEFRAME_MS: Record<Timeframe, number> = {
	'1h': 60 * 60 * 1000,
	'6h': 6 * 60 * 60 * 1000,
	'24h': 24 * 60 * 60 * 1000,
	'1week': 7 * 24 * 60 * 60 * 1000,
};

interface TemperatureEvent {
	temperature: number;
	timestamp: number;
}

interface TemperatureDetailProps
	extends DeviceDetailBaseProps<DashboardDeviceClusterTemperatureMeasurement> {}

const TemperatureDetail = (props: TemperatureDetailProps): JSX.Element => {
	const [history, setHistory] = useState<TemperatureEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [timeframe, setTimeframe] = useState<Timeframe>('24h');
	const roomColor = props.device.roomColor || '#555';

	const deviceId = props.device.uniqueId;

	const fetchHistory = React.useCallback(async () => {
		try {
			setLoading(true);
			const response = await apiGet('device', '/temperature/:deviceId/:timeframe', {
				deviceId: deviceId,
				timeframe: TIMEFRAME_MS[timeframe].toString(),
			});

			if (!response.ok) {
				throw new Error('Failed to fetch temperature history');
			}

			const data = await response.json();
			setHistory(data.history || []);
		} catch (err) {
			setError('Failed to load temperature history');
			console.error('Failed to fetch temperature history:', err);
		} finally {
			setLoading(false);
		}
	}, [deviceId, timeframe]);

	useEffect(() => {
		void fetchHistory();
	}, [fetchHistory]);

	// Refetch history when temperature changes significantly (>0.1°C)
	const prevTempRef = React.useRef(props.cluster.temperature);
	React.useEffect(() => {
		const tempDiff = Math.abs(prevTempRef.current - props.cluster.temperature);
		if (tempDiff >= 0.1) {
			prevTempRef.current = props.cluster.temperature;
			void fetchHistory();
		}
	}, [props.cluster.temperature, fetchHistory]);

	const chartData = {
		labels: history
			.slice()
			.reverse()
			.map((e) => {
				const date = new Date(e.timestamp);
				if (timeframe === '1h' || timeframe === '6h') {
					return date.toLocaleTimeString('en-US', {
						hour: '2-digit',
						minute: '2-digit',
					});
				}
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
				});
			}),
		datasets: [
			{
				label: 'Temperature (°C)',
				data: history
					.slice()
					.reverse()
					.map((e) => e.temperature),
				borderColor: 'rgb(59, 130, 246)',
				backgroundColor: 'rgba(59, 130, 246, 0.1)',
				tension: 0.4,
				fill: true,
			},
		],
	};

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					style={{ color: '#2f2f2f', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					Temperature Sensor
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				{loading && (
					<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
						<CircularProgress />
					</Box>
				)}

				{error && (
					<Card>
						<CardContent>
							<Typography color="error">{error}</Typography>
						</CardContent>
					</Card>
				)}

				{!loading && !error && (
					<>
						<motion.div variants={cardVariants} initial="initial" animate="animate">
							<Card
								sx={{
									mb: 3,
									borderRadius: 3,
									boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
									background:
										'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 197, 253, 0.1) 100%)',
									border: '1px solid rgba(59, 130, 246, 0.2)',
								}}
							>
								<CardContent sx={{ p: 3 }}>
									<Typography
										variant="h6"
										gutterBottom
										sx={{ fontWeight: 500, opacity: 0.8 }}
									>
										{props.device.name}
									</Typography>
									<motion.div
										initial={{ scale: 0.8, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ delay: 0.2, ...smoothSpring }}
									>
										<Typography
											variant="h2"
											sx={{
												color: '#3b82f6',
												fontWeight: 700,
												letterSpacing: '-0.03em',
											}}
										>
											{props.cluster.temperature.toFixed(1)}°C
										</Typography>
									</motion.div>
								</CardContent>
							</Card>
						</motion.div>

						<motion.div
							variants={cardVariants}
							initial="initial"
							animate="animate"
							transition={{ delay: 0.1 }}
						>
							<Card
								sx={{
									mb: 3,
									borderRadius: 3,
									boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
									background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
								}}
							>
								<CardContent>
									<Box
										sx={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center',
											mb: 2,
										}}
									>
										<Typography variant="h6">History</Typography>
										<ToggleButtonGroup
											value={timeframe}
											exclusive
											onChange={(_, value) => value && setTimeframe(value)}
											size="small"
										>
											<ToggleButton value="1h">1h</ToggleButton>
											<ToggleButton value="6h">6h</ToggleButton>
											<ToggleButton value="24h">24h</ToggleButton>
											<ToggleButton value="1week">1 week</ToggleButton>
										</ToggleButtonGroup>
									</Box>
									{history.length === 0 ? (
										<Typography color="text.secondary">
											No history available
										</Typography>
									) : (
										<Line
											data={chartData}
											options={{
												responsive: true,
												maintainAspectRatio: true,
												plugins: {
													legend: { display: false },
													tooltip: {
														mode: 'index',
														intersect: false,
													},
												},
												scales: {
													y: {
														beginAtZero: false,
													},
												},
											}}
										/>
									)}
								</CardContent>
							</Card>
						</motion.div>
					</>
				)}
			</Box>
		</motion.div>
	);
};

interface HumidityEvent {
	humidity: number;
	timestamp: number;
}

interface HumidityDetailProps
	extends DeviceDetailBaseProps<DashboardDeviceClusterRelativeHumidityMeasurement> {}

const HumidityDetail = (props: HumidityDetailProps): JSX.Element => {
	const [history, setHistory] = useState<HumidityEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [timeframe, setTimeframe] = useState<Timeframe>('24h');
	const roomColor = props.device.roomColor || '#555';

	const deviceId = props.device.uniqueId;

	const fetchHistory = React.useCallback(async () => {
		try {
			setLoading(true);
			const response = await apiGet('device', '/humidity/:deviceId/:timeframe', {
				timeframe: TIMEFRAME_MS[timeframe].toString(),
				deviceId: deviceId,
			});

			if (!response.ok) {
				throw new Error('Failed to fetch humidity history');
			}

			const data = await response.json();
			setHistory(data.history || []);
		} catch (err) {
			setError('Failed to load humidity history');
			console.error('Failed to fetch humidity history:', err);
		} finally {
			setLoading(false);
		}
	}, [deviceId, timeframe]);

	useEffect(() => {
		void fetchHistory();
	}, [fetchHistory]);

	// Refetch history when humidity changes significantly (>1%)
	const prevHumidityRef = React.useRef(props.cluster.humidity);
	React.useEffect(() => {
		const humidityDiff = Math.abs(prevHumidityRef.current - props.cluster.humidity);
		if (humidityDiff >= 0.01) {
			prevHumidityRef.current = props.cluster.humidity;
			void fetchHistory();
		}
	}, [props.cluster.humidity, fetchHistory]);

	const chartData = {
		labels: history
			.slice()
			.reverse()
			.map((e) => {
				const date = new Date(e.timestamp);
				if (timeframe === '1week') {
					return date.toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						hour: '2-digit',
					});
				}
				return date.toLocaleTimeString('en-US', {
					hour: '2-digit',
					minute: '2-digit',
				});
			}),
		datasets: [
			{
				label: 'Humidity (%)',
				data: history
					.slice()
					.reverse()
					.map((e) => e.humidity * 100),
				borderColor: 'rgb(16, 185, 129)',
				backgroundColor: 'rgba(16, 185, 129, 0.1)',
				tension: 0.4,
				fill: true,
			},
		],
	};

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					style={{ color: '#2f2f2f', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					Humidity Sensor
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				{loading && (
					<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
						<CircularProgress />
					</Box>
				)}

				{error && (
					<Card>
						<CardContent>
							<Typography color="error">{error}</Typography>
						</CardContent>
					</Card>
				)}

				{!loading && !error && (
					<>
						<motion.div variants={cardVariants} initial="initial" animate="animate">
							<Card
								sx={{
									mb: 3,
									borderRadius: 3,
									boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
									background:
										'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(167, 243, 208, 0.1) 100%)',
									border: '1px solid rgba(16, 185, 129, 0.2)',
								}}
							>
								<CardContent sx={{ p: 3 }}>
									<Typography
										variant="h6"
										gutterBottom
										sx={{ fontWeight: 500, opacity: 0.8 }}
									>
										{props.device.name}
									</Typography>
									<motion.div
										initial={{ scale: 0.8, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ delay: 0.2, ...smoothSpring }}
									>
										<Typography
											variant="h2"
											sx={{
												color: '#10b981',
												fontWeight: 700,
												letterSpacing: '-0.03em',
											}}
										>
											{(props.cluster.humidity * 100).toFixed(0)}%
										</Typography>
									</motion.div>
								</CardContent>
							</Card>
						</motion.div>

						<motion.div
							variants={cardVariants}
							initial="initial"
							animate="animate"
							transition={{ delay: 0.1 }}
						>
							<Card
								sx={{
									mb: 3,
									borderRadius: 3,
									boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
									background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
								}}
							>
								<CardContent>
									<Box
										sx={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center',
											mb: 2,
										}}
									>
										<Typography variant="h6">History</Typography>
										<ToggleButtonGroup
											value={timeframe}
											exclusive
											onChange={(_, value) => value && setTimeframe(value)}
											size="small"
										>
											<ToggleButton value="hour">Hour</ToggleButton>
											<ToggleButton value="day">Day</ToggleButton>
											<ToggleButton value="week">Week</ToggleButton>
											<ToggleButton value="month">Month</ToggleButton>
										</ToggleButtonGroup>
									</Box>
									{history.length === 0 ? (
										<Typography color="text.secondary">
											No history available
										</Typography>
									) : (
										<Line
											data={chartData}
											options={{
												responsive: true,
												maintainAspectRatio: true,
												plugins: {
													legend: { display: false },
													tooltip: {
														mode: 'index',
														intersect: false,
													},
												},
												scales: {
													y: {
														beginAtZero: false,
														max: 100,
														min: 0,
													},
												},
											}}
										/>
									)}
								</CardContent>
							</Card>
						</motion.div>
					</>
				)}
			</Box>
		</motion.div>
	);
};

interface IlluminanceEvent {
	illuminance: number;
	timestamp: number;
}

interface IlluminanceDetailProps
	extends DeviceDetailBaseProps<DashboardDeviceClusterIlluminanceMeasurement> {}

const IlluminanceDetail = (props: IlluminanceDetailProps): JSX.Element => {
	const [history, setHistory] = useState<IlluminanceEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [timeframe, setTimeframe] = useState<Timeframe>('24h');
	const roomColor = props.device.roomColor || '#555';

	const deviceId = props.device.uniqueId;

	const fetchHistory = React.useCallback(async () => {
		try {
			setLoading(true);
			const response = await apiGet('device', '/illuminance/:deviceId/:timeframe', {
				timeframe: TIMEFRAME_MS[timeframe].toString(),
				deviceId: deviceId,
			});

			if (!response.ok) {
				throw new Error('Failed to fetch illuminance history');
			}

			const data = await response.json();
			setHistory(data.history || []);
		} catch (err) {
			setError('Failed to load illuminance history');
			console.error('Failed to fetch illuminance history:', err);
		} finally {
			setLoading(false);
		}
	}, [deviceId, timeframe]);

	useEffect(() => {
		void fetchHistory();
	}, [fetchHistory]);

	// Refetch history when illuminance changes significantly (>10 lux)
	const prevIlluminanceRef = React.useRef(props.cluster.illuminance);
	React.useEffect(() => {
		const illuminanceDiff = Math.abs(prevIlluminanceRef.current - props.cluster.illuminance);
		if (illuminanceDiff >= 10) {
			prevIlluminanceRef.current = props.cluster.illuminance;
			void fetchHistory();
		}
	}, [props.cluster.illuminance, fetchHistory]);

	const chartData = {
		labels: history
			.slice()
			.reverse()
			.map((e) => {
				const date = new Date(e.timestamp);
				if (timeframe === '1week') {
					return date.toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						hour: '2-digit',
					});
				}
				return date.toLocaleTimeString('en-US', {
					hour: '2-digit',
					minute: '2-digit',
				});
			}),
		datasets: [
			{
				label: 'Illuminance (lux)',
				data: history
					.slice()
					.reverse()
					.map((e) => e.illuminance),
				borderColor: 'rgb(251, 191, 36)',
				backgroundColor: 'rgba(251, 191, 36, 0.1)',
				tension: 0.4,
				fill: true,
			},
		],
	};

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					style={{ color: '#2f2f2f', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					Light Sensor
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				{loading && (
					<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
						<CircularProgress />
					</Box>
				)}

				{error && (
					<Card>
						<CardContent>
							<Typography color="error">{error}</Typography>
						</CardContent>
					</Card>
				)}

				{!loading && !error && (
					<>
						<motion.div variants={cardVariants} initial="initial" animate="animate">
							<Card
								sx={{
									mb: 3,
									borderRadius: 3,
									boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
									background:
										'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(253, 230, 138, 0.1) 100%)',
									border: '1px solid rgba(251, 191, 36, 0.2)',
								}}
							>
								<CardContent sx={{ p: 3 }}>
									<Typography
										variant="h6"
										gutterBottom
										sx={{ fontWeight: 500, opacity: 0.8 }}
									>
										{props.device.name}
									</Typography>
									<motion.div
										initial={{ scale: 0.8, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ delay: 0.2, ...smoothSpring }}
									>
										<Typography
											variant="h2"
											sx={{
												color: '#fbbf24',
												fontWeight: 700,
												letterSpacing: '-0.03em',
											}}
										>
											{props.cluster.illuminance.toFixed(0)} lux
										</Typography>
									</motion.div>
								</CardContent>
							</Card>
						</motion.div>

						<motion.div
							variants={cardVariants}
							initial="initial"
							animate="animate"
							transition={{ delay: 0.1 }}
						>
							<Card
								sx={{
									mb: 3,
									borderRadius: 3,
									boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
									background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
								}}
							>
								<CardContent>
									<Box
										sx={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center',
											mb: 2,
										}}
									>
										<Typography variant="h6">History</Typography>
										<ToggleButtonGroup
											value={timeframe}
											exclusive
											onChange={(_, value) => value && setTimeframe(value)}
											size="small"
										>
											<ToggleButton value="hour">Hour</ToggleButton>
											<ToggleButton value="day">Day</ToggleButton>
											<ToggleButton value="week">Week</ToggleButton>
											<ToggleButton value="month">Month</ToggleButton>
										</ToggleButtonGroup>
									</Box>
									{history.length === 0 ? (
										<Typography color="text.secondary">
											No history available
										</Typography>
									) : (
										<Line
											data={chartData}
											options={{
												responsive: true,
												maintainAspectRatio: true,
												plugins: {
													legend: { display: false },
													tooltip: {
														mode: 'index',
														intersect: false,
													},
												},
												scales: {
													y: {
														beginAtZero: true,
													},
												},
											}}
										/>
									)}
								</CardContent>
							</Card>
						</motion.div>
					</>
				)}
			</Box>
		</motion.div>
	);
};

interface OccupancySensorGroupDetailProps
	extends DeviceDetailBaseProps<DashboardDeviceClusterOccupancySensorGroup> {}

const OccupancySensorGroupDetail = (props: OccupancySensorGroupDetailProps): JSX.Element => {
	const [timeframe, setTimeframe] = useState<Timeframe>('24h');
	const [loading, setLoading] = useState(false);
	const roomColor = props.device.roomColor || '#555';

	const occupancy = props.cluster.mergedClusters[DeviceClusterName.OCCUPANCY_SENSING];
	const temperature = props.cluster.mergedClusters[DeviceClusterName.TEMPERATURE_MEASUREMENT];
	const humidity = props.cluster.mergedClusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT];
	const illuminance = props.cluster.mergedClusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT];

	const [tempHistory, setTempHistory] = useState<TemperatureEvent[]>([]);
	const [humidityHistory, setHumidityHistory] = useState<HumidityEvent[]>([]);
	const [illumHistory, setIllumHistory] = useState<IlluminanceEvent[]>([]);
	const [occHistory, setOccHistory] = useState<OccupancyEvent[]>([]);

	const deviceId = props.device.uniqueId;

	const hasHumidity = !!humidity;
	const hasIlluminance = !!illuminance;
	const hasOccupancy = !!occupancy;
	const hasTemperature = !!temperature;

	// Track previous values to detect changes
	const prevOccupiedRef = React.useRef(occupancy?.occupied);
	const prevTempRef = React.useRef(temperature?.temperature);
	const prevHumidityRef = React.useRef(humidity?.humidity);
	const prevIlluminanceRef = React.useRef(illuminance?.illuminance);

	const fetchHistory = React.useCallback(async () => {
		try {
			setLoading(true);

			// Fetch temperature history if available
			if (hasTemperature) {
				const response = await apiGet('device', '/temperature/:deviceId/:timeframe', {
					deviceId: deviceId,
					timeframe: TIMEFRAME_MS[timeframe].toString(),
				});
				if (response.ok) {
					const data = await response.json();
					setTempHistory(data.history || []);
				}
			}

			// Fetch humidity history if available
			if (hasHumidity) {
				const response = await apiGet('device', '/humidity/:deviceId/:timeframe', {
					deviceId: deviceId,
					timeframe: TIMEFRAME_MS[timeframe].toString(),
				});
				if (response.ok) {
					const data = await response.json();
					setHumidityHistory(data.history || []);
				}
			}

			// Fetch illuminance history if available
			if (hasIlluminance) {
				const response = await apiGet('device', '/illuminance/:deviceId/:timeframe', {
					timeframe: TIMEFRAME_MS[timeframe].toString(),
					deviceId: deviceId,
				});
				if (response.ok) {
					const data = await response.json();
					setIllumHistory(data.history || []);
				}
			}

			// Fetch occupancy history if available
			if (hasOccupancy) {
				const response = await apiGet('device', '/occupancy/:deviceId', {
					deviceId: deviceId,
				});
				if (response.ok) {
					const data = (await response.json()) as { history?: OccupancyEvent[] };
					setOccHistory(data.history || []);
				}
			}
		} catch (err) {
			console.error('Failed to fetch sensor history:', err);
		} finally {
			setLoading(false);
		}
	}, [deviceId, timeframe, hasHumidity, hasIlluminance, hasOccupancy, hasTemperature]);

	useEffect(() => {
		void fetchHistory();
	}, [fetchHistory]);

	// Refetch history when any sensor value changes significantly
	React.useEffect(() => {
		let shouldRefetch = false;

		// Check occupancy
		if (hasOccupancy && prevOccupiedRef.current !== occupancy?.occupied) {
			prevOccupiedRef.current = occupancy?.occupied;
			shouldRefetch = true;
		}

		// Check temperature (>0.1°C change)
		if (hasTemperature && temperature?.temperature !== undefined) {
			const tempDiff = Math.abs((prevTempRef.current ?? 0) - temperature.temperature);
			if (tempDiff >= 0.1) {
				prevTempRef.current = temperature.temperature;
				shouldRefetch = true;
			}
		}

		// Check humidity (>1% change)
		if (hasHumidity && humidity?.humidity !== undefined) {
			const humidityDiff = Math.abs((prevHumidityRef.current ?? 0) - humidity.humidity);
			if (humidityDiff >= 0.01) {
				prevHumidityRef.current = humidity.humidity;
				shouldRefetch = true;
			}
		}

		// Check illuminance (>10 lux change)
		if (hasIlluminance && illuminance?.illuminance !== undefined) {
			const illuminanceDiff = Math.abs(
				(prevIlluminanceRef.current ?? 0) - illuminance.illuminance
			);
			if (illuminanceDiff >= 10) {
				prevIlluminanceRef.current = illuminance.illuminance;
				shouldRefetch = true;
			}
		}

		if (shouldRefetch) {
			void fetchHistory();
		}
	}, [
		occupancy?.occupied,
		temperature?.temperature,
		humidity?.humidity,
		illuminance?.illuminance,
		hasOccupancy,
		hasTemperature,
		hasHumidity,
		hasIlluminance,
		fetchHistory,
	]);

	const formatTimestamp = (timestamp: number): string => {
		const date = new Date(timestamp);
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();
		const isYesterday =
			date.toDateString() === new Date(now.getTime() - 86400000).toDateString();

		const timeStr = date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
		});

		if (isToday) {
			return `Today at ${timeStr}`;
		}
		if (isYesterday) {
			return `Yesterday at ${timeStr}`;
		}
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const tempChartData = temperature
		? {
				labels: tempHistory
					.slice()
					.reverse()
					.map((e) => {
						const date = new Date(e.timestamp);
						if (timeframe === '1h' || timeframe === '6h' || timeframe === '24h') {
							return date.toLocaleTimeString('en-US', {
								hour: '2-digit',
								minute: '2-digit',
							});
						}
						return date.toLocaleDateString('en-US', {
							month: 'short',
							day: 'numeric',
							hour: '2-digit',
						});
					}),
				datasets: [
					{
						label: 'Temperature (°C)',
						data: tempHistory
							.slice()
							.reverse()
							.map((e) => e.temperature),
						borderColor: 'rgb(59, 130, 246)',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						tension: 0.4,
						fill: true,
					},
				],
			}
		: null;

	const humidityChartData = humidity
		? {
				labels: humidityHistory
					.slice()
					.reverse()
					.map((e) => {
						const date = new Date(e.timestamp);
						if (timeframe === '1h' || timeframe === '6h' || timeframe === '24h') {
							return date.toLocaleTimeString('en-US', {
								hour: '2-digit',
								minute: '2-digit',
							});
						}
						return date.toLocaleDateString('en-US', {
							month: 'short',
							day: 'numeric',
							hour: '2-digit',
						});
					}),
				datasets: [
					{
						label: 'Humidity (%)',
						data: humidityHistory
							.slice()
							.reverse()
							.map((e) => e.humidity * 100),
						borderColor: 'rgb(16, 185, 129)',
						backgroundColor: 'rgba(16, 185, 129, 0.1)',
						tension: 0.4,
						fill: true,
					},
				],
			}
		: null;

	const illumChartData = illuminance
		? {
				labels: illumHistory
					.slice()
					.reverse()
					.map((e) => {
						const date = new Date(e.timestamp);
						if (timeframe === '1h' || timeframe === '6h' || timeframe === '24h') {
							return date.toLocaleTimeString('en-US', {
								hour: '2-digit',
								minute: '2-digit',
							});
						}
						return date.toLocaleDateString('en-US', {
							month: 'short',
							day: 'numeric',
							hour: '2-digit',
						});
					}),
				datasets: [
					{
						label: 'Illuminance (lux)',
						data: illumHistory
							.slice()
							.reverse()
							.map((e) => e.illuminance),
						borderColor: 'rgb(251, 191, 36)',
						backgroundColor: 'rgba(251, 191, 36, 0.1)',
						tension: 0.4,
						fill: true,
					},
				],
			}
		: null;

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					style={{ color: '#2f2f2f', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					Sensor Group
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				<motion.div variants={cardVariants} initial="initial" animate="animate">
					<Card
						sx={{
							mb: 3,
							borderRadius: 3,
							boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
							background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
						}}
					>
						<CardContent>
							<Typography variant="h6" gutterBottom>
								{props.device.name}
							</Typography>

							<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
								{temperature && (
									<Box>
										<Typography variant="body2" color="text.secondary">
											Temperature
										</Typography>
										<Typography variant="h4" sx={{ color: '#3b82f6' }}>
											{temperature.temperature.toFixed(1)}°C
										</Typography>
									</Box>
								)}

								{humidity && (
									<Box>
										<Typography variant="body2" color="text.secondary">
											Humidity
										</Typography>
										<Typography variant="h4" sx={{ color: '#10b981' }}>
											{(humidity.humidity * 100).toFixed(0)}%
										</Typography>
									</Box>
								)}

								{occupancy && (
									<Box>
										<Typography variant="body2" color="text.secondary">
											Occupancy
										</Typography>
										<Chip
											label={occupancy.occupied ? 'Occupied' : 'Clear'}
											color={occupancy.occupied ? 'success' : 'default'}
											sx={{ fontWeight: 'bold', mt: 1 }}
										/>
										{occHistory.length > 0 && (
											<Typography
												variant="caption"
												color="text.secondary"
												sx={{ mt: 1 }}
											>
												Last: {formatTimestamp(occHistory[0].timestamp)}
											</Typography>
										)}
									</Box>
								)}

								{illuminance && (
									<Box>
										<Typography variant="body2" color="text.secondary">
											Illuminance
										</Typography>
										<Typography variant="h4" sx={{ color: '#fbbf24' }}>
											{illuminance.illuminance.toFixed(0)} lux
										</Typography>
									</Box>
								)}
							</Box>
						</CardContent>
					</Card>
				</motion.div>

				{/* Timeframe selector for charts */}
				{(temperature || humidity || illuminance) && (
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2, ...smoothSpring }}
					>
						<Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
							<ToggleButtonGroup
								value={timeframe}
								exclusive
								onChange={(_, value) => value && setTimeframe(value)}
								size="small"
							>
								<ToggleButton value="1h">1h</ToggleButton>
								<ToggleButton value="6h">6h</ToggleButton>
								<ToggleButton value="24h">24h</ToggleButton>
								<ToggleButton value="1week">1 week</ToggleButton>
							</ToggleButtonGroup>
						</Box>
					</motion.div>
				)}

				{loading && (
					<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
						<CircularProgress />
					</Box>
				)}

				{/* Temperature chart */}
				{!loading && temperature && tempChartData && (
					<motion.div
						variants={cardVariants}
						initial="initial"
						animate="animate"
						transition={{ delay: 0.3 }}
					>
						<Card
							sx={{
								mb: 3,
								borderRadius: 3,
								boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
								background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
							}}
						>
							<CardContent>
								<Typography
									variant="h6"
									gutterBottom
									sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
								>
									Temperature
								</Typography>
								{tempHistory.length === 0 ? (
									<Typography color="text.secondary">
										No history available
									</Typography>
								) : (
									<Line
										data={tempChartData}
										options={{
											responsive: true,
											maintainAspectRatio: true,
											plugins: {
												legend: { display: false },
												tooltip: { mode: 'index', intersect: false },
											},
											scales: { y: { beginAtZero: false } },
										}}
									/>
								)}
							</CardContent>
						</Card>
					</motion.div>
				)}

				{/* Humidity chart */}
				{!loading && humidity && humidityChartData && (
					<motion.div
						variants={cardVariants}
						initial="initial"
						animate="animate"
						transition={{ delay: 0.35 }}
					>
						<Card
							sx={{
								mb: 3,
								borderRadius: 3,
								boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
								background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
							}}
						>
							<CardContent>
								<Typography
									variant="h6"
									gutterBottom
									sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
								>
									Humidity History
								</Typography>
								{humidityHistory.length === 0 ? (
									<Typography color="text.secondary">
										No history available
									</Typography>
								) : (
									<Line
										data={humidityChartData}
										options={{
											responsive: true,
											maintainAspectRatio: true,
											plugins: {
												legend: { display: false },
												tooltip: { mode: 'index', intersect: false },
											},
											scales: { y: { beginAtZero: false, min: 0, max: 100 } },
										}}
									/>
								)}
							</CardContent>
						</Card>
					</motion.div>
				)}

				{/* Illuminance chart */}
				{!loading && illuminance && illumChartData && (
					<motion.div
						variants={cardVariants}
						initial="initial"
						animate="animate"
						transition={{ delay: 0.4 }}
					>
						<Card
							sx={{
								mb: 3,
								borderRadius: 3,
								boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
								background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
							}}
						>
							<CardContent>
								<Typography
									variant="h6"
									gutterBottom
									sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
								>
									Illuminance History
								</Typography>
								{illumHistory.length === 0 ? (
									<Typography color="text.secondary">
										No history available
									</Typography>
								) : (
									<Line
										data={illumChartData}
										options={{
											responsive: true,
											maintainAspectRatio: true,
											plugins: {
												legend: { display: false },
												tooltip: { mode: 'index', intersect: false },
											},
											scales: { y: { beginAtZero: true } },
										}}
									/>
								)}
							</CardContent>
						</Card>
					</motion.div>
				)}

				{/* Occupancy history */}
				{!loading && occupancy && (
					<motion.div
						variants={cardVariants}
						initial="initial"
						animate="animate"
						transition={{ delay: 0.5 }}
					>
						<Card
							sx={{
								borderRadius: 3,
								boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
								background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
							}}
						>
							<CardContent>
								<Typography
									variant="h6"
									gutterBottom
									sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
								>
									Occupancy History
								</Typography>
								{occHistory.length === 0 ? (
									<Typography color="text.secondary">
										No history available
									</Typography>
								) : (
									<motion.div
										variants={staggerContainer}
										initial="initial"
										animate="animate"
									>
										<List>
											{occHistory.map((event, index) => (
												<motion.div key={index} variants={staggerItem}>
													<ListItem
														sx={{
															borderLeft: 4,
															borderColor: event.occupied
																? 'success.main'
																: 'grey.400',
															mb: 1.5,
															bgcolor: 'background.paper',
															borderRadius: 2,
															boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
															transition: 'all 0.2s',
															'&:hover': {
																boxShadow:
																	'0 4px 12px rgba(0,0,0,0.1)',
																transform: 'translateX(4px)',
															},
														}}
													>
														<ListItemText
															primary={
																event.occupied
																	? 'Occupied'
																	: 'Clear'
															}
															secondary={formatTimestamp(
																event.timestamp
															)}
															primaryTypographyProps={{
																fontWeight: 600,
																color: event.occupied
																	? 'success.main'
																	: 'text.secondary',
															}}
															secondaryTypographyProps={{
																fontSize: '0.875rem',
															}}
														/>
													</ListItem>
												</motion.div>
											))}
										</List>
									</motion.div>
								)}
							</CardContent>
						</Card>
					</motion.div>
				)}
			</Box>
		</motion.div>
	);
};

interface CO2Event {
	concentration: number;
	level: number;
	timestamp: number;
}

interface AirQualityGroupDetailProps
	extends DeviceDetailBaseProps<DashboardDeviceClusterAirQualityGroup> {}

/**
 * Get air quality level info
 * AirQuality enum: Unknown=0, Good=1, Fair=2, Moderate=3, Poor=4, VeryPoor=5, ExtremelyPoor=6
 * CO2/PM2.5 level: Unknown=0, Low=1, Medium=2, High=3, Critical=4
 */
const getAirQualityLevelInfo = (
	airQuality?: number,
	co2Level?: number,
	pm25Level?: number
): { label: string; color: string; description: string } => {
	// Determine worst level from available sensors
	let worstLevel = 0;

	// Map AirQuality enum to a 0-4 scale
	if (airQuality !== undefined && airQuality > 0) {
		const mappedLevel = airQuality <= 1 ? 1 : airQuality <= 3 ? 2 : airQuality <= 4 ? 3 : 4;
		worstLevel = Math.max(worstLevel, mappedLevel);
	}

	if (co2Level !== undefined && co2Level > 0) {
		worstLevel = Math.max(worstLevel, co2Level);
	}

	if (pm25Level !== undefined && pm25Level > 0) {
		worstLevel = Math.max(worstLevel, pm25Level);
	}

	switch (worstLevel) {
		case 1:
			return {
				label: 'Good',
				color: '#10b981',
				description: 'Air quality is satisfactory',
			};
		case 2:
			return {
				label: 'Moderate',
				color: '#f59e0b',
				description: 'Air quality is acceptable',
			};
		case 3:
			return {
				label: 'Poor',
				color: '#ef4444',
				description: 'May cause discomfort for sensitive groups',
			};
		case 4:
			return {
				label: 'Critical',
				color: '#7c2d12',
				description: 'Everyone may experience health effects',
			};
		default:
			return { label: 'Unknown', color: '#6b7280', description: 'No data available' };
	}
};

const getCO2LevelLabel = (level: number): string => {
	switch (level) {
		case 1:
			return 'Good';
		case 2:
			return 'Moderate';
		case 3:
			return 'Poor';
		case 4:
			return 'Critical';
		default:
			return 'Unknown';
	}
};

const AirQualityGroupDetail = (props: AirQualityGroupDetailProps): JSX.Element => {
	const [timeframe, setTimeframe] = useState<Timeframe>('24h');
	const [loading, setLoading] = useState(false);
	const [co2History, setCo2History] = useState<CO2Event[]>([]);
	const [tempHistory, setTempHistory] = useState<TemperatureEvent[]>([]);
	const [humidityHistory, setHumidityHistory] = useState<HumidityEvent[]>([]);
	const roomColor = props.device.roomColor || '#555';

	const airQuality = props.cluster.mergedClusters[DeviceClusterName.AIR_QUALITY];
	const co2 =
		props.cluster.mergedClusters[DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT];
	const pm25 = props.cluster.mergedClusters[DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT];
	const humidity = props.cluster.mergedClusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT];
	const temperature = props.cluster.mergedClusters[DeviceClusterName.TEMPERATURE_MEASUREMENT];
	const illuminance = props.cluster.mergedClusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT];
	const onOff = props.cluster.mergedClusters[DeviceClusterName.ON_OFF];

	const deviceId = props.device.uniqueId;
	const hasCO2 = !!co2;
	const hasTemperature = !!temperature;
	const hasHumidity = !!humidity;

	const [isOn, setIsOn] = useState(onOff?.isOn ?? false);
	React.useEffect(() => {
		setIsOn(onOff?.isOn ?? false);
	}, [onOff?.isOn]);

	const handleOnOffToggle = React.useCallback(
		async (newIsOn: boolean) => {
			setIsOn(newIsOn);
			try {
				await apiPost(
					'device',
					`/cluster/${DeviceClusterName.ON_OFF}`,
					{},
					{
						deviceIds: [props.device.uniqueId],
						isOn: newIsOn,
					}
				);
			} catch (err) {
				console.error('Failed to toggle device:', err);
				setIsOn(!newIsOn);
			}
		},
		[props.device.uniqueId]
	);

	// Track previous value to detect changes
	const prevCO2Ref = React.useRef(co2?.concentration);
	const prevTempRef = React.useRef(temperature?.temperature);
	const prevHumidityRef = React.useRef(humidity?.humidity);

	const {
		label: overallLabel,
		color: overallColor,
		description,
	} = getAirQualityLevelInfo(airQuality?.airQuality, co2?.level, pm25?.level);

	const hasAnyHistory = hasCO2 || hasTemperature || hasHumidity;

	const fetchHistory = React.useCallback(async () => {
		if (!hasAnyHistory) {
			return;
		}

		try {
			setLoading(true);
			const tf = TIMEFRAME_MS[timeframe].toString();

			if (hasCO2) {
				const response = await apiGet('device', '/co2/:deviceId/:timeframe', {
					deviceId: deviceId,
					timeframe: tf,
				});
				if (response.ok) {
					const data = await response.json();
					setCo2History(data.history || []);
				}
			}
			if (hasTemperature) {
				const response = await apiGet('device', '/temperature/:deviceId/:timeframe', {
					deviceId: deviceId,
					timeframe: tf,
				});
				if (response.ok) {
					const data = await response.json();
					setTempHistory(data.history || []);
				}
			}
			if (hasHumidity) {
				const response = await apiGet('device', '/humidity/:deviceId/:timeframe', {
					deviceId: deviceId,
					timeframe: tf,
				});
				if (response.ok) {
					const data = await response.json();
					setHumidityHistory(data.history || []);
				}
			}
		} catch (err) {
			console.error('Failed to fetch history:', err);
		} finally {
			setLoading(false);
		}
	}, [deviceId, timeframe, hasCO2, hasTemperature, hasHumidity, hasAnyHistory]);

	useEffect(() => {
		void fetchHistory();
	}, [fetchHistory]);

	// Refetch history when CO2 value changes significantly (>10 ppm)
	React.useEffect(() => {
		if (hasCO2 && co2?.concentration !== undefined) {
			const co2Diff = Math.abs((prevCO2Ref.current ?? 0) - co2.concentration);
			if (co2Diff >= 10) {
				prevCO2Ref.current = co2.concentration;
				void fetchHistory();
			}
		}
	}, [co2?.concentration, hasCO2, fetchHistory]);

	// Refetch history when temperature or humidity changes significantly
	React.useEffect(() => {
		let shouldRefetch = false;
		if (hasTemperature && temperature?.temperature !== undefined) {
			const tempDiff = Math.abs((prevTempRef.current ?? 0) - temperature.temperature);
			if (tempDiff >= 0.1) {
				prevTempRef.current = temperature.temperature;
				shouldRefetch = true;
			}
		}
		if (hasHumidity && humidity?.humidity !== undefined) {
			const humidityDiff = Math.abs((prevHumidityRef.current ?? 0) - humidity.humidity);
			if (humidityDiff >= 0.01) {
				prevHumidityRef.current = humidity.humidity;
				shouldRefetch = true;
			}
		}
		if (shouldRefetch) {
			void fetchHistory();
		}
	}, [temperature?.temperature, humidity?.humidity, hasTemperature, hasHumidity, fetchHistory]);

	const co2ChartData = hasCO2
		? {
				labels: co2History
					.slice()
					.reverse()
					.map((e) => {
						const date = new Date(e.timestamp);
						if (timeframe === '1h' || timeframe === '6h' || timeframe === '24h') {
							return date.toLocaleTimeString('en-US', {
								hour: '2-digit',
								minute: '2-digit',
							});
						}
						return date.toLocaleDateString('en-US', {
							month: 'short',
							day: 'numeric',
							hour: '2-digit',
						});
					}),
				datasets: [
					{
						label: 'CO2 (ppm)',
						data: co2History
							.slice()
							.reverse()
							.map((e) => e.concentration),
						borderColor: 'rgb(59, 130, 246)',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						tension: 0.4,
						fill: true,
					},
				],
			}
		: null;

	const formatChartLabel = (timestamp: number): string => {
		const date = new Date(timestamp);
		if (timeframe === '1h' || timeframe === '6h' || timeframe === '24h') {
			return date.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
			});
		}
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
		});
	};

	const tempChartData =
		hasTemperature && tempHistory.length > 0
			? {
					labels: tempHistory
						.slice()
						.reverse()
						.map((e) => formatChartLabel(e.timestamp)),
					datasets: [
						{
							label: 'Temperature (°C)',
							data: tempHistory
								.slice()
								.reverse()
								.map((e) => e.temperature),
							borderColor: 'rgb(234, 88, 12)',
							backgroundColor: 'rgba(234, 88, 12, 0.1)',
							tension: 0.4,
							fill: true,
						},
					],
				}
			: null;

	const humidityChartData =
		hasHumidity && humidityHistory.length > 0
			? {
					labels: humidityHistory
						.slice()
						.reverse()
						.map((e) => formatChartLabel(e.timestamp)),
					datasets: [
						{
							label: 'Humidity (%)',
							data: humidityHistory
								.slice()
								.reverse()
								.map((e) => e.humidity * 100),
							borderColor: 'rgb(16, 185, 129)',
							backgroundColor: 'rgba(16, 185, 129, 0.1)',
							tension: 0.4,
							fill: true,
						},
					],
				}
			: null;

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					style={{ color: '#2f2f2f', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					Air Quality
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				{/* Summary Card */}
				<motion.div variants={cardVariants}>
					<Card
						sx={{
							mb: 2,
							background: `linear-gradient(135deg, ${overallColor} 0%, ${overallColor}dd 100%)`,
							color: 'white',
							borderRadius: 3,
						}}
					>
						<CardContent>
							<Box
								sx={{
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'center',
									textAlign: 'center',
									py: 2,
								}}
							>
								<Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
									{overallLabel}
								</Typography>
								<Typography variant="body1" sx={{ opacity: 0.9, mb: 2 }}>
									{description}
								</Typography>

								{/* Individual Sensor Values */}
								<Box
									sx={{
										display: 'flex',
										gap: 3,
										flexWrap: 'wrap',
										justifyContent: 'center',
									}}
								>
									{co2 && (
										<Box sx={{ textAlign: 'center' }}>
											<Typography variant="h4" sx={{ fontWeight: 'bold' }}>
												{co2.concentration !== undefined
													? Math.round(co2.concentration)
													: '--'}
											</Typography>
											<Typography variant="caption" sx={{ opacity: 0.8 }}>
												CO2 (ppm)
											</Typography>
											<Chip
												label={getCO2LevelLabel(co2.level)}
												size="small"
												sx={{
													backgroundColor: 'rgba(255,255,255,0.2)',
													color: 'white',
													ml: 1,
												}}
											/>
										</Box>
									)}
									{pm25 && (
										<Box sx={{ textAlign: 'center' }}>
											<Typography variant="h4" sx={{ fontWeight: 'bold' }}>
												{pm25.concentration !== undefined
													? pm25.concentration.toFixed(1)
													: '--'}
											</Typography>
											<Typography variant="caption" sx={{ opacity: 0.8 }}>
												PM2.5 (µg/m³)
											</Typography>
											<Chip
												label={getCO2LevelLabel(pm25.level)}
												size="small"
												sx={{
													backgroundColor: 'rgba(255,255,255,0.2)',
													color: 'white',
													ml: 1,
												}}
											/>
										</Box>
									)}
									{humidity && (
										<Box sx={{ textAlign: 'center' }}>
											<Typography variant="h4" sx={{ fontWeight: 'bold' }}>
												{humidity.humidity !== undefined
													? `${(humidity.humidity * 100).toFixed(0)}%`
													: '--'}
											</Typography>
											<Typography variant="caption" sx={{ opacity: 0.8 }}>
												Humidity
											</Typography>
										</Box>
									)}
									{temperature && (
										<Box sx={{ textAlign: 'center' }}>
											<Typography variant="h4" sx={{ fontWeight: 'bold' }}>
												{temperature.temperature !== undefined
													? `${temperature.temperature.toFixed(1)}°C`
													: '--'}
											</Typography>
											<Typography variant="caption" sx={{ opacity: 0.8 }}>
												Temperature
											</Typography>
										</Box>
									)}
									{illuminance && (
										<Box sx={{ textAlign: 'center' }}>
											<Typography variant="h4" sx={{ fontWeight: 'bold' }}>
												{illuminance.illuminance !== undefined
													? `${illuminance.illuminance.toFixed(0)} lux`
													: '--'}
											</Typography>
											<Typography variant="caption" sx={{ opacity: 0.8 }}>
												Illuminance
											</Typography>
										</Box>
									)}
								</Box>
							</Box>
						</CardContent>
					</Card>
				</motion.div>

				{/* OnOff control */}
				{onOff !== undefined && (
					<motion.div variants={cardVariants}>
						<Card sx={{ mb: 2, borderRadius: 3 }}>
							<CardContent>
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
									}}
								>
									<Typography variant="h6">Power</Typography>
									<FormControlLabel
										control={
											<Switch
												checked={isOn}
												onChange={(_e, checked) => {
													void handleOnOffToggle(checked);
												}}
												color="primary"
											/>
										}
										label={isOn ? 'On' : 'Off'}
									/>
								</Box>
							</CardContent>
						</Card>
					</motion.div>
				)}

				{/* Timeframe Selector */}
				{hasAnyHistory && (
					<motion.div variants={cardVariants}>
						<ToggleButtonGroup
							value={timeframe}
							exclusive
							onChange={(_e, newTimeframe) => {
								if (newTimeframe) {
									setTimeframe(newTimeframe as Timeframe);
								}
							}}
							size="small"
							fullWidth
							sx={{ mb: 2 }}
						>
							<ToggleButton value="1h">1h</ToggleButton>
							<ToggleButton value="6h">6h</ToggleButton>
							<ToggleButton value="24h">24h</ToggleButton>
							<ToggleButton value="1week">1 week</ToggleButton>
						</ToggleButtonGroup>
					</motion.div>
				)}

				{/* CO2 Chart */}
				{hasCO2 && (
					<motion.div variants={cardVariants}>
						<Card sx={{ mb: 2, borderRadius: 3 }}>
							<CardContent>
								<Typography variant="h6" sx={{ mb: 2 }}>
									CO2 History
								</Typography>
								{loading ? (
									<Box
										sx={{
											display: 'flex',
											justifyContent: 'center',
											py: 4,
										}}
									>
										<CircularProgress />
									</Box>
								) : co2ChartData && co2History.length > 0 ? (
									<Box
										sx={{
											height: 250,
											background:
												'linear-gradient(180deg, transparent 0%, rgba(59, 130, 246, 0.05) 100%)',
											borderRadius: 2,
											p: 1,
										}}
									>
										<Line
											data={co2ChartData}
											options={{
												responsive: true,
												maintainAspectRatio: false,
												plugins: {
													legend: {
														display: false,
													},
													tooltip: {
														mode: 'index',
														intersect: false,
													},
												},
												scales: {
													x: {
														display: true,
														grid: {
															display: false,
														},
														ticks: {
															maxTicksLimit: 8,
														},
													},
													y: {
														display: true,
														grid: {
															color: 'rgba(0, 0, 0, 0.08)',
														},
														suggestedMin:
															Math.min(
																...co2History.map(
																	(e) => e.concentration
																)
															) - 50,
														suggestedMax:
															Math.max(
																...co2History.map(
																	(e) => e.concentration
																)
															) + 50,
													},
												},
												interaction: {
													mode: 'nearest',
													axis: 'x',
													intersect: false,
												},
											}}
										/>
									</Box>
								) : (
									<Typography
										variant="body2"
										color="text.secondary"
										sx={{ textAlign: 'center', py: 4 }}
									>
										No CO2 data available for this timeframe
									</Typography>
								)}
							</CardContent>
						</Card>
					</motion.div>
				)}

				{/* Temperature History */}
				{hasTemperature && (
					<motion.div variants={cardVariants}>
						<Card sx={{ mb: 2, borderRadius: 3 }}>
							<CardContent>
								<Typography variant="h6" sx={{ mb: 2 }}>
									Temperature History
								</Typography>
								{loading ? (
									<Box
										sx={{
											display: 'flex',
											justifyContent: 'center',
											py: 4,
										}}
									>
										<CircularProgress />
									</Box>
								) : tempChartData ? (
									<Box
										sx={{
											height: 250,
											background:
												'linear-gradient(180deg, transparent 0%, rgba(234, 88, 12, 0.05) 100%)',
											borderRadius: 2,
											p: 1,
										}}
									>
										<Line
											data={tempChartData}
											options={{
												responsive: true,
												maintainAspectRatio: false,
												plugins: {
													legend: { display: false },
													tooltip: {
														mode: 'index',
														intersect: false,
													},
												},
												scales: {
													x: {
														display: true,
														grid: { display: false },
														ticks: { maxTicksLimit: 8 },
													},
													y: {
														display: true,
														grid: { color: 'rgba(0, 0, 0, 0.08)' },
													},
												},
												interaction: {
													mode: 'nearest',
													axis: 'x',
													intersect: false,
												},
											}}
										/>
									</Box>
								) : (
									<Typography
										variant="body2"
										color="text.secondary"
										sx={{ textAlign: 'center', py: 4 }}
									>
										No temperature data available for this timeframe
									</Typography>
								)}
							</CardContent>
						</Card>
					</motion.div>
				)}

				{/* Humidity History */}
				{hasHumidity && (
					<motion.div variants={cardVariants}>
						<Card sx={{ mb: 2, borderRadius: 3 }}>
							<CardContent>
								<Typography variant="h6" sx={{ mb: 2 }}>
									Humidity History
								</Typography>
								{loading ? (
									<Box
										sx={{
											display: 'flex',
											justifyContent: 'center',
											py: 4,
										}}
									>
										<CircularProgress />
									</Box>
								) : humidityChartData ? (
									<Box
										sx={{
											height: 250,
											background:
												'linear-gradient(180deg, transparent 0%, rgba(16, 185, 129, 0.05) 100%)',
											borderRadius: 2,
											p: 1,
										}}
									>
										<Line
											data={humidityChartData}
											options={{
												responsive: true,
												maintainAspectRatio: false,
												plugins: {
													legend: { display: false },
													tooltip: {
														mode: 'index',
														intersect: false,
													},
												},
												scales: {
													x: {
														display: true,
														grid: { display: false },
														ticks: { maxTicksLimit: 8 },
													},
													y: {
														display: true,
														grid: { color: 'rgba(0, 0, 0, 0.08)' },
													},
												},
												interaction: {
													mode: 'nearest',
													axis: 'x',
													intersect: false,
												},
											}}
										/>
									</Box>
								) : (
									<Typography
										variant="body2"
										color="text.secondary"
										sx={{ textAlign: 'center', py: 4 }}
									>
										No humidity data available for this timeframe
									</Typography>
								)}
							</CardContent>
						</Card>
					</motion.div>
				)}

				{/* CO2 Level Legend */}
				<motion.div variants={cardVariants}>
					<Card sx={{ borderRadius: 3 }}>
						<CardContent>
							<Typography variant="h6" sx={{ mb: 2 }}>
								Air Quality Levels
							</Typography>
							<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
									<Box
										sx={{
											width: 16,
											height: 16,
											borderRadius: 1,
											backgroundColor: '#10b981',
										}}
									/>
									<Typography variant="body2">
										<strong>Good</strong> - CO2 &lt; 1000 ppm
									</Typography>
								</Box>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
									<Box
										sx={{
											width: 16,
											height: 16,
											borderRadius: 1,
											backgroundColor: '#f59e0b',
										}}
									/>
									<Typography variant="body2">
										<strong>Moderate</strong> - CO2 1000-2000 ppm
									</Typography>
								</Box>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
									<Box
										sx={{
											width: 16,
											height: 16,
											borderRadius: 1,
											backgroundColor: '#ef4444',
										}}
									/>
									<Typography variant="body2">
										<strong>Poor</strong> - CO2 2000-5000 ppm
									</Typography>
								</Box>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
									<Box
										sx={{
											width: 16,
											height: 16,
											borderRadius: 1,
											backgroundColor: '#7c2d12',
										}}
									/>
									<Typography variant="body2">
										<strong>Critical</strong> - CO2 &gt; 5000 ppm
									</Typography>
								</Box>
							</Box>
						</CardContent>
					</Card>
				</motion.div>
			</Box>
		</motion.div>
	);
};

interface WindowCoveringDetailProps
	extends DeviceDetailBaseProps<DashboardDeviceClusterWindowCovering> {}

const WindowCoveringDetail = (props: WindowCoveringDetailProps): JSX.Element => {
	const [targetPosition, setTargetPosition] = useState(
		props.cluster.targetPositionLiftPercentage
	);
	const [isUpdating, setIsUpdating] = useState(false);
	const [userHasInteracted, setUserHasInteracted] = useState(false);
	const roomColor = props.device.roomColor || '#555';

	// Animate slider position from 0 to actual value on mount
	const animatedPosition = 0;
	// useAnimatedValue(
	// 	props.cluster.targetPositionLiftPercentage,
	// 	0,
	// 	500,
	// 	0
	// );

	// Use animated value initially, then switch to user-controlled value after interaction
	const displayPosition = userHasInteracted ? targetPosition : animatedPosition;

	const handlePositionChange = (newPosition: number) => {
		setUserHasInteracted(true);
		setTargetPosition(newPosition);
	};

	const handlePositionCommit = async (newPosition: number) => {
		setIsUpdating(true);
		try {
			await apiPost(
				'device',
				'/cluster/WindowCovering',
				{},
				{
					deviceIds: [props.device.uniqueId],
					targetPositionLiftPercentage: newPosition,
				}
			);
		} catch (error) {
			console.error('Failed to set window covering position:', error);
		} finally {
			setIsUpdating(false);
		}
	};

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					style={{ color: '#2f2f2f', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					Window Covering
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				<motion.div variants={cardVariants} initial="initial" animate="animate">
					<Card
						sx={{
							mb: 3,
							borderRadius: 3,
							boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
							background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
						}}
					>
						<CardContent>
							<Typography variant="h6" gutterBottom>
								{props.device.name}
							</Typography>

							{/* Animated blind visualization */}
							<WindowCoveringVisualization
								displayPosition={displayPosition}
								userHasInteracted={userHasInteracted}
							/>

							{/* Slider control */}
							<Box sx={{ px: 2 }}>
								<Typography gutterBottom>
									Position (0% = Open, 100% = Closed)
								</Typography>
								<Slider
									value={displayPosition}
									onChange={(_, value) => handlePositionChange(value)}
									onChangeCommitted={(_, value) => handlePositionCommit(value)}
									valueLabelDisplay="auto"
									min={0}
									max={100}
									disabled={isUpdating}
									sx={{
										'& .MuiSlider-thumb': {
											width: 24,
											height: 24,
										},
									}}
								/>
							</Box>

							{/* Quick action buttons */}
							<Box
								sx={{
									display: 'flex',
									gap: 2,
									px: 2,
									mt: 3,
								}}
							>
								<Button
									variant="contained"
									fullWidth
									disabled={isUpdating}
									onClick={() => {
										handlePositionChange(0);
										void handlePositionCommit(0);
									}}
									sx={{
										py: 1.5,
										fontSize: '2rem',
										minWidth: 0,
										background:
											'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
										boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
										'&:hover': {
											background:
												'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
											boxShadow: '0 6px 16px rgba(59, 130, 246, 0.4)',
										},
										'&:disabled': {
											opacity: 0.5,
										},
									}}
								>
									<KeyboardArrowUpIcon sx={{ fontSize: '2.5rem' }} />
								</Button>
								<Button
									variant="contained"
									fullWidth
									disabled={isUpdating}
									onClick={() => {
										handlePositionChange(100);
										void handlePositionCommit(100);
									}}
									sx={{
										py: 1.5,
										fontSize: '2rem',
										minWidth: 0,
										background:
											'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
										boxShadow: '0 4px 12px rgba(107, 114, 128, 0.3)',
										'&:hover': {
											background:
												'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
											boxShadow: '0 6px 16px rgba(107, 114, 128, 0.4)',
										},
										'&:disabled': {
											opacity: 0.5,
										},
									}}
								>
									<KeyboardArrowDownIcon sx={{ fontSize: '2.5rem' }} />
								</Button>
							</Box>
						</CardContent>
					</Card>
				</motion.div>
			</Box>
		</motion.div>
	);
};

interface ThermostatDetailProps extends DeviceDetailBaseProps<DashboardDeviceClusterThermostat> {}

const ThermostatDetail = (props: ThermostatDetailProps): JSX.Element => {
	const [targetTemperature, setTargetTemperature] = useState(props.cluster.targetTemperature);
	const [mode, setMode] = useState(props.cluster.mode);
	const [isUpdating, setIsUpdating] = useState(false);
	const roomColor = props.device.roomColor || '#555';

	// Circular slider state
	const [isDragging, setIsDragging] = useState(false);

	const handleModeChange = async (newMode: ThermostatMode) => {
		setMode(newMode);
		setIsUpdating(true);
		try {
			await apiPost(
				'device',
				'/cluster/Thermostat',
				{},
				{
					deviceIds: [props.device.uniqueId],
					mode: newMode,
				}
			);
		} catch (error) {
			console.error('Failed to set thermostat mode:', error);
		} finally {
			setIsUpdating(false);
		}
	};

	const handleTemperatureCommit = async () => {
		if (targetTemperature === props.cluster.targetTemperature) {
			return;
		}

		setIsUpdating(true);
		try {
			await apiPost(
				'device',
				'/cluster/Thermostat',
				{},
				{
					deviceIds: [props.device.uniqueId],
					targetTemperature,
				}
			);
		} catch (error) {
			console.error('Failed to set target temperature:', error);
		} finally {
			setIsUpdating(false);
		}
	};

	const handlePointerDown = () => {
		setIsDragging(true);
	};

	const handlePointerUp = async () => {
		if (isDragging) {
			setIsDragging(false);
			await handleTemperatureCommit();
		}
	};

	const getModeColor = (checkMode: ThermostatMode): string => {
		switch (checkMode) {
			case ThermostatMode.HEAT:
				return '#f97316';
			case ThermostatMode.COOL:
				return '#3b82f6';
			case ThermostatMode.AUTO:
				return '#10b981';
			case ThermostatMode.OFF:
			default:
				return '#6b7280';
		}
	};

	const accentColor = getModeColor(mode);

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					style={{ color: '#2f2f2f', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					Thermostat
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				<motion.div variants={cardVariants} initial="initial" animate="animate">
					<Card
						sx={{
							mb: 3,
							borderRadius: 3,
							boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
							background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
						}}
					>
						<CardContent>
							<Box
								style={{
									display: 'flex',
									flexDirection: 'column',
									justifyContent: 'center',
									alignItems: 'center',
									marginBottom: 20,
								}}
								onPointerDown={handlePointerDown}
								onPointerUp={handlePointerUp}
							>
								<Typography variant="h6" gutterBottom>
									{props.device.name}
								</Typography>

								<CircularSlider
									label={'Target'}
									knobPosition={'bottom'}
									min={props.cluster.minTemperature * 2}
									max={props.cluster.maxTemperature * 2}
									dataIndex={
										targetTemperature * 2 - props.cluster.minTemperature * 2
									}
									labelColor={accentColor}
									knobColor={accentColor}
									progressColorFrom={accentColor}
									progressColorTo={accentColor}
									renderLabelValue={
										<div
											style={{
												position: 'absolute',
												top: 0,
												left: 0,
												width: '100%',
												height: '100%',
												display: 'flex',
												flexDirection: 'column',
												justifyContent: 'center',
												alignItems: 'center',
												color: accentColor,
												userSelect: 'none',
												zIndex: 1,
											}}
										>
											<div
												style={{
													fontSize: '2.5rem',
													fontWeight: 600,
													lineHeight: 1.2,
												}}
											>
												{`${targetTemperature}°`}
											</div>
											<div
												style={{
													fontSize: '1rem',
													opacity: 0.7,
													marginTop: '0.5rem',
												}}
											>
												Current: {`${props.cluster.currentTemperature}°`}
											</div>
										</div>
									}
									onChange={(value: number) => {
										setTargetTemperature(value / 2);
									}}
								/>
							</Box>

							{/* Mode Toggle Buttons */}
							<Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
								<ToggleButtonGroup
									value={mode}
									exclusive
									onChange={(_, value) => value && void handleModeChange(value)}
									size="large"
									disabled={isUpdating}
								>
									<ToggleButton value={ThermostatMode.OFF}>Off</ToggleButton>
									<ToggleButton value={ThermostatMode.HEAT}>Heat</ToggleButton>
									<ToggleButton value={ThermostatMode.COOL}>Cool</ToggleButton>
									<ToggleButton value={ThermostatMode.AUTO}>Auto</ToggleButton>
								</ToggleButtonGroup>
							</Box>

							{/* Temperature Range Info */}
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'space-between',
									px: 2,
									pt: 2,
								}}
							>
								<Typography variant="caption" color="text.secondary">
									Min: {props.cluster.minTemperature}°C
								</Typography>
								<Typography variant="caption" color="text.secondary">
									Max: {props.cluster.maxTemperature}°C
								</Typography>
							</Box>
						</CardContent>
					</Card>
				</motion.div>
			</Box>
		</motion.div>
	);
};

interface ActionsDetailProps extends DeviceDetailBaseProps<DashboardDeviceClusterActions> {}

const ActionsDetail = (props: ActionsDetailProps): JSX.Element => {
	const [executingActionId, setExecutingActionId] = useState<number | null>(null);
	const roomColor = props.device.roomColor || '#555';

	const handleExecuteAction = async (actionId: number) => {
		setExecutingActionId(actionId);
		try {
			const response = await apiPost(
				'device',
				'/cluster/Actions',
				{},
				{
					deviceIds: [props.device.uniqueId],
					actionId,
				}
			);
			if (!response.ok) {
				console.error('Failed to execute action');
			}
		} catch (error) {
			console.error('Failed to execute action:', error);
		} finally {
			setExecutingActionId(null);
		}
	};

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					style={{ color: '#2f2f2f', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					Actions
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				<motion.div variants={cardVariants} initial="initial" animate="animate">
					<Card
						sx={{
							mb: 3,
							borderRadius: 3,
							boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
							background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
						}}
					>
						<CardContent sx={{ p: 3 }}>
							<Typography
								variant="h6"
								gutterBottom
								sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
							>
								{props.device.name}
							</Typography>
							<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
								Select an action to execute
							</Typography>
						</CardContent>
					</Card>
				</motion.div>

				<motion.div
					variants={cardVariants}
					initial="initial"
					animate="animate"
					transition={{ delay: 0.1 }}
				>
					<Card
						sx={{
							borderRadius: 3,
							boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
							background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
						}}
					>
						<CardContent sx={{ p: 3 }}>
							<Typography
								variant="h6"
								gutterBottom
								sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
							>
								Available Actions
							</Typography>
							<motion.div
								variants={staggerContainer}
								initial="initial"
								animate="animate"
							>
								<Box
									sx={{
										display: 'flex',
										flexDirection: 'column',
										gap: 2,
										mt: 2,
									}}
								>
									{props.cluster.actions.map((action) => {
										const isActive = action.id === props.cluster.activeActionId;
										const isExecuting = action.id === executingActionId;

										return (
											<motion.div
												key={action.id}
												variants={staggerItem}
												whileHover={
													isExecuting ? {} : { scale: 1.02, x: 4 }
												}
												whileTap={isExecuting ? {} : { scale: 0.98 }}
												transition={smoothSpring}
											>
												<Box
													onClick={() =>
														!isExecuting &&
														void handleExecuteAction(action.id)
													}
													sx={{
														p: 2.5,
														borderRadius: 2,
														border: '2px solid',
														borderColor: isActive
															? 'primary.main'
															: 'divider',
														backgroundColor: isActive
															? 'rgba(25, 118, 210, 0.08)'
															: 'background.paper',
														cursor: isExecuting ? 'wait' : 'pointer',
														boxShadow: isActive
															? '0 2px 8px rgba(25, 118, 210, 0.2)'
															: '0 1px 3px rgba(0,0,0,0.05)',
														transition: 'all 0.2s',
														'&:hover': {
															backgroundColor: isActive
																? 'rgba(25, 118, 210, 0.12)'
																: 'rgba(0, 0, 0, 0.04)',
															borderColor: 'primary.main',
															boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
														},
													}}
												>
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															justifyContent: 'space-between',
														}}
													>
														<Typography
															variant="body1"
															sx={{
																fontWeight: isActive ? 600 : 500,
															}}
														>
															{action.name}
														</Typography>
														{isActive && (
															<Chip
																label="Active"
																color="primary"
																size="small"
																sx={{ fontWeight: 600 }}
															/>
														)}
														{isExecuting && (
															<CircularProgress size={20} />
														)}
													</Box>
												</Box>
											</motion.div>
										);
									})}
								</Box>
							</motion.div>
						</CardContent>
					</Card>
				</motion.div>
			</Box>
		</motion.div>
	);
};

interface OnOffDetailProps extends DeviceDetailBaseProps<DashboardDeviceClusterOnOff> {}

const OnOffDetail = (props: OnOffDetailProps): JSX.Element => {
	const energyCluster =
		props.cluster.mergedClusters?.[DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT];
	const powerCluster =
		props.cluster.mergedClusters?.[DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT];
	const colorControlCluster = props.cluster.mergedClusters?.[DeviceClusterName.COLOR_CONTROL];
	const levelControlCluster = props.cluster.mergedClusters?.[DeviceClusterName.LEVEL_CONTROL];

	const [isOn, setIsOn] = useState(props.cluster.isOn);
	const [level, setLevel] = useState(levelControlCluster?.currentLevel ?? 1);
	const [colorTemperature, setColorTemperature] = useState(
		colorControlCluster && 'colorTemperature' in colorControlCluster
			? (colorControlCluster.colorTemperature ?? 3000)
			: 3000
	);
	const [isUpdating, setIsUpdating] = useState(false);
	const roomColor = props.device.roomColor || '#555';

	const levelCommitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const colorTemperatureCommitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (levelCommitTimeoutRef.current) {
				clearTimeout(levelCommitTimeoutRef.current);
			}
			if (colorTemperatureCommitTimeoutRef.current) {
				clearTimeout(colorTemperatureCommitTimeoutRef.current);
			}
		};
	}, []);

	// Sync state with props when they change
	useEffect(() => {
		setIsOn(props.cluster.isOn);
	}, [props.cluster.isOn]);

	useEffect(() => {
		if (levelControlCluster?.currentLevel !== undefined) {
			setLevel(levelControlCluster.currentLevel);
		}
	}, [levelControlCluster?.currentLevel]);

	useEffect(() => {
		if (
			colorControlCluster &&
			'colorTemperature' in colorControlCluster &&
			colorControlCluster.colorTemperature !== undefined
		) {
			setColorTemperature(colorControlCluster.colorTemperature);
		}
	}, [colorControlCluster]);

	const handleToggle = async (checked: boolean) => {
		setIsUpdating(true);
		try {
			await apiPost(
				'device',
				'/cluster/OnOff',
				{},
				{
					deviceIds: [props.device.uniqueId],
					isOn: checked,
				}
			);
			setIsOn(checked);
		} catch (error) {
			console.error('Failed to toggle device:', error);
		} finally {
			setIsUpdating(false);
		}
	};

	const handleLevelChange = (_event: Event, newValue: number | number[]) => {
		const newLevel =
			(typeof newValue === 'number' ? newValue : newValue[0]) * levelControlCluster!.step;
		setLevel(newLevel);

		// Debounce API call
		if (levelCommitTimeoutRef.current) {
			clearTimeout(levelCommitTimeoutRef.current);
		}
		levelCommitTimeoutRef.current = setTimeout(async () => {
			try {
				await apiPost(
					'device',
					'/cluster/LevelControl',
					{},
					{
						deviceIds: [props.device.uniqueId],
						level: newLevel,
					}
				);
			} catch (error) {
				console.error('Failed to update level:', error);
			}
		}, 300);
	};

	const handleColorTemperatureChange = (_event: Event, newValue: number | number[]) => {
		const newTemp = typeof newValue === 'number' ? newValue : newValue[0];
		setColorTemperature(newTemp);

		// Debounce API call
		if (colorTemperatureCommitTimeoutRef.current) {
			clearTimeout(colorTemperatureCommitTimeoutRef.current);
		}
		colorTemperatureCommitTimeoutRef.current = setTimeout(async () => {
			try {
				await apiPost(
					'device',
					'/cluster/ColorControl',
					{},
					{
						deviceIds: [props.device.uniqueId],
						colorTemperature: newTemp,
					}
				);
			} catch (error) {
				console.error('Failed to update color temperature:', error);
			}
		}, 300);
	};

	const formatPower = (watts: number): string => {
		if (watts >= 1000) {
			return `${(watts / 1000).toFixed(1)} kW`;
		}
		return `${watts} W`;
	};

	const hasColorControl = !!colorControlCluster;
	const hasColorTemperature = hasColorControl && 'colorTemperature' in colorControlCluster;
	const hasLevelControl = !!levelControlCluster;
	const hasEnergyData = !!energyCluster || !!powerCluster;
	const minColorTemp =
		hasColorTemperature && 'minColorTemperature' in colorControlCluster
			? (colorControlCluster.minColorTemperature ?? 2000)
			: 2000;
	const maxColorTemp =
		hasColorTemperature && 'maxColorTemperature' in colorControlCluster
			? (colorControlCluster.maxColorTemperature ?? 6500)
			: 6500;

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					style={{ color: '#2f2f2f', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					{props.device.name}
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				<motion.div
					variants={cardVariants}
					initial="initial"
					animate="animate"
					transition={{ delay: 0 }}
				>
					<Card
						sx={{
							mb: 3,
							borderRadius: 3,
							boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
							background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
						}}
					>
						<CardContent sx={{ p: { xs: 2, sm: 3 } }}>
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									mb: 4,
								}}
							>
								<Typography
									variant="h5"
									sx={{
										fontWeight: 600,
										letterSpacing: '-0.02em',
									}}
								>
									{props.device.name}
								</Typography>
								<FormControlLabel
									control={
										<Switch
											checked={isOn}
											onChange={(e) => void handleToggle(e.target.checked)}
											disabled={isUpdating}
											sx={{
												'& .MuiSwitch-switchBase.Mui-checked': {
													color: '#f59e0b',
												},
												'& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track':
													{
														backgroundColor: '#f59e0b',
														opacity: 0.5,
													},
											}}
										/>
									}
									label={
										<Typography
											sx={{
												fontSize: '0.875rem',
												fontWeight: 500,
												opacity: 0.8,
											}}
										>
											{isOn ? 'On' : 'Off'}
										</Typography>
									}
								/>
							</Box>

							{/* Level Control Section */}
							{hasLevelControl && (
								<Box sx={{ mb: 4 }}>
									<Typography
										variant="h6"
										sx={{
											fontWeight: 600,
											mb: 2,
											opacity: 0.9,
										}}
									>
										{levelControlCluster.levelName[0].toUpperCase() +
											levelControlCluster.levelName.slice(1)}
									</Typography>
									<Box sx={{ px: 1 }}>
										<Slider
											value={level * (1 / levelControlCluster.step)}
											onChange={handleLevelChange}
											min={0}
											max={1 / levelControlCluster.step}
											step={1}
											disabled={isUpdating || !isOn}
											sx={{
												color: '#f59e0b',
												'& .MuiSlider-thumb': {
													width: 20,
													height: 20,
												},
											}}
										/>
										<Box
											sx={{
												display: 'flex',
												justifyContent: 'space-between',
												mt: 1,
											}}
										>
											<Typography variant="caption" sx={{ opacity: 0.7 }}>
												0
											</Typography>
											<Typography
												variant="h6"
												sx={{
													fontWeight: 'bold',
													color: '#f59e0b',
												}}
											>
												{Math.round(level * (1 / levelControlCluster.step))}
											</Typography>
											<Typography variant="caption" sx={{ opacity: 0.7 }}>
												{1 / levelControlCluster.step}
											</Typography>
										</Box>
									</Box>
								</Box>
							)}

							{/* Color Temperature Section */}
							{hasColorTemperature && (
								<Box sx={{ mb: 4 }}>
									<Typography
										variant="h6"
										sx={{
											fontWeight: 600,
											mb: 2,
											opacity: 0.9,
										}}
									>
										Color Temperature
									</Typography>
									<Box sx={{ px: 1 }}>
										<Slider
											value={colorTemperature}
											onChange={handleColorTemperatureChange}
											min={minColorTemp}
											max={maxColorTemp}
											step={50}
											disabled={isUpdating || !isOn}
											sx={{
												color: '#f59e0b',
												'& .MuiSlider-thumb': {
													width: 20,
													height: 20,
												},
											}}
										/>
										<Box
											sx={{
												display: 'flex',
												justifyContent: 'space-between',
												mt: 1,
											}}
										>
											<Typography variant="caption" sx={{ opacity: 0.7 }}>
												Warm ({minColorTemp}K)
											</Typography>
											<Typography
												variant="h6"
												sx={{
													fontWeight: 'bold',
													color: '#f59e0b',
												}}
											>
												{colorTemperature}K
											</Typography>
											<Typography variant="caption" sx={{ opacity: 0.7 }}>
												Cool ({maxColorTemp}K)
											</Typography>
										</Box>
									</Box>
								</Box>
							)}

							{/* Energy/Power Display Section */}
							{hasEnergyData && (
								<Box>
									<Typography
										variant="h6"
										sx={{
											fontWeight: 600,
											mb: 2,
											opacity: 0.9,
										}}
									>
										Energy Usage
									</Typography>
									<Box
										sx={{
											display: 'flex',
											flexDirection: 'column',
											gap: 2,
										}}
									>
										{powerCluster && (
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'center',
													p: 2,
													backgroundColor: 'rgba(0, 0, 0, 0.2)',
													borderRadius: 2,
												}}
											>
												<Typography variant="body1" sx={{ opacity: 0.9 }}>
													Current Power
												</Typography>
												<Typography
													variant="h5"
													sx={{
														fontWeight: 'bold',
														color: '#f59e0b',
													}}
												>
													{formatPower(powerCluster.activePower)}
												</Typography>
											</Box>
										)}
										{energyCluster && (
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'center',
													p: 2,
													backgroundColor: 'rgba(0, 0, 0, 0.2)',
													borderRadius: 2,
												}}
											>
												<Typography variant="body1" sx={{ opacity: 0.9 }}>
													Total Energy
												</Typography>
												<Typography
													variant="h5"
													sx={{
														fontWeight: 'bold',
														color: '#f59e0b',
													}}
												>
													{energyCluster.totalEnergy} kWh
												</Typography>
											</Box>
										)}
									</Box>
								</Box>
							)}
						</CardContent>
					</Card>
				</motion.div>
			</Box>
		</motion.div>
	);
};

interface ColorControlDetailProps
	extends DeviceDetailBaseProps<DashboardDeviceClusterColorControlXY> {}

const ColorControlDetail = (props: ColorControlDetailProps): JSX.Element => {
	const [hue, setHue] = useState(props.cluster.color.hue);
	const [saturation, setSaturation] = useState(props.cluster.color.saturation);
	const [value, setValue] = useState(props.cluster.color.value);
	const [brightness, setBrightness] = useState(
		props.cluster.mergedClusters[DeviceClusterName.LEVEL_CONTROL]?.currentLevel ??
			props.cluster.color.value
	);
	const [isOn, setIsOn] = useState(
		props.cluster.mergedClusters[DeviceClusterName.ON_OFF]?.isOn ?? true
	);
	const [isUpdating, setIsUpdating] = useState(false);
	const [executingActionId, setExecutingActionId] = useState<number | null>(null);
	const roomColor = props.device.roomColor || '#555';
	const colorCommitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const brightnessCommitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const hasLevelControl =
		props.cluster.mergedClusters[DeviceClusterName.LEVEL_CONTROL] !== undefined;
	const actionsCluster = props.cluster.mergedClusters[DeviceClusterName.ACTIONS];

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (colorCommitTimeoutRef.current) {
				clearTimeout(colorCommitTimeoutRef.current);
			}
			if (brightnessCommitTimeoutRef.current) {
				clearTimeout(brightnessCommitTimeoutRef.current);
			}
		};
	}, []);

	const hsvToHex = (h: number, s: number, v: number): string => {
		const hNorm = h / 360;
		const sNorm = s / 100;
		const vNorm = v / 100;

		const i = Math.floor(hNorm * 6);
		const f = hNorm * 6 - i;
		const p = vNorm * (1 - sNorm);
		const q = vNorm * (1 - f * sNorm);
		const t = vNorm * (1 - (1 - f) * sNorm);

		let r: number, g: number, b: number;
		switch (i % 6) {
			case 0:
				r = vNorm;
				g = t;
				b = p;
				break;
			case 1:
				r = q;
				g = vNorm;
				b = p;
				break;
			case 2:
				r = p;
				g = vNorm;
				b = t;
				break;
			case 3:
				r = p;
				g = q;
				b = vNorm;
				break;
			case 4:
				r = t;
				g = p;
				b = vNorm;
				break;
			case 5:
				r = vNorm;
				g = p;
				b = q;
				break;
			default:
				r = 0;
				g = 0;
				b = 0;
		}

		const toHex = (n: number) => {
			const hex = Math.round(n * 255).toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		};

		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	};

	const handleColorChange = (newColor: { h: number; s: number; v: number }) => {
		setHue(newColor.h);
		setSaturation(newColor.s);
		// Only update value if no LevelControl available
		if (!hasLevelControl) {
			setValue(newColor.v);
		}

		// Debounce the API call
		if (colorCommitTimeoutRef.current) {
			clearTimeout(colorCommitTimeoutRef.current);
		}
		colorCommitTimeoutRef.current = setTimeout(() => {
			void handleColorCommit();
		}, 100);
	};

	const handleColorCommit = async () => {
		setIsUpdating(true);
		try {
			await apiPost(
				'device',
				`/cluster/${DeviceClusterName.COLOR_CONTROL}`,
				{},
				{
					deviceIds: [props.device.uniqueId],
					hue,
					saturation,
					// Only send value if no LevelControl available
					...(hasLevelControl ? {} : { value }),
				}
			);
		} catch (error) {
			console.error('Failed to set color:', error);
		} finally {
			setIsUpdating(false);
		}
	};

	const handleBrightnessChange = (newBrightness: number) => {
		setBrightness(newBrightness);

		// Debounce the API call
		if (brightnessCommitTimeoutRef.current) {
			clearTimeout(brightnessCommitTimeoutRef.current);
		}
		brightnessCommitTimeoutRef.current = setTimeout(() => {
			void handleBrightnessCommit();
		}, 100);
	};

	const handleBrightnessCommit = async () => {
		setIsUpdating(true);
		try {
			if (hasLevelControl) {
				// Use LevelControl cluster
				await apiPost(
					'device',
					`/cluster/${DeviceClusterName.LEVEL_CONTROL}`,
					{},
					{
						deviceIds: [props.device.uniqueId],
						level: brightness,
					}
				);
			} else {
				// Fall back to ColorControl with value
				await apiPost(
					'device',
					`/cluster/${DeviceClusterName.COLOR_CONTROL}`,
					{},
					{
						deviceIds: [props.device.uniqueId],
						hue,
						saturation,
						value: brightness,
					}
				);
			}
		} catch (error) {
			console.error('Failed to set brightness:', error);
		} finally {
			setIsUpdating(false);
		}
	};

	const handleToggle = async (newIsOn: boolean) => {
		setIsOn(newIsOn);
		try {
			await apiPost(
				'device',
				`/cluster/${DeviceClusterName.ON_OFF}`,
				{},
				{
					deviceIds: [props.device.uniqueId],
					isOn: newIsOn,
				}
			);
		} catch (error) {
			console.error('Failed to toggle device:', error);
			setIsOn(!newIsOn); // Revert on error
		}
	};

	const handlePresetColor = async (presetHue: number, presetSat: number) => {
		setHue(presetHue);
		setSaturation(presetSat);
		// Only update value if no LevelControl
		if (!hasLevelControl) {
			setValue(100);
		}
		setIsUpdating(true);
		try {
			await apiPost(
				'device',
				`/cluster/${DeviceClusterName.COLOR_CONTROL}`,
				{},
				{
					deviceIds: [props.device.uniqueId],
					hue: presetHue,
					saturation: presetSat,
					// Only send value if no LevelControl
					...(hasLevelControl ? {} : { value: 1 }),
				}
			);
		} catch (error) {
			console.error('Failed to set preset color:', error);
		} finally {
			setIsUpdating(false);
		}
	};

	const handleExecuteAction = async (actionId: number) => {
		setExecutingActionId(actionId);
		try {
			const response = await apiPost(
				'device',
				'/cluster/Actions',
				{},
				{
					deviceIds: [props.device.uniqueId],
					actionId,
				}
			);
			if (!response.ok) {
				console.error('Failed to execute action');
			}
		} catch (error) {
			console.error('Failed to execute action:', error);
		} finally {
			setExecutingActionId(null);
		}
	};

	// Use brightness for display (from LevelControl if available, otherwise from HSV value)
	const displayBrightness = hasLevelControl ? brightness * 100 : value;
	const currentColor = hsvToHex(hue, saturation, displayBrightness);

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					variant="h6"
					sx={{
						color: '#2f2f2f',
						fontWeight: 600,
						letterSpacing: '-0.02em',
					}}
				>
					Color Control
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				{props.device.managementUrl && (
					<motion.div variants={cardVariants} initial="initial" animate="animate">
						<Alert
							severity="info"
							sx={{
								mb: 3,
								borderRadius: 2,
								boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
							}}
						>
							Manage this device at{' '}
							<Link
								href={props.device.managementUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								{props.device.managementUrl}
							</Link>
						</Alert>
					</motion.div>
				)}

				<motion.div
					variants={cardVariants}
					initial="initial"
					animate="animate"
					transition={{ delay: 0.1 }}
				>
					<Card
						sx={{
							mb: 3,
							borderRadius: 3,
							boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
							background: 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)',
						}}
					>
						<CardContent sx={{ p: { xs: 2, sm: 3 } }}>
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									mb: 4,
								}}
							>
								<Typography
									variant="h5"
									sx={{
										fontWeight: 600,
										letterSpacing: '-0.02em',
									}}
								>
									{props.device.name}
								</Typography>
								{props.cluster.mergedClusters[DeviceClusterName.ON_OFF] !==
									undefined && (
									<FormControlLabel
										control={
											<Switch
												checked={isOn}
												onChange={(e) =>
													void handleToggle(e.target.checked)
												}
												disabled={isUpdating}
												sx={{
													'& .MuiSwitch-switchBase.Mui-checked': {
														color: currentColor,
													},
													'& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track':
														{
															backgroundColor: currentColor,
															opacity: 0.5,
														},
												}}
											/>
										}
										label={
											<Typography
												sx={{
													fontSize: '0.875rem',
													fontWeight: 500,
													opacity: 0.8,
												}}
											>
												{isOn ? 'On' : 'Off'}
											</Typography>
										}
									/>
								)}
							</Box>

							{/* Color wheel */}
							<motion.div
								initial={{ scale: 0.9, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								transition={{ delay: 0.2, ...smoothSpring }}
							>
								<Box
									sx={{
										display: 'flex',
										justifyContent: 'center',
										my: 4,
										position: 'relative',
									}}
								>
									<Box
										sx={{
											borderRadius: '50%',
											padding: 2,
											background: 'rgba(255, 255, 255, 0.5)',
											boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
										}}
									>
										<Wheel
											color={{ h: hue, s: saturation, v: 100, a: 1 }}
											onChange={(color) =>
												handleColorChange({
													h: color.hsv.h,
													s: color.hsv.s,
													v: color.hsv.v,
												})
											}
											width={280}
											height={280}
										/>
									</Box>
								</Box>
							</motion.div>

							{/* Brightness slider */}
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.3, ...smoothSpring }}
							>
								<Box sx={{ px: 3, mb: 4 }}>
									<Typography
										gutterBottom
										sx={{
											fontSize: '0.875rem',
											fontWeight: 600,
											color: 'text.primary',
											mb: 2,
											letterSpacing: '0.02em',
											textTransform: 'uppercase',
											opacity: 0.8,
										}}
									>
										Brightness{' '}
										{hasLevelControl && `(${DeviceClusterName.LEVEL_CONTROL})`}
									</Typography>
									<Slider
										value={displayBrightness}
										onChange={(_, newValue) => handleBrightnessChange(newValue)}
										onChangeCommitted={() => void handleBrightnessCommit()}
										valueLabelDisplay="auto"
										min={0}
										max={100}
										disabled={isUpdating}
										sx={{
											'& .MuiSlider-track': {
												background: `linear-gradient(to right, #000, ${hsvToHex(hue, saturation, 100)})`,
												border: 'none',
												height: 8,
												borderRadius: 4,
											},
											'& .MuiSlider-rail': {
												backgroundColor: '#e5e7eb',
												opacity: 1,
												height: 8,
												borderRadius: 4,
											},
											'& .MuiSlider-thumb': {
												width: 24,
												height: 24,
												backgroundColor: '#fff',
												border: '3px solid currentColor',
												boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
												transition: 'all 0.2s ease',
												'&:hover, &.Mui-focusVisible': {
													boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
													transform: 'scale(1.1)',
												},
											},
											'& .MuiSlider-valueLabel': {
												backgroundColor: 'rgba(0,0,0,0.85)',
												borderRadius: '8px',
												fontSize: '0.875rem',
												fontWeight: 600,
												padding: '4px 8px',
											},
										}}
									/>
								</Box>
							</motion.div>

							{/* Color presets */}
							<ColorPresets
								isUpdating={isUpdating}
								onPresetClick={handlePresetColor}
							/>

							{/* Preview */}
							<motion.div
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.4, ...smoothSpring }}
							>
								<Card
									sx={{
										height: 100,
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										justifyContent: 'center',
										borderRadius: 3,
										boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
										overflow: 'hidden',
										position: 'relative',
										'&::before': {
											content: '""',
											position: 'absolute',
											inset: 0,
											background: `linear-gradient(135deg, ${currentColor} 0%, ${currentColor}dd 100%)`,
											transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
										},
									}}
								>
									<Box
										sx={{
											position: 'relative',
											zIndex: 1,
											textAlign: 'center',
										}}
									>
										<Typography
											sx={{
												color: 'white',
												fontSize: '1rem',
												fontWeight: 600,
												letterSpacing: '0.1em',
												textShadow: '0 2px 8px rgba(0,0,0,0.4)',
												mb: 0.5,
											}}
										>
											PREVIEW
										</Typography>
										<Typography
											sx={{
												color: 'white',
												fontSize: '0.875rem',
												fontWeight: 500,
												letterSpacing: '0.05em',
												textShadow: '0 1px 4px rgba(0,0,0,0.4)',
												opacity: 0.95,
												fontFamily: 'monospace',
											}}
										>
											{currentColor.toUpperCase()}
										</Typography>
									</Box>
								</Card>
							</motion.div>
						</CardContent>
					</Card>
				</motion.div>

				{/* Actions Section */}
				{actionsCluster && actionsCluster.actions.length > 0 && (
					<DeviceActionsCard
						actionsCluster={actionsCluster}
						executingActionId={executingActionId}
						onExecuteAction={handleExecuteAction}
					/>
				)}
			</Box>
		</motion.div>
	);
};

interface FridgeEvent {
	timestamp: number;
	fridgeTempC: number | null;
	freezerTempC: number | null;
	freezerDoorOpen: boolean | null;
	coolerDoorOpen: boolean | null;
}

interface FridgeDetailProps extends DeviceDetailBaseProps<DashboardDeviceClusterFridge> {}

const FridgeDetail = (props: FridgeDetailProps): JSX.Element => {
	const cluster = props.cluster;
	const roomColor = props.device.roomColor || '#0ea5e9';
	const freezerOpen = cluster.freezerDoorOpen;
	const coolerOpen = cluster.coolerDoorOpen;
	const [history, setHistory] = useState<FridgeEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [timeframe, setTimeframe] = useState<Timeframe>('24h');
	const deviceId = props.device.uniqueId;

	const formatTemp = (temp: number | undefined): string =>
		temp !== undefined ? `${temp.toFixed(1)}°C` : '—';

	const fetchHistory = React.useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await apiGet('device', '/fridge/:deviceId/:timeframe', {
				deviceId,
				timeframe: TIMEFRAME_MS[timeframe].toString(),
			});
			if (!response.ok) {
				throw new Error('Failed to fetch fridge history');
			}
			const data = await response.json();
			setHistory(data.history || []);
		} catch (err) {
			setError('Failed to load temperature history');
			console.error('Failed to fetch fridge history:', err);
		} finally {
			setLoading(false);
		}
	}, [deviceId, timeframe]);

	useEffect(() => {
		void fetchHistory();
	}, [fetchHistory]);

	const chartData = React.useMemo(() => {
		const reversed = [...history].reverse();
		const formatLabel = (ts: number): string => {
			const date = new Date(ts);
			if (timeframe === '1h' || timeframe === '6h') {
				return date.toLocaleTimeString('en-US', {
					hour: '2-digit',
					minute: '2-digit',
				});
			}
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
			});
		};
		return {
			labels: reversed.map((e) => formatLabel(e.timestamp)),
			datasets: [
				{
					label: 'Fridge (°C)',
					data: reversed.map((e) => e.fridgeTempC),
					borderColor: 'rgb(59, 130, 246)',
					backgroundColor: 'rgba(59, 130, 246, 0.1)',
					tension: 0.4,
					fill: true,
				},
				{
					label: 'Freezer (°C)',
					data: reversed.map((e) => e.freezerTempC),
					borderColor: 'rgb(14, 165, 233)',
					backgroundColor: 'rgba(14, 165, 233, 0.1)',
					tension: 0.4,
					fill: true,
				},
			],
		};
	}, [history, timeframe]);

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#fff' }} />
				</IconButton>
				<Typography
					style={{ color: '#fff', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					{props.device.name}
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				<motion.div variants={cardVariants} initial="initial" animate="animate">
					<Card
						sx={{
							mb: 3,
							borderRadius: 3,
							boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
							overflow: 'hidden',
						}}
					>
						<CardContent>
							<Typography variant="subtitle2" color="text.secondary" gutterBottom>
								Fridge status
							</Typography>
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'center',
									my: 3,
									position: 'relative',
									height: 220,
								}}
							>
								{/* CSS/SVG Fridge visualization */}
								<Box
									component="svg"
									viewBox="0 0 160 220"
									sx={{
										width: '100%',
										maxWidth: 160,
										height: 220,
										filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))',
									}}
								>
									<defs>
										<linearGradient
											id="fridgeBody"
											x1="0%"
											y1="0%"
											x2="100%"
											y2="0%"
										>
											<stop offset="0%" stopColor="#e5e7eb" />
											<stop offset="50%" stopColor="#f9fafb" />
											<stop offset="100%" stopColor="#e5e7eb" />
										</linearGradient>
										<linearGradient
											id="fridgeCold"
											x1="0%"
											y1="0%"
											x2="0%"
											y2="100%"
										>
											<stop offset="0%" stopColor="#bfdbfe" />
											<stop offset="100%" stopColor="#93c5fd" />
										</linearGradient>
									</defs>
									{/* Main body */}
									<rect
										x="20"
										y="10"
										width="120"
										height="200"
										rx="8"
										fill="url(#fridgeBody)"
										stroke="#d1d5db"
										strokeWidth="2"
									/>
									{/* Divider between freezer and cooler */}
									<line
										x1="20"
										y1="100"
										x2="140"
										y2="100"
										stroke="#9ca3af"
										strokeWidth="2"
									/>
									{/* Freezer interior */}
									<rect
										x="28"
										y="18"
										width="44"
										height="72"
										rx="4"
										fill="url(#fridgeCold)"
										opacity={freezerOpen ? 0.6 : 1}
									/>
									{/* Cooler interior */}
									<rect
										x="28"
										y="108"
										width="44"
										height="92"
										rx="4"
										fill="url(#fridgeCold)"
										opacity={coolerOpen ? 0.6 : 1}
									/>
									{/* Freezer door - swings when open */}
									<g
										transform={
											freezerOpen
												? 'translate(72, 18) rotate(-25 22 36)'
												: 'translate(0, 0)'
										}
									>
										<rect
											x="72"
											y="18"
											width="36"
											height="72"
											rx="4"
											fill="url(#fridgeBody)"
											stroke="#d1d5db"
											strokeWidth="2"
										/>
										<rect
											x="78"
											y="28"
											width="24"
											height="52"
											rx="2"
											fill="#bfdbfe"
											opacity="0.5"
										/>
									</g>
									{/* Cooler door */}
									<g
										transform={
											coolerOpen
												? 'translate(72, 108) rotate(-25 22 46)'
												: 'translate(0, 0)'
										}
									>
										<rect
											x="72"
											y="108"
											width="36"
											height="92"
											rx="4"
											fill="url(#fridgeBody)"
											stroke="#d1d5db"
											strokeWidth="2"
										/>
										<rect
											x="78"
											y="118"
											width="24"
											height="72"
											rx="2"
											fill="#bfdbfe"
											opacity="0.5"
										/>
									</g>
								</Box>
							</Box>

							<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
								<Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
									<Card variant="outlined" sx={{ flex: 1, minWidth: 140 }}>
										<CardContent>
											<Typography variant="caption" color="text.secondary">
												Freezer
											</Typography>
											<Typography variant="h6">
												{formatTemp(cluster.freezerTempC)}
											</Typography>
											<Chip
												label={freezerOpen ? 'Open' : 'Closed'}
												size="small"
												color={freezerOpen ? 'warning' : 'default'}
												sx={{ mt: 1 }}
											/>
										</CardContent>
									</Card>
									<Card variant="outlined" sx={{ flex: 1, minWidth: 140 }}>
										<CardContent>
											<Typography variant="caption" color="text.secondary">
												Cooler
											</Typography>
											<Typography variant="h6">
												{formatTemp(cluster.fridgeTempC)}
											</Typography>
											<Chip
												label={coolerOpen ? 'Open' : 'Closed'}
												size="small"
												color={coolerOpen ? 'warning' : 'default'}
												sx={{ mt: 1 }}
											/>
										</CardContent>
									</Card>
								</Box>

								{loading && (
									<Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
										<CircularProgress size={32} />
									</Box>
								)}
								{error && (
									<Alert severity="error" sx={{ mt: 2 }}>
										{error}
									</Alert>
								)}
								{!loading && !error && (
									<motion.div
										variants={cardVariants}
										initial="initial"
										animate="animate"
										transition={{ delay: 0.1 }}
									>
										<Card
											sx={{
												mt: 3,
												borderRadius: 3,
												boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
												background:
													'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
												border: '1px solid rgba(14, 165, 233, 0.2)',
											}}
										>
											<CardContent>
												<Box
													sx={{
														display: 'flex',
														justifyContent: 'space-between',
														alignItems: 'center',
														mb: 2,
													}}
												>
													<Typography variant="h6">Temperature history</Typography>
													<ToggleButtonGroup
														value={timeframe}
														exclusive
														onChange={(_, value) => value && setTimeframe(value)}
														size="small"
													>
														<ToggleButton value="1h">1h</ToggleButton>
														<ToggleButton value="6h">6h</ToggleButton>
														<ToggleButton value="24h">24h</ToggleButton>
														<ToggleButton value="1week">1 week</ToggleButton>
													</ToggleButtonGroup>
												</Box>
												{history.length === 0 ? (
													<Typography color="text.secondary">
														No history yet. Data is recorded every minute.
													</Typography>
												) : (
													<Box sx={{ height: 240 }}>
														<Line
															data={chartData}
															options={{
																responsive: true,
																maintainAspectRatio: false,
																plugins: {
																	legend: { position: 'top' },
																},
																scales: {
																	y: {
																		title: { display: true, text: '°C' },
																	},
																},
															}}
														/>
													</Box>
												)}
											</CardContent>
										</Card>
									</motion.div>
								)}
							</Box>
						</CardContent>
					</Card>
				</motion.div>
			</Box>
		</motion.div>
	);
};

interface WasherEvent {
	timestamp: number;
	machineState: string | null;
	done: boolean | null;
	progressPercent: number | null;
	phase: string | null;
	remainingTimeMinutes: number | null;
}

interface WasherDetailProps extends DeviceDetailBaseProps<DashboardDeviceClusterWasher> {}

const WasherDetail = (props: WasherDetailProps): JSX.Element => {
	const cluster = props.cluster;
	const roomColor = props.device.roomColor || '#3b82f6';
	const isRunning = cluster.machineState === 'run' || cluster.operatingState === 'running';
	const isPaused = cluster.machineState === 'pause' || cluster.operatingState === 'paused';
	const isDone = cluster.done === true;

	const [washerHistory, setWasherHistory] = useState<WasherEvent[]>([]);
	const [washerHistoryLoading, setWasherHistoryLoading] = useState(true);
	const [washerHistoryError, setWasherHistoryError] = useState<string | null>(null);
	const [washerTimeframe, setWasherTimeframe] = useState<Timeframe>('24h');
	const washerDeviceId = props.device.uniqueId;

	const fetchWasherHistory = React.useCallback(async () => {
		try {
			setWasherHistoryLoading(true);
			setWasherHistoryError(null);
			const response = await apiGet('device', '/washer/:deviceId/:timeframe', {
				deviceId: washerDeviceId,
				timeframe: TIMEFRAME_MS[washerTimeframe].toString(),
			});
			if (!response.ok) {
				throw new Error('Failed to fetch washer history');
			}
			const data = await response.json();
			setWasherHistory(data.history || []);
		} catch (err) {
			setWasherHistoryError('Failed to load cycle history');
			console.error('Failed to fetch washer history:', err);
		} finally {
			setWasherHistoryLoading(false);
		}
	}, [washerDeviceId, washerTimeframe]);

	useEffect(() => {
		void fetchWasherHistory();
	}, [fetchWasherHistory]);

	const washerChartData = React.useMemo(() => {
		const reversed = [...washerHistory].reverse();
		const formatLabel = (ts: number): string => {
			const date = new Date(ts);
			if (washerTimeframe === '1h' || washerTimeframe === '6h') {
				return date.toLocaleTimeString('en-US', {
					hour: '2-digit',
					minute: '2-digit',
				});
			}
			if (washerTimeframe === '24h') {
				return date.toLocaleTimeString('en-US', {
					hour: '2-digit',
					minute: '2-digit',
				});
			}
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
			});
		};
		return {
			labels: reversed.map((e) => formatLabel(e.timestamp)),
			datasets: [
				{
					label: 'Progress (%)',
					data: reversed.map((e) => e.progressPercent ?? null),
					borderColor: 'rgb(59, 130, 246)',
					backgroundColor: 'rgba(59, 130, 246, 0.1)',
					tension: 0.4,
					fill: true,
				},
			],
		};
	}, [washerHistory, washerTimeframe]);

	const getStateLabel = (): string => {
		if (isDone) {
			return 'Done';
		}
		if (isPaused) {
			return 'Paused';
		}
		if (isRunning) {
			return 'Running';
		}
		return 'Stopped';
	};

	const formatRemaining = (): string => {
		if (cluster.remainingTimeStr) {
			return cluster.remainingTimeStr;
		}
		if (cluster.remainingTimeMinutes !== undefined && cluster.remainingTimeMinutes !== null) {
			const m = cluster.remainingTimeMinutes;
			if (m >= 60) {
				return `${Math.floor(m / 60)}h ${m % 60}m`;
			}
			return `${m} min`;
		}
		return '—';
	};

	const phaseLabel =
		cluster.phase && cluster.phase !== 'none'
			? cluster.phase.charAt(0).toUpperCase() + cluster.phase.slice(1)
			: null;

	return (
		<motion.div
			variants={pageVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			style={{ height: '100%' }}
		>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1.5,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#fff' }} />
				</IconButton>
				<Typography
					style={{ color: '#fff', fontWeight: 600, letterSpacing: '-0.02em' }}
					variant="h6"
				>
					{props.device.name}
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				<motion.div variants={cardVariants} initial="initial" animate="animate">
					<Card
						sx={{
							mb: 3,
							borderRadius: 3,
							boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
							overflow: 'hidden',
						}}
					>
						<CardContent>
							<Typography variant="subtitle2" color="text.secondary" gutterBottom>
								Washing machine
							</Typography>
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'center',
									my: 3,
									position: 'relative',
									height: 200,
								}}
							>
								{/* CSS/SVG Washing machine visualization */}
								<Box
									component="svg"
									viewBox="0 0 200 200"
									sx={{
										width: '100%',
										maxWidth: 200,
										height: 200,
										filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))',
									}}
								>
									<defs>
										<linearGradient
											id="washerBody"
											x1="0%"
											y1="0%"
											x2="0%"
											y2="100%"
										>
											<stop offset="0%" stopColor="#f3f4f6" />
											<stop offset="100%" stopColor="#e5e7eb" />
										</linearGradient>
										<linearGradient
											id="drumFill"
											x1="0%"
											y1="100%"
											x2="0%"
											y2="0%"
										>
											<stop offset="0%" stopColor="#93c5fd" />
											<stop offset="100%" stopColor="#bfdbfe" />
										</linearGradient>
									</defs>
									{/* Machine body */}
									<rect
										x="30"
										y="20"
										width="140"
										height="160"
										rx="12"
										fill="url(#washerBody)"
										stroke="#d1d5db"
										strokeWidth="2"
									/>
									{/* Door outline */}
									<circle
										cx="100"
										cy="100"
										r="45"
										fill="#f9fafb"
										stroke="#9ca3af"
										strokeWidth="3"
									/>
									{/* Drum - rotating when running */}
									<motion.g
										animate={{ rotate: isRunning ? 360 : 0 }}
										transition={{
											duration: 4,
											repeat: isRunning ? Number.POSITIVE_INFINITY : 0,
											ease: 'linear',
										}}
										style={{ transformOrigin: '100px 100px' }}
									>
										<circle
											cx="100"
											cy="100"
											r="38"
											fill="none"
											stroke="#c4b5fd"
											strokeWidth="4"
											strokeDasharray="4 6"
										/>
										<circle
											cx="100"
											cy="100"
											r="32"
											fill="url(#drumFill)"
											opacity={isRunning ? 0.7 : 0.4}
										/>
									</motion.g>
									{/* Center cap */}
									<circle
										cx="100"
										cy="100"
										r="12"
										fill="#e5e7eb"
										stroke="#9ca3af"
										strokeWidth="1"
									/>
								</Box>
							</Box>

							<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
								<Chip
									label={getStateLabel()}
									color={
										isDone
											? 'success'
											: isRunning
												? 'primary'
												: isPaused
													? 'warning'
													: 'default'
									}
									sx={{ alignSelf: 'flex-start' }}
								/>
								{phaseLabel && (
									<Typography variant="body1">
										Phase: <strong>{phaseLabel}</strong>
									</Typography>
								)}
								{cluster.cycle && (
									<Typography variant="body2" color="text.secondary">
										Cycle: {cluster.cycle}
									</Typography>
								)}
								{(isRunning || isPaused) && (
									<Box>
										<Typography variant="caption" color="text.secondary">
											Progress
										</Typography>
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 2,
												mt: 0.5,
											}}
										>
											<Box sx={{ flex: 1 }}>
												<Slider
													value={cluster.progressPercent ?? 0}
													min={0}
													max={100}
													valueLabelDisplay="auto"
													valueLabelFormat={(v) => `${v}%`}
													sx={{ color: roomColor }}
													disabled
												/>
											</Box>
											<Typography variant="body2" fontWeight={600}>
												{cluster.progressPercent ?? 0}%
											</Typography>
										</Box>
									</Box>
								)}
								{(isRunning || isPaused) && formatRemaining() !== '—' && (
									<Typography variant="body2">
										Time remaining: <strong>{formatRemaining()}</strong>
									</Typography>
								)}
								{cluster.completionTime && !isDone && (() => {
									const parsed = new Date(cluster.completionTime);
									const formatted = Number.isNaN(parsed.getTime())
										? cluster.completionTime
										: parsed.toLocaleString(undefined, {
												month: 'short',
												day: 'numeric',
												hour: '2-digit',
												minute: '2-digit',
											});
									return (
										<Typography variant="body2" color="text.secondary">
											Expected at {formatted}
										</Typography>
									);
								})()}
								{(cluster.detergentInitialCc !== undefined ||
									cluster.softenerInitialCc !== undefined) && (
									<Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
										{cluster.detergentInitialCc !== undefined && (
											<Chip
												size="small"
												variant="outlined"
												label={`Detergent: ${cluster.detergentRemainingCc ?? '—'} / ${cluster.detergentInitialCc} cc`}
											/>
										)}
										{cluster.softenerInitialCc !== undefined && (
											<Chip
												size="small"
												variant="outlined"
												label={`Softener: ${cluster.softenerRemainingCc ?? '—'} / ${cluster.softenerInitialCc} cc`}
											/>
										)}
									</Box>
								)}
								{cluster.scheduledPhases && cluster.scheduledPhases.length > 0 && (
									<Box>
										<Typography
											variant="caption"
											color="text.secondary"
											display="block"
											gutterBottom
										>
											Scheduled phases
										</Typography>
										<List dense disablePadding>
											{cluster.scheduledPhases.map((p, i) => (
												<ListItem key={i} disablePadding sx={{ py: 0.25 }}>
													<ListItemText
														primary={`${p.phaseName}: ${p.timeInMin} min`}
														primaryTypographyProps={{
															variant: 'body2',
														}}
													/>
												</ListItem>
											))}
										</List>
									</Box>
								)}

								{washerHistoryLoading && (
									<Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
										<CircularProgress size={32} />
									</Box>
								)}
								{washerHistoryError && (
									<Alert severity="error" sx={{ mt: 2 }}>
										{washerHistoryError}
									</Alert>
								)}
								{!washerHistoryLoading && !washerHistoryError && (
									<motion.div
										variants={cardVariants}
										initial="initial"
										animate="animate"
										transition={{ delay: 0.1 }}
									>
										<Card
											sx={{
												mt: 3,
												borderRadius: 3,
												boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
												background:
													'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 197, 253, 0.08) 100%)',
												border: '1px solid rgba(59, 130, 246, 0.2)',
											}}
										>
											<CardContent>
												<Box
													sx={{
														display: 'flex',
														justifyContent: 'space-between',
														alignItems: 'center',
														mb: 2,
													}}
												>
													<Typography variant="h6">Cycle history</Typography>
													<ToggleButtonGroup
														value={washerTimeframe}
														exclusive
														onChange={(_, value) =>
															value && setWasherTimeframe(value)
														}
														size="small"
													>
														<ToggleButton value="1h">1h</ToggleButton>
														<ToggleButton value="6h">6h</ToggleButton>
														<ToggleButton value="24h">24h</ToggleButton>
														<ToggleButton value="1week">1 week</ToggleButton>
													</ToggleButtonGroup>
												</Box>
												{washerHistory.length === 0 ? (
													<Typography color="text.secondary">
														No history yet. Data is recorded every minute.
													</Typography>
												) : (
													<Box sx={{ height: 240 }}>
														<Line
															data={washerChartData}
															options={{
																responsive: true,
																maintainAspectRatio: false,
																plugins: {
																	legend: { position: 'top' },
																},
																scales: {
																	y: {
																		min: 0,
																		max: 100,
																		title: { display: true, text: 'Progress %' },
																	},
																},
															}}
														/>
													</Box>
												)}
											</CardContent>
										</Card>
									</motion.div>
								)}
							</Box>
						</CardContent>
					</Card>
				</motion.div>
			</Box>
		</motion.div>
	);
};

export const DeviceDetail = (
	props: DeviceDetailBaseProps<DashboardDeviceClusterWithState>
): JSX.Element | null => {
	if (props.cluster.name === DeviceClusterName.OCCUPANCY_SENSING) {
		// Check if it's a sensor group or standalone occupancy sensor
		if ('mergedClusters' in props.cluster) {
			return <OccupancySensorGroupDetail {...props} cluster={props.cluster} />;
		}
		return <OccupancyDetail {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.AIR_QUALITY) {
		// Check if it's an air quality group
		if ('mergedClusters' in props.cluster) {
			return <AirQualityGroupDetail {...props} cluster={props.cluster} />;
		}
		// Standalone air quality sensor not yet supported
		return null;
	}
	if (props.cluster.name === DeviceClusterName.BOOLEAN_STATE) {
		return <BooleanStateDetail {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.TEMPERATURE_MEASUREMENT) {
		return <TemperatureDetail {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT) {
		return <HumidityDetail {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.ILLUMINANCE_MEASUREMENT) {
		return <IlluminanceDetail {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.WINDOW_COVERING) {
		return <WindowCoveringDetail {...props} cluster={props.cluster} />;
	}
	if (
		props.cluster.name === DeviceClusterName.COLOR_CONTROL &&
		props.cluster.clusterVariant === 'xy'
	) {
		return <ColorControlDetail {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.ACTIONS) {
		return <ActionsDetail {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.THERMOSTAT) {
		return <ThermostatDetail {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.SWITCH) {
		return <SwitchDetail {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.ON_OFF) {
		return <OnOffDetail {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.FRIDGE) {
		return <FridgeDetail {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.WASHER) {
		return <WasherDetail {...props} cluster={props.cluster} />;
	}
	return null;
};
