import type {
	DashboardDeviceClusterOccupancySensing,
	DashboardDeviceClusterWithState,
	DashboardDeviceClusterTemperatureMeasurement,
	DashboardDeviceClusterRelativeHumidityMeasurement,
	DashboardDeviceClusterIlluminanceMeasurement,
	DashboardDeviceClusterWindowCovering,
	DashboardDeviceClusterColorControl,
	DashboardDeviceClusterActions,
	DashboardDeviceClusterSensorGroup,
	DashboardDeviceClusterThermostat,
	DeviceListWithValuesResponse,
	DashboardDeviceClusterSwitch,
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
import { ThermostatCircularSlider } from './ThermostatCircularSlider';
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

type Timeframe = 'hour' | 'day' | 'week' | 'month';

const TIMEFRAME_MS: Record<Timeframe, number> = {
	hour: 60 * 60 * 1000,
	day: 24 * 60 * 60 * 1000,
	week: 7 * 24 * 60 * 60 * 1000,
	month: 30 * 24 * 60 * 60 * 1000,
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
	const [timeframe, setTimeframe] = useState<Timeframe>('day');
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

	const chartData = {
		labels: history
			.slice()
			.reverse()
			.map((e) => {
				const date = new Date(e.timestamp);
				if (timeframe === 'hour') {
					return date.toLocaleTimeString('en-US', {
						hour: '2-digit',
						minute: '2-digit',
					});
				}
				if (timeframe === 'day') {
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
	const [timeframe, setTimeframe] = useState<Timeframe>('day');
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

	const chartData = {
		labels: history
			.slice()
			.reverse()
			.map((e) => {
				const date = new Date(e.timestamp);
				if (timeframe === 'hour') {
					return date.toLocaleTimeString('en-US', {
						hour: '2-digit',
						minute: '2-digit',
					});
				}
				if (timeframe === 'day') {
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
	const [timeframe, setTimeframe] = useState<Timeframe>('day');
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

	const chartData = {
		labels: history
			.slice()
			.reverse()
			.map((e) => {
				const date = new Date(e.timestamp);
				if (timeframe === 'hour') {
					return date.toLocaleTimeString('en-US', {
						hour: '2-digit',
						minute: '2-digit',
					});
				}
				if (timeframe === 'day') {
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

interface SensorGroupDetailProps extends DeviceDetailBaseProps<DashboardDeviceClusterSensorGroup> {}

const SensorGroupDetail = (props: SensorGroupDetailProps): JSX.Element => {
	const [timeframe, setTimeframe] = useState<Timeframe>('day');
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
						if (timeframe === 'hour' || timeframe === 'day') {
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
						if (timeframe === 'hour' || timeframe === 'day') {
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
						if (timeframe === 'hour' || timeframe === 'day') {
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
								<ToggleButton value="hour">Hour</ToggleButton>
								<ToggleButton value="day">Day</ToggleButton>
								<ToggleButton value="week">Week</ToggleButton>
								<ToggleButton value="month">Month</ToggleButton>
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
									Temperature History
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
	const [userHasInteracted, setUserHasInteracted] = useState(false);
	const roomColor = props.device.roomColor || '#555';

	// Circular slider state
	const [isDragging, setIsDragging] = useState(false);
	const circleRef = useRef<HTMLDivElement>(null);

	// Animate temperature from min to target on mount
	const animatedTemp = 0;
	// useAnimatedValue(
	// 	props.cluster.targetTemperature,
	// 	props.cluster.minTemperature,
	// 	500,
	// 	0
	// );

	// Use animated value initially, then switch to user-controlled value after interaction
	const displayTemp = userHasInteracted ? targetTemperature : animatedTemp;

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

	const handleTemperatureChange = (newTemp: number) => {
		setUserHasInteracted(true);
		const clampedTemp = Math.max(
			props.cluster.minTemperature,
			Math.min(props.cluster.maxTemperature, newTemp)
		);
		setTargetTemperature(clampedTemp);
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

	const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		setUserHasInteracted(true);
		setIsDragging(true);
		e.currentTarget.setPointerCapture(e.pointerId);
		handlePointerMove(e);
	};

	const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!circleRef.current) {
			return;
		}

		const rect = circleRef.current.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		const deltaX = e.clientX - centerX;
		const deltaY = e.clientY - centerY;

		// Calculate angle (-180 to 180)
		let angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;

		// Convert to 0-360 range, starting from top (270° = 0%)
		angle = (angle + 360) % 360;

		// Map angle to temperature (start from bottom, go clockwise 270°)
		// We use 270° of the circle (from -135° to +135° relative to top)
		const startAngle = 135; // Start position (bottom-left)
		const endAngle = 45; // End position (bottom-right)

		let normalizedAngle: number;
		if (angle >= startAngle || angle <= endAngle) {
			if (angle >= startAngle) {
				normalizedAngle = angle - startAngle;
			} else {
				normalizedAngle = 360 - startAngle + angle;
			}
		} else {
			// Click is in the dead zone
			return;
		}

		const totalRange = 270; // 270 degrees of arc
		const percentage = normalizedAngle / totalRange;

		// Map to temperature range
		const { minTemperature, maxTemperature } = props.cluster;
		const tempRange = maxTemperature - minTemperature;
		const newTemp = minTemperature + percentage * tempRange;

		handleTemperatureChange(Math.round(newTemp * 2) / 2); // Round to 0.5°C
	};

	const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
		if (isDragging) {
			e.currentTarget.releasePointerCapture(e.pointerId);
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
							<Typography variant="h6" gutterBottom>
								{props.device.name}
							</Typography>

							{/* Circular Slider */}
							<ThermostatCircularSlider
								displayTemp={displayTemp}
								currentTemp={props.cluster.currentTemperature}
								minTemp={props.cluster.minTemperature}
								maxTemp={props.cluster.maxTemperature}
								accentColor={accentColor}
								isHeating={props.cluster.isHeating}
								isDragging={isDragging}
								circleRef={circleRef}
								onPointerDown={handlePointerDown}
								onPointerMove={handlePointerMove}
								onPointerUp={handlePointerUp}
							/>

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

interface ColorControlDetailProps
	extends DeviceDetailBaseProps<DashboardDeviceClusterColorControl> {}

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
					...(hasLevelControl ? {} : { value: 100 }),
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
	const displayBrightness = hasLevelControl ? brightness : value;
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

export const DeviceDetail = (
	props: DeviceDetailBaseProps<DashboardDeviceClusterWithState>
): JSX.Element | null => {
	if (props.cluster.name === DeviceClusterName.OCCUPANCY_SENSING) {
		// Check if it's a sensor group or standalone occupancy sensor
		if ('mergedClusters' in props.cluster) {
			return <SensorGroupDetail {...props} cluster={props.cluster} />;
		}
		return <OccupancyDetail {...props} cluster={props.cluster} />;
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
	if (props.cluster.name === DeviceClusterName.COLOR_CONTROL) {
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
	return null;
};
