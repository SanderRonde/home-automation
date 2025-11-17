import {
	TrendingUp as TrendingUpIcon,
	TrendingDown as TrendingDownIcon,
	Remove as RemoveIcon,
	DeviceThermostat as DeviceThermostatIcon,
} from '@mui/icons-material';
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
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { staggerContainer, staggerItem } from '../../lib/animations';
import React, { useState, useEffect } from 'react';
import { apiGet } from '../../lib/fetch';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - react-chartjs-2 is an ESM module, Bun handles it at runtime
import { Line } from 'react-chartjs-2';
import { motion } from 'framer-motion';

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

interface DeviceSensor {
	deviceId: string;
	name: string;
}

interface TemperatureSensor {
	id: string;
	name: string;
	type: 'controller' | 'device';
	currentTemp: number | null;
	history: TemperatureEvent[];
}

export const TemperatureHistory = (): JSX.Element => {
	const [loading, setLoading] = useState(true);
	const [timeframe, setTimeframe] = useState<Timeframe>('24h');
	const [sensors, setSensors] = useState<TemperatureSensor[]>([]);

	const loadTemperatureData = React.useCallback(async () => {
		try {
			setLoading(true);

			// Fetch available sensors
			const sensorsResponse = await apiGet('temperature', '/temperature-sensors', {});
			if (!sensorsResponse.ok) {
				throw new Error('Failed to fetch sensors');
			}

			const sensorsData = await sensorsResponse.json();
			const allSensors: TemperatureSensor[] = [];

			// Fetch all devices to get current temperature values
			const devicesResponse = await apiGet('device', '/listWithValues', {});
			const devicesData = devicesResponse.ok ? await devicesResponse.json() : { devices: [] };

			// Process temperature controllers
			if (sensorsData.temperatureControllers) {
				for (const controllerId of sensorsData.temperatureControllers) {
					// Fetch history for this controller
					const historyResponse = await apiGet(
						'temperature',
						'/temperature/:deviceId/:timeframe',
						{
							deviceId: controllerId,
							timeframe: TIMEFRAME_MS[timeframe].toString(),
						}
					);

					const historyData = historyResponse.ok
						? await historyResponse.json()
						: { history: [] };

					// Get current temperature from history or null
					const currentTemp =
						historyData.history && historyData.history.length > 0
							? historyData.history[0].temperature
							: null;

					allSensors.push({
						id: controllerId,
						name: controllerId,
						type: 'controller',
						currentTemp,
						history: (historyData.history || []) as {
							temperature: number;
							timestamp: number;
						}[],
					});
				}
			}

			// Process device sensors
			if (sensorsData.deviceSensors) {
				for (const deviceSensor of sensorsData.deviceSensors as DeviceSensor[]) {
					// Fetch history for this device
					const historyResponse = await apiGet(
						'temperature',
						'/temperature/:deviceId/:timeframe',
						{
							deviceId: deviceSensor.deviceId,
							timeframe: TIMEFRAME_MS[timeframe].toString(),
						}
					);

					const historyData = historyResponse.ok
						? await historyResponse.json()
						: { history: [] };

					// Find device in devices list to get current temperature
					const device = devicesData.devices?.find(
						(d: { uniqueId: string }) => d.uniqueId === deviceSensor.deviceId
					);
					const currentTemp =
						device?.flatAllClusters?.find(
							(c) => c.name === DeviceClusterName.TEMPERATURE_MEASUREMENT
						)?.temperature ?? null;

					allSensors.push({
						id: deviceSensor.deviceId,
						name: deviceSensor.name,
						type: 'device',
						currentTemp,
						history: (historyData.history ?? []) as {
							temperature: number;
							timestamp: number;
						}[],
					});
				}
			}

			setSensors(allSensors);
		} catch (error) {
			console.error('Failed to load temperature data:', error);
		} finally {
			setLoading(false);
		}
	}, [timeframe]);

	useEffect(() => {
		void loadTemperatureData();
	}, [loadTemperatureData]);

	const getTrend = (history: TemperatureEvent[]): 'up' | 'down' | 'stable' => {
		if (history.length < 2) {
			return 'stable';
		}

		const recent = history.slice(0, Math.min(5, history.length));
		const firstTemp = recent[recent.length - 1].temperature;
		const lastTemp = recent[0].temperature;
		const diff = lastTemp - firstTemp;

		if (Math.abs(diff) < 0.3) {
			return 'stable';
		}
		return diff > 0 ? 'up' : 'down';
	};

	const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
		switch (trend) {
			case 'up':
				return <TrendingUpIcon sx={{ color: '#ef4444' }} />;
			case 'down':
				return <TrendingDownIcon sx={{ color: '#3b82f6' }} />;
			case 'stable':
				return <RemoveIcon sx={{ color: '#6b7280' }} />;
		}
	};

	const formatChartData = (history: TemperatureEvent[]) => {
		return {
			labels: history
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
	};

	if (loading) {
		return (
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '100%',
					p: 3,
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
				{/* Header */}
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						flexWrap: 'wrap',
						gap: 2,
					}}
				>
					<Typography variant="h5">Temperature</Typography>
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

				{/* Description */}
				<Typography variant="body2" color="text.secondary">
					View temperature readings from all sensors with historical trends and current
					values.
				</Typography>

				{/* Sensors Grid */}
				{sensors.length === 0 ? (
					<Card>
						<CardContent
							sx={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								py: 6,
								gap: 2,
							}}
						>
							<DeviceThermostatIcon
								sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }}
							/>
							<Typography variant="h6" color="text.secondary">
								No temperature sensors available
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Temperature sensors will appear here once they are detected.
							</Typography>
						</CardContent>
					</Card>
				) : (
					<motion.div variants={staggerContainer} initial="initial" animate="animate">
						<Grid container spacing={3}>
							{sensors.map((sensor) => {
								const trend = getTrend(sensor.history);
								return (
									<Grid size={{ xs: 12, lg: 6 }} key={sensor.id}>
										<motion.div variants={staggerItem}>
											<Card
												sx={{
													borderRadius: 3,
													boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
													background:
														'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 197, 253, 0.05) 100%)',
													border: '1px solid rgba(59, 130, 246, 0.1)',
													height: '100%',
													display: 'flex',
													flexDirection: 'column',
												}}
											>
												<CardContent sx={{ flexGrow: 1 }}>
													{/* Sensor Header */}
													<Box
														sx={{
															display: 'flex',
															justifyContent: 'space-between',
															alignItems: 'flex-start',
															mb: 2,
														}}
													>
														<Box sx={{ flexGrow: 1 }}>
															<Typography
																variant="h6"
																sx={{ fontWeight: 600, mb: 0.5 }}
															>
																{sensor.name}
															</Typography>
															<Chip
																label={
																	sensor.type === 'controller'
																		? 'Controller'
																		: 'Device'
																}
																size="small"
																variant="outlined"
																sx={{ fontSize: '0.7rem' }}
															/>
														</Box>
														<Box
															sx={{
																display: 'flex',
																alignItems: 'center',
																gap: 1,
															}}
														>
															{getTrendIcon(trend)}
															<Typography
																variant="h3"
																sx={{
																	color: '#3b82f6',
																	fontWeight: 700,
																	letterSpacing: '-0.03em',
																}}
															>
																{sensor.currentTemp !== null
																	? `${sensor.currentTemp.toFixed(1)}°`
																	: '--°'}
															</Typography>
														</Box>
													</Box>

													{/* Chart */}
													{sensor.history.length > 0 ? (
														<Box sx={{ mt: 2, height: 200 }}>
															<Line
																data={formatChartData(
																	sensor.history
																)}
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
																			ticks: {
																				callback: (value) =>
																					`${value}°C`,
																			},
																		},
																		x: {
																			ticks: {
																				maxRotation: 45,
																				minRotation: 45,
																			},
																		},
																	},
																}}
															/>
														</Box>
													) : (
														<Box
															sx={{
																display: 'flex',
																alignItems: 'center',
																justifyContent: 'center',
																height: 200,
															}}
														>
															<Typography
																color="text.secondary"
																variant="body2"
															>
																No history data available
															</Typography>
														</Box>
													)}
												</CardContent>
											</Card>
										</motion.div>
									</Grid>
								);
							})}
						</Grid>
					</motion.div>
				)}
			</Box>
		</Box>
	);
};
