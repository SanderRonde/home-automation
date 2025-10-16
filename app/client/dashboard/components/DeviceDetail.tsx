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
	DeviceListWithValuesResponse,
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
} from '@mui/material';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import React, { useState, useEffect, useRef } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { apiGet, apiPost } from '../../lib/fetch';
import { Wheel } from '@uiw/react-color';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - react-chartjs-2 is an ESM module, Bun handles it at runtime
import { Line } from 'react-chartjs-2';

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
	useEffect(() => {
		void fetchHistory();
	}, [deviceId]);

	const fetchHistory = async () => {
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
	};

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
		<Box>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography style={{ color: '#2f2f2f', fontWeight: 'bold' }} variant="h6">
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
						<Card sx={{ mb: 3 }}>
							<CardContent>
								<Typography variant="h6" gutterBottom>
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
									<Typography variant="body1" color="text.secondary">
										Current State:
									</Typography>
									<Chip
										label={currentState?.occupied ? 'Occupied' : 'Clear'}
										color={currentState?.occupied ? 'success' : 'default'}
										sx={{
											fontWeight: 'bold',
										}}
									/>
								</Box>
								{currentState && 'timestamp' in currentState && (
									<Typography
										variant="body2"
										color="text.secondary"
										sx={{ mt: 1 }}
									>
										Last updated: {formatTimestamp(currentState.timestamp)}
									</Typography>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardContent>
								<Typography variant="h6" gutterBottom>
									History
								</Typography>
								{history.length === 0 ? (
									<Typography color="text.secondary">
										No history available
									</Typography>
								) : (
									<List>
										{history.map((event, index) => (
											<ListItem
												key={index}
												sx={{
													borderLeft: 4,
													borderColor: event.occupied
														? 'success.main'
														: 'grey.500',
													mb: 1,
													bgcolor: 'background.paper',
													borderRadius: 1,
												}}
											>
												<ListItemText
													primary={event.occupied ? 'Occupied' : 'Clear'}
													secondary={formatTimestamp(event.timestamp)}
													primaryTypographyProps={{
														fontWeight: 'bold',
														color: event.occupied
															? 'success.main'
															: 'text.secondary',
													}}
												/>
											</ListItem>
										))}
									</List>
								)}
							</CardContent>
						</Card>
					</>
				)}
			</Box>
		</Box>
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

	useEffect(() => {
		void fetchHistory();
	}, [deviceId, timeframe]);

	const fetchHistory = async () => {
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
	};

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
		<Box>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography style={{ color: '#2f2f2f', fontWeight: 'bold' }} variant="h6">
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
						<Card sx={{ mb: 3 }}>
							<CardContent>
								<Typography variant="h6" gutterBottom>
									{props.device.name}
								</Typography>
								<Typography
									variant="h3"
									sx={{ color: '#3b82f6', fontWeight: 'bold' }}
								>
									{props.cluster.temperature.toFixed(1)}°C
								</Typography>
							</CardContent>
						</Card>

						<Card sx={{ mb: 3 }}>
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
					</>
				)}
			</Box>
		</Box>
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

	useEffect(() => {
		void fetchHistory();
	}, [deviceId, timeframe]);

	const fetchHistory = async () => {
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
	};

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
		<Box>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography style={{ color: '#2f2f2f', fontWeight: 'bold' }} variant="h6">
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
						<Card sx={{ mb: 3 }}>
							<CardContent>
								<Typography variant="h6" gutterBottom>
									{props.device.name}
								</Typography>
								<Typography
									variant="h3"
									sx={{ color: '#10b981', fontWeight: 'bold' }}
								>
									{(props.cluster.humidity * 100).toFixed(0)}%
								</Typography>
							</CardContent>
						</Card>

						<Card sx={{ mb: 3 }}>
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
					</>
				)}
			</Box>
		</Box>
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

	useEffect(() => {
		void fetchHistory();
	}, [deviceId, timeframe]);

	const fetchHistory = async () => {
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
	};

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
		<Box>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography style={{ color: '#2f2f2f', fontWeight: 'bold' }} variant="h6">
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
						<Card sx={{ mb: 3 }}>
							<CardContent>
								<Typography variant="h6" gutterBottom>
									{props.device.name}
								</Typography>
								<Typography
									variant="h3"
									sx={{ color: '#fbbf24', fontWeight: 'bold' }}
								>
									{props.cluster.illuminance.toFixed(0)} lux
								</Typography>
							</CardContent>
						</Card>

						<Card sx={{ mb: 3 }}>
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
					</>
				)}
			</Box>
		</Box>
	);
};

interface SensorGroupDetailProps extends DeviceDetailBaseProps<DashboardDeviceClusterSensorGroup> {}

const SensorGroupDetail = (props: SensorGroupDetailProps): JSX.Element => {
	const [timeframe, setTimeframe] = useState<Timeframe>('day');
	const [loading, setLoading] = useState(false);
	const roomColor = props.device.roomColor || '#555';

	const occupancy = props.cluster.mergedClusters[DeviceClusterName.OCCUPANCY_SENSING];
	const temperature = props.cluster.mergedClusters[DeviceClusterName.TEMPERATURE_MEASUREMENT];
	const illuminance = props.cluster.mergedClusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT];

	const [tempHistory, setTempHistory] = useState<TemperatureEvent[]>([]);
	const [illumHistory, setIllumHistory] = useState<IlluminanceEvent[]>([]);
	const [occHistory, setOccHistory] = useState<OccupancyEvent[]>([]);

	const deviceId = props.device.uniqueId;

	useEffect(() => {
		void fetchHistory();
	}, [deviceId, timeframe, !!temperature, !!illuminance, !!occupancy]);

	const fetchHistory = async () => {
		try {
			setLoading(true);

			// Fetch temperature history if available
			if (temperature) {
				const response = await apiGet('device', '/temperature/:deviceId/:timeframe', {
					deviceId: deviceId,
					timeframe: TIMEFRAME_MS[timeframe].toString(),
				});
				if (response.ok) {
					const data = await response.json();
					setTempHistory(data.history || []);
				}
			}

			// Fetch illuminance history if available
			if (illuminance) {
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
			if (occupancy) {
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
	};

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
		<Box>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography style={{ color: '#2f2f2f', fontWeight: 'bold' }} variant="h6">
					Sensor Group
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				<Card sx={{ mb: 3 }}>
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

				{/* Timeframe selector for charts */}
				{(temperature || illuminance) && (
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
				)}

				{loading && (
					<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
						<CircularProgress />
					</Box>
				)}

				{/* Temperature chart */}
				{!loading && temperature && tempChartData && (
					<Card sx={{ mb: 3 }}>
						<CardContent>
							<Typography variant="h6" gutterBottom>
								Temperature History
							</Typography>
							{tempHistory.length === 0 ? (
								<Typography color="text.secondary">No history available</Typography>
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
				)}

				{/* Illuminance chart */}
				{!loading && illuminance && illumChartData && (
					<Card sx={{ mb: 3 }}>
						<CardContent>
							<Typography variant="h6" gutterBottom>
								Illuminance History
							</Typography>
							{illumHistory.length === 0 ? (
								<Typography color="text.secondary">No history available</Typography>
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
				)}

				{/* Occupancy history */}
				{!loading && occupancy && (
					<Card>
						<CardContent>
							<Typography variant="h6" gutterBottom>
								Occupancy History
							</Typography>
							{occHistory.length === 0 ? (
								<Typography color="text.secondary">No history available</Typography>
							) : (
								<List>
									{occHistory.map((event, index) => (
										<ListItem
											key={index}
											sx={{
												borderLeft: 4,
												borderColor: event.occupied
													? 'success.main'
													: 'grey.500',
												mb: 1,
												bgcolor: 'background.paper',
												borderRadius: 1,
											}}
										>
											<ListItemText
												primary={event.occupied ? 'Occupied' : 'Clear'}
												secondary={formatTimestamp(event.timestamp)}
												primaryTypographyProps={{
													fontWeight: 'bold',
													color: event.occupied
														? 'success.main'
														: 'text.secondary',
												}}
											/>
										</ListItem>
									))}
								</List>
							)}
						</CardContent>
					</Card>
				)}
			</Box>
		</Box>
	);
};

interface WindowCoveringDetailProps
	extends DeviceDetailBaseProps<DashboardDeviceClusterWindowCovering> {}

const WindowCoveringDetail = (props: WindowCoveringDetailProps): JSX.Element => {
	const [targetPosition, setTargetPosition] = useState(
		props.cluster.targetPositionLiftPercentage
	);
	const [isUpdating, setIsUpdating] = useState(false);
	const roomColor = props.device.roomColor || '#555';

	const handlePositionChange = (newPosition: number) => {
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
		<Box>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography style={{ color: '#2f2f2f', fontWeight: 'bold' }} variant="h6">
					Window Covering
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				<Card sx={{ mb: 3 }}>
					<CardContent>
						<Typography variant="h6" gutterBottom>
							{props.device.name}
						</Typography>

						{/* Animated blind visualization */}
						<Box
							sx={{
								position: 'relative',
								width: '100%',
								height: 300,
								border: '3px solid #4b5563',
								borderRadius: 2,
								overflow: 'hidden',
								backgroundColor: '#e5e7eb',
								my: 3,
							}}
						>
							{/* Window frame */}
							<Box
								sx={{
									position: 'absolute',
									top: 0,
									left: 0,
									right: 0,
									bottom: 0,
									background:
										'linear-gradient(180deg, #87ceeb 0%, #87ceeb 70%, #90ee90 70%, #90ee90 100%)',
								}}
							/>
							{/* Blind */}
							<Box
								sx={{
									position: 'absolute',
									top: 0,
									left: 0,
									right: 0,
									height: `${targetPosition}%`,
									background:
										'repeating-linear-gradient(0deg, #9ca3af 0px, #9ca3af 10px, #6b7280 10px, #6b7280 11px)',
									boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
									transition: 'height 0.5s ease-in-out',
								}}
							/>
							{/* Position indicator */}
							<Box
								sx={{
									position: 'absolute',
									top: `${Math.max(8, Math.min(92, targetPosition))}%`,
									left: '50%',
									transform: 'translate(-50%, -50%)',
									backgroundColor: 'rgba(0, 0, 0, 0.7)',
									color: 'white',
									padding: '4px 12px',
									borderRadius: 1,
									fontWeight: 'bold',
									fontSize: '1.2rem',
								}}
							>
								{targetPosition}%
							</Box>
						</Box>

						{/* Slider control */}
						<Box sx={{ px: 2 }}>
							<Typography gutterBottom>
								Position (0% = Open, 100% = Closed)
							</Typography>
							<Slider
								value={targetPosition}
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
					</CardContent>
				</Card>
			</Box>
		</Box>
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
		<Box>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography style={{ color: '#2f2f2f', fontWeight: 'bold' }} variant="h6">
					Actions
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				<Card sx={{ mb: 3 }}>
					<CardContent>
						<Typography variant="h6" gutterBottom>
							{props.device.name}
						</Typography>
						<Typography variant="body2" color="text.secondary">
							Select an action to execute
						</Typography>
					</CardContent>
				</Card>

				<Card>
					<CardContent>
						<Typography variant="h6" gutterBottom>
							Available Actions
						</Typography>
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
									<Box
										key={action.id}
										onClick={() =>
											!isExecuting && void handleExecuteAction(action.id)
										}
										sx={{
											p: 2,
											borderRadius: 2,
											border: '2px solid',
											borderColor: isActive ? 'primary.main' : 'divider',
											backgroundColor: isActive
												? 'rgba(25, 118, 210, 0.08)'
												: 'background.paper',
											cursor: isExecuting ? 'wait' : 'pointer',
											transition: 'all 0.2s',
											'&:hover': {
												backgroundColor: isActive
													? 'rgba(25, 118, 210, 0.12)'
													: 'rgba(0, 0, 0, 0.04)',
												borderColor: 'primary.main',
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
													fontWeight: isActive ? 600 : 400,
												}}
											>
												{action.name}
											</Typography>
											{isActive && (
												<Chip label="Active" color="primary" size="small" />
											)}
											{isExecuting && <CircularProgress size={20} />}
										</Box>
									</Box>
								);
							})}
						</Box>
					</CardContent>
				</Card>
			</Box>
		</Box>
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

	// Define color presets
	const colorPresets = [
		{ name: 'Warm White', hue: 30, saturation: 20 },
		{ name: 'Cool White', hue: 200, saturation: 10 },
		{ name: 'Red', hue: 0, saturation: 100 },
		{ name: 'Orange', hue: 30, saturation: 100 },
		{ name: 'Yellow', hue: 60, saturation: 100 },
		{ name: 'Green', hue: 120, saturation: 100 },
		{ name: 'Cyan', hue: 180, saturation: 100 },
		{ name: 'Blue', hue: 240, saturation: 100 },
		{ name: 'Purple', hue: 270, saturation: 100 },
		{ name: 'Pink', hue: 330, saturation: 100 },
	];

	return (
		<Box>
			<Box
				sx={{
					backgroundColor: roomColor,
					py: 1,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: '#2f2f2f' }} />
				</IconButton>
				<Typography
					variant="h6"
					sx={{
						color: '#2f2f2f',
						fontWeight: 500,
						letterSpacing: '-0.01em',
					}}
				>
					Color Control
				</Typography>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				{props.device.managementUrl && (
					<Alert severity="info" sx={{ mb: 3 }}>
						Manage this device at{' '}
						<Link
							href={props.device.managementUrl}
							target="_blank"
							rel="noopener noreferrer"
						>
							{props.device.managementUrl}
						</Link>
					</Alert>
				)}

				<Card sx={{ mb: 3 }}>
					<CardContent>
						<Box
							sx={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								mb: 3,
							}}
						>
							<Typography
								variant="h5"
								sx={{
									fontWeight: 500,
									letterSpacing: '-0.01em',
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
											onChange={(e) => void handleToggle(e.target.checked)}
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
						<Box
							sx={{
								display: 'flex',
								justifyContent: 'center',
								my: 3,
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
								width={300}
								height={300}
							/>
						</Box>

						{/* Brightness slider */}
						<Box sx={{ px: 2, mb: 3 }}>
							<Typography
								gutterBottom
								sx={{
									fontSize: '0.875rem',
									fontWeight: 500,
									opacity: 0.7,
									mb: 1.5,
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
										height: 6,
									},
									'& .MuiSlider-rail': {
										backgroundColor: '#e0e0e0',
										opacity: 1,
										height: 6,
									},
									'& .MuiSlider-thumb': {
										width: 20,
										height: 20,
										backgroundColor: '#fff',
										border: '2px solid currentColor',
										boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
										'&:hover, &.Mui-focusVisible': {
											boxShadow: '0 0 0 8px rgba(0,0,0,0.06)',
										},
									},
									'& .MuiSlider-valueLabel': {
										backgroundColor: 'rgba(0,0,0,0.8)',
										borderRadius: '4px',
										fontSize: '0.875rem',
									},
								}}
							/>
						</Box>

						{/* Color presets */}
						<Box sx={{ mb: 3 }}>
							<Box
								sx={{
									display: 'flex',
									gap: 1.5,
									flexWrap: 'wrap',
									justifyContent: 'center',
								}}
							>
								{colorPresets.map((preset) => {
									const presetColor = hsvToHex(
										preset.hue,
										preset.saturation,
										100
									);
									return (
										<Box
											key={preset.name}
											onClick={() =>
												void handlePresetColor(
													preset.hue,
													preset.saturation
												)
											}
											sx={{
												width: 48,
												height: 48,
												borderRadius: '50%',
												backgroundColor: presetColor,
												cursor: isUpdating ? 'default' : 'pointer',
												opacity: isUpdating ? 0.5 : 1,
												transition: 'all 0.2s ease',
												boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
												'&:hover': {
													transform: isUpdating ? 'none' : 'scale(1.1)',
													boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
												},
												'&:active': {
													transform: isUpdating ? 'none' : 'scale(0.95)',
												},
											}}
										/>
									);
								})}
							</Box>
						</Box>

						{/* Preview */}
						<Card
							sx={{
								backgroundColor: currentColor,
								height: 80,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								borderRadius: 2,
								boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
							}}
						>
							<Typography
								sx={{
									color: 'white',
									fontSize: '0.875rem',
									fontWeight: 500,
									letterSpacing: '0.05em',
									textShadow: '0 1px 3px rgba(0,0,0,0.5)',
									opacity: 0.9,
								}}
							>
								{currentColor.toUpperCase()}
							</Typography>
						</Card>
					</CardContent>
				</Card>

				{/* Actions Section */}
				{actionsCluster && actionsCluster.actions.length > 0 && (
					<Card sx={{ mt: 3 }}>
						<CardContent>
							<Typography variant="h6" gutterBottom>
								Actions
							</Typography>
							<Box
								sx={{
									display: 'flex',
									flexDirection: 'column',
									gap: 2,
									mt: 2,
								}}
							>
								{actionsCluster.actions.map((action) => {
									const isActive = action.id === actionsCluster.activeActionId;
									const isExecuting = action.id === executingActionId;

									return (
										<Box
											key={action.id}
											onClick={() =>
												!isExecuting && void handleExecuteAction(action.id)
											}
											sx={{
												p: 2,
												borderRadius: 2,
												border: '2px solid',
												borderColor: isActive ? 'primary.main' : 'divider',
												backgroundColor: isActive
													? 'rgba(25, 118, 210, 0.08)'
													: 'background.paper',
												cursor: isExecuting ? 'wait' : 'pointer',
												transition: 'all 0.2s',
												'&:hover': {
													backgroundColor: isActive
														? 'rgba(25, 118, 210, 0.12)'
														: 'rgba(0, 0, 0, 0.04)',
													borderColor: 'primary.main',
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
														fontWeight: isActive ? 600 : 400,
													}}
												>
													{action.name}
												</Typography>
												{isActive && (
													<Chip
														label="Active"
														color="primary"
														size="small"
													/>
												)}
												{isExecuting && <CircularProgress size={20} />}
											</Box>
										</Box>
									);
								})}
							</Box>
						</CardContent>
					</Card>
				)}
			</Box>
		</Box>
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
	return null;
};
