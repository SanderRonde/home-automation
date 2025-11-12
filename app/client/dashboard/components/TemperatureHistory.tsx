import {
	Box,
	Card,
	CardContent,
	Typography,
	CircularProgress,
	ToggleButtonGroup,
	ToggleButton,
	Grid,
	Chip,
} from '@mui/material';
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
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - react-chartjs-2 is an ESM module, Bun handles it at runtime
import { Line } from 'react-chartjs-2';
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../../lib/fetch';
import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type { DashboardDeviceClusterTemperatureMeasurement } from '../../../server/modules/device/routing';

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

type Timeframe = '1h' | '6h' | '24h' | '1w';

const TIMEFRAME_MS: Record<Timeframe, number> = {
	'1h': 60 * 60 * 1000,
	'6h': 6 * 60 * 60 * 1000,
	'24h': 24 * 60 * 60 * 1000,
	'1w': 7 * 24 * 60 * 60 * 1000,
};

interface TemperatureEvent {
	temperature: number;
	timestamp: number;
}

interface SensorData {
	device: DeviceListWithValuesResponse[number];
	cluster: DashboardDeviceClusterTemperatureMeasurement;
	history: TemperatureEvent[];
	loading: boolean;
	error: string | null;
}

export const TemperatureHistory = (): JSX.Element => {
	const [devices, setDevices] = useState<DeviceListWithValuesResponse>([]);
	const [sensors, setSensors] = useState<SensorData[]>([]);
	const [loading, setLoading] = useState(true);
	const [timeframe, setTimeframe] = useState<Timeframe>('1h');

	// Load all devices
	const loadDevices = useCallback(async () => {
		try {
			const response = await apiGet('device', '/listWithValues', {});
			if (response.ok) {
				const data = await response.json();
				setDevices(data.devices || []);
			}
		} catch (error) {
			console.error('Failed to load devices:', error);
		}
	}, []);

	// Extract temperature sensors from devices
	useEffect(() => {
		const temperatureSensors: SensorData[] = [];
		for (const device of devices) {
			for (const endpoint of device.endpoints) {
				for (const cluster of endpoint.clusters) {
					if (cluster.name === DeviceClusterName.TEMPERATURE_MEASUREMENT) {
						temperatureSensors.push({
							device,
							cluster: cluster as DashboardDeviceClusterTemperatureMeasurement,
							history: [],
							loading: false,
							error: null,
						});
					}
				}
			}
		}
		setSensors(temperatureSensors);
		setLoading(false);
	}, [devices]);

	// Load history for all sensors
	useEffect(() => {
		if (sensors.length === 0) {
			return;
		}

		const sensorIds = sensors.map((s) => s.device.uniqueId);
		const loadHistory = async () => {
			for (const sensorId of sensorIds) {
				try {
					setSensors((prev) =>
						prev.map((s) =>
							s.device.uniqueId === sensorId ? { ...s, loading: true, error: null } : s
						)
					);

					const response = await apiGet('device', '/temperature/:deviceId/:timeframe', {
						deviceId: sensorId,
						timeframe: TIMEFRAME_MS[timeframe].toString(),
					});

					if (!response.ok) {
						throw new Error('Failed to fetch temperature history');
					}

					const data = await response.json();
					setSensors((prev) =>
						prev.map((s) =>
							s.device.uniqueId === sensorId
								? { ...s, history: data.history || [], loading: false }
								: s
						)
					);
				} catch (err) {
					setSensors((prev) =>
						prev.map((s) =>
							s.device.uniqueId === sensorId
								? { ...s, loading: false, error: 'Failed to load history' }
								: s
						)
					);
					const sensor = sensors.find((s) => s.device.uniqueId === sensorId);
					console.error(`Failed to fetch temperature history for ${sensor?.device.name || sensorId}:`, err);
				}
			}
		};

		void loadHistory();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sensors.length, timeframe]);

	useEffect(() => {
		void loadDevices();
	}, [loadDevices]);

	const formatTimestamp = (timestamp: number): string => {
		const date = new Date(timestamp);
		if (timeframe === '1h' || timeframe === '6h' || timeframe === '24h') {
			return date.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
			});
		}
		// 1 week
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
		});
	};

	const getChartData = (history: TemperatureEvent[]) => {
		const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);
		return {
			labels: sortedHistory.map((e) => formatTimestamp(e.timestamp)),
			datasets: [
				{
					label: 'Temperature (°C)',
					data: sortedHistory.map((e) => e.temperature),
					borderColor: 'rgb(59, 130, 246)',
					backgroundColor: 'rgba(59, 130, 246, 0.1)',
					tension: 0.4,
					fill: true,
				},
			],
		};
	};

	const calculateTrend = (history: TemperatureEvent[]): { direction: 'up' | 'down' | 'stable'; value: number } => {
		if (history.length < 2) {
			return { direction: 'stable', value: 0 };
		}
		const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
		const first = sorted[0].temperature;
		const last = sorted[sorted.length - 1].temperature;
		const diff = last - first;
		const absDiff = Math.abs(diff);
		
		if (absDiff < 0.1) {
			return { direction: 'stable', value: diff };
		}
		return { direction: diff > 0 ? 'up' : 'down', value: diff };
	};

	if (loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
				{/* Header */}
				<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
					<Typography variant="h5">Temperature History</Typography>
					<ToggleButtonGroup
						value={timeframe}
						exclusive
						onChange={(_, value) => value && setTimeframe(value)}
						size="small"
					>
						<ToggleButton value="1h">1h</ToggleButton>
						<ToggleButton value="6h">6h</ToggleButton>
						<ToggleButton value="24h">24h</ToggleButton>
						<ToggleButton value="1w">1 week</ToggleButton>
					</ToggleButtonGroup>
				</Box>

				{/* Sensors List */}
				{sensors.length === 0 ? (
					<Card>
						<CardContent>
							<Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
								No temperature sensors found
							</Typography>
						</CardContent>
					</Card>
				) : (
					<Grid container spacing={3}>
						{sensors.map((sensor) => {
							const trend = calculateTrend(sensor.history);
							const chartData = getChartData(sensor.history);
							const roomColor = sensor.device.roomColor || '#555';

							return (
								<Grid item xs={12} md={6} lg={4} key={sensor.device.uniqueId}>
									<Card
										sx={{
											height: '100%',
											display: 'flex',
											flexDirection: 'column',
											borderRadius: 3,
											boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
										}}
									>
										<CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
											{/* Sensor Header */}
											<Box sx={{ mb: 2 }}>
												<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
													<Typography variant="h6" sx={{ fontWeight: 600 }}>
														{sensor.device.name}
													</Typography>
													{sensor.device.room && (
														<Chip
															label={sensor.device.room}
															size="small"
															sx={{
																backgroundColor: roomColor,
																color: '#2f2f2f',
																fontWeight: 600,
															}}
														/>
													)}
												</Box>
												<Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
													<Typography variant="h4" sx={{ fontWeight: 700, color: '#3b82f6' }}>
														{sensor.cluster.temperature.toFixed(1)}°C
													</Typography>
													{trend.direction !== 'stable' && (
														<Chip
															label={`${trend.direction === 'up' ? '↑' : '↓'} ${Math.abs(trend.value).toFixed(1)}°`}
															size="small"
															color={trend.direction === 'up' ? 'error' : 'primary'}
															sx={{ fontSize: '0.75rem' }}
														/>
													)}
												</Box>
											</Box>

											{/* Chart */}
											<Box sx={{ flexGrow: 1, minHeight: 200 }}>
												{sensor.loading ? (
													<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
														<CircularProgress size={40} />
													</Box>
												) : sensor.error ? (
													<Typography variant="body2" color="error" align="center">
														{sensor.error}
													</Typography>
												) : sensor.history.length === 0 ? (
													<Typography variant="body2" color="text.secondary" align="center">
														No history available
													</Typography>
												) : (
													<Line
														data={chartData}
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
																y: {
																	beginAtZero: false,
																	grid: {
																		color: 'rgba(255, 255, 255, 0.1)',
																	},
																},
																x: {
																	grid: {
																		display: false,
																	},
																},
															},
														}}
													/>
												)}
											</Box>
										</CardContent>
									</Card>
								</Grid>
							);
						})}
					</Grid>
				)}
			</Box>
		</Box>
	);
};
