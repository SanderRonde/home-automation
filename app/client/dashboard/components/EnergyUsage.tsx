import {
	Box,
	Card,
	CardContent,
	Typography,
	Grid,
	Button,
	TextField,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Chip,
	ToggleButtonGroup,
	ToggleButton,
	CircularProgress,
} from '@mui/material';
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from 'recharts';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { DeviceSource } from '../../../server/modules/device/device';
import { staggerContainer, staggerItem } from '../../lib/animations';
import React, { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon } from '@mui/icons-material';
import { apiPost, apiGet } from '../../lib/fetch';
import { motion } from 'framer-motion';
import { useDevices } from './Devices';

type Timeframe = '1h' | '6h' | '24h' | '1week';

const TIMEFRAME_MS: Record<Timeframe, number> = {
	'1h': 60 * 60 * 1000,
	'6h': 6 * 60 * 60 * 1000,
	'24h': 24 * 60 * 60 * 1000,
	'1week': 7 * 24 * 60 * 60 * 1000,
};

interface PowerEvent {
	deviceId: string;
	activePower: number;
	timestamp: number;
}

export const EnergyUsage = (): JSX.Element => {
	const [configDialogOpen, setConfigDialogOpen] = useState(false);
	const [ip, setIp] = useState('');
	const [token, setToken] = useState('');
	const [timeframe, setTimeframe] = useState<Timeframe>('24h');
	const [historicalData, setHistoricalData] = useState<PowerEvent[]>([]);
	const [loadingHistory, setLoadingHistory] = useState(true);

	const { devices } = useDevices();

	const energies = React.useMemo(() => {
		try {
			const energies = [];
			for (const device of devices ?? []) {
				let totalPower = 0;
				let totalEnergy = 0;
				for (const cluster of device.flatAllClusters ?? []) {
					if (cluster.name === DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT) {
						totalPower += cluster.activePower;
					}
					if (cluster.name === DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT) {
						totalEnergy += Number(cluster.totalEnergy);
					}
				}
				if (totalPower > 0 || totalEnergy > 0) {
					energies.push({
						name: device.name,
						energy: totalEnergy,
						power: totalPower,
						deviceId: device.uniqueId,
						isHomeWizard: device.source.name === DeviceSource.HOMEWIZARD.value,
					});
				}
			}
			return energies.sort((a, b) => {
				// Sort by highest energy first; if equal, then by highest power
				if (b.energy !== a.energy) {
					return b.energy - a.energy;
				}
				return b.power - a.power;
			});
		} catch (error) {
			console.error('Failed to load energy:', error);
			return [];
		}
	}, [devices]);

	const powerDevices = React.useMemo(() => {
		return energies.filter((e) => e.power > 0);
	}, [energies]);

	const energyDevices = React.useMemo(() => {
		return energies.filter((e) => e.energy > 0);
	}, [energies]);

	const homeWizardDevice = React.useMemo(() => {
		return devices?.find((d) => d.source.name === DeviceSource.HOMEWIZARD.value);
	}, [devices]);

	const loadHistoricalData = useCallback(async () => {
		try {
			setLoadingHistory(true);
			const response = await apiGet('device', '/power/all/:timeframe', {
				timeframe: TIMEFRAME_MS[timeframe].toString(),
			});
			if (response.ok) {
				const data = await response.json();
				setHistoricalData(data.history || []);
			} else {
				setHistoricalData([]);
			}
		} catch (error) {
			console.error('Failed to load historical power data:', error);
			setHistoricalData([]);
		} finally {
			setLoadingHistory(false);
		}
	}, [timeframe]);

	useEffect(() => {
		void loadHistoricalData();
	}, [loadHistoricalData]);

	const chartData = React.useMemo(() => {
		if (historicalData.length === 0) {
			return [];
		}

		// Get device names map
		const deviceNameMap = new Map<string, string>();
		for (const device of devices ?? []) {
			deviceNameMap.set(device.uniqueId, device.name);
		}

		// Identify HomeWizard device ID
		const homeWizardDeviceId = homeWizardDevice?.uniqueId;
		const homeWizardExists = !!homeWizardDeviceId;

		// Group events by device, sorted by timestamp
		const deviceEvents = new Map<string, Array<{ timestamp: number; power: number }>>();
		for (const event of historicalData) {
			if (!deviceEvents.has(event.deviceId)) {
				deviceEvents.set(event.deviceId, []);
			}
			deviceEvents.get(event.deviceId)!.push({
				timestamp: event.timestamp,
				power: event.activePower,
			});
		}

		// Sort events by timestamp for each device
		for (const events of deviceEvents.values()) {
			events.sort((a, b) => a.timestamp - b.timestamp);
		}

		// Use the requested timeframe to determine the time range, not the actual data range
		// This ensures we always show the full requested period
		const now = Date.now();
		const timeframeMs = TIMEFRAME_MS[timeframe];
		const minTime = now - timeframeMs;
		const maxTime = now;

		// Determine time interval based on timeframe (smaller intervals for shorter timeframes)
		// Also ensure we don't have too many data points for performance
		const maxDataPoints = 200;
		const totalTime = timeframeMs;
		const baseIntervalMs =
			timeframe === '1h'
				? 60 * 1000 // 1 minute
				: timeframe === '6h'
					? 5 * 60 * 1000 // 5 minutes
					: timeframe === '24h'
						? 15 * 60 * 1000 // 15 minutes
						: 60 * 60 * 1000; // 1 hour

		// Adjust interval to keep data points under limit
		const intervalMs = Math.max(baseIntervalMs, Math.ceil(totalTime / maxDataPoints));

		// Create time buckets from the start of the timeframe to now
		const timeBuckets: number[] = [];
		for (let t = minTime; t <= maxTime; t += intervalMs) {
			timeBuckets.push(t);
		}

		// For each device, create forward-filled values for each time bucket
		const deviceValues = new Map<string, number[]>();
		for (const [deviceId, events] of deviceEvents) {
			if (events.length === 0) {
				continue;
			}

			const values: number[] = [];
			let eventIndex = 0;
			let lastValue: number | null = null;

			for (const bucketTime of timeBuckets) {
				// Advance to the most recent event at or before this bucket time
				while (eventIndex < events.length && events[eventIndex].timestamp <= bucketTime) {
					lastValue = events[eventIndex].power;
					eventIndex++;
				}
				// Use forward-filled value, or 0 if no data yet
				values.push(lastValue ?? 0);
			}
			deviceValues.set(deviceId, values);
		}

		// Get all non-HomeWizard device IDs that have data
		const nonHomeWizardDeviceIds = Array.from(deviceEvents.keys()).filter(
			(id) => id !== homeWizardDeviceId && deviceValues.has(id)
		);

		// Create chart data points
		const data = timeBuckets.map((timestamp, index) => {
			const point: Record<string, number | string> = {
				time: timestamp,
			};

			// Main line: max(HomeWizard, sum of all other devices)
			let homeWizardPower = 0;
			if (homeWizardExists && homeWizardDeviceId && deviceValues.has(homeWizardDeviceId)) {
				const homeWizardValues = deviceValues.get(homeWizardDeviceId)!;
				homeWizardPower = homeWizardValues[index] ?? 0;
			}

			// Sum all non-HomeWizard devices
			let sumOfOthers = 0;
			for (const deviceId of nonHomeWizardDeviceIds) {
				const values = deviceValues.get(deviceId);
				if (values) {
					sumOfOthers += values[index] ?? 0;
				}
			}

			// Use the maximum of HomeWizard and sum of others
			point['Total Power'] = Math.max(homeWizardPower, sumOfOthers);

			// Individual device lines (non-HomeWizard only)
			for (const deviceId of nonHomeWizardDeviceIds) {
				const deviceName = deviceNameMap.get(deviceId) || deviceId;
				const values = deviceValues.get(deviceId);
				if (values) {
					point[deviceName] = values[index] ?? 0;
				}
			}

			return point;
		});

		return data;
	}, [historicalData, devices, homeWizardDevice, timeframe]);

	const formatTimeLabel = (timestamp: number | string): string => {
		const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp);
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

	// Get line colors and names for rendering - only include lines that exist in chartData
	const lineConfig = React.useMemo(() => {
		if (chartData.length === 0) {
			return [];
		}

		const deviceNameMap = new Map<string, string>();
		for (const device of devices ?? []) {
			deviceNameMap.set(device.uniqueId, device.name);
		}

		// Get all keys from the first data point (excluding 'time')
		const dataKeys = Object.keys(chartData[0]).filter((key) => key !== 'time');

		// Expanded color palette with more unique colors
		const colors = [
			'#3b82f6', // blue (main line)
			'#f59e0b', // amber
			'#10b981', // emerald
			'#ef4444', // red
			'#8b5cf6', // violet
			'#ec4899', // pink
			'#06b6d4', // cyan
			'#84cc16', // lime
			'#f97316', // orange
			'#6366f1', // indigo
			'#14b8a6', // teal
			'#a855f7', // purple
			'#eab308', // yellow
			'#22c55e', // green
			'#f43f5e', // rose
		];

		const lines: Array<{ name: string; color: string; isMain: boolean }> = [];

		// Find main line (Total Power)
		const mainLineName = dataKeys.find((key) => key === 'Total Power');
		if (mainLineName) {
			lines.push({
				name: mainLineName,
				color: colors[0],
				isMain: true,
			});
		}

		// Individual device lines (exclude main line) - assign unique colors
		const usedColors = new Set([colors[0]]); // Reserve first color for main line
		let colorIndex = 1;
		for (const key of dataKeys) {
			if (key !== mainLineName) {
				// Find next available unique color
				while (usedColors.has(colors[colorIndex % colors.length])) {
					colorIndex++;
				}
				const color = colors[colorIndex % colors.length];
				usedColors.add(color);
				lines.push({
					name: key,
					color: color,
					isMain: false,
				});
				colorIndex++;
			}
		}

		return lines;
	}, [chartData, devices]);

	const handleSaveConfig = async () => {
		try {
			const response = await apiPost(
				'homewizard',
				'/config',
				{},
				{
					ip: ip,
					token: token,
				}
			);
			if (response.ok) {
				setConfigDialogOpen(false);
			} else {
				console.error('Failed to save config');
			}
		} catch (error) {
			console.error('Failed to save config:', error);
		}
	};

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
					<Typography variant="h5">Energy Usage</Typography>
					<Button
						variant="outlined"
						startIcon={<SettingsIcon />}
						onClick={() => {
							setConfigDialogOpen(true);
						}}
					>
						Configure
					</Button>
				</Box>

				{/* Historical Graph */}
				<Card
					sx={{
						borderRadius: 3,
						boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
						background:
							'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 197, 253, 0.05) 100%)',
						border: '1px solid rgba(59, 130, 246, 0.1)',
					}}
				>
					<CardContent>
						<Box
							sx={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								flexWrap: 'wrap',
								gap: 2,
								mb: 2,
							}}
						>
							<Typography variant="h6" sx={{ fontWeight: 600 }}>
								Historical Power Usage
							</Typography>
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
						{loadingHistory ? (
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'center',
									alignItems: 'center',
									height: 400,
								}}
							>
								<CircularProgress />
							</Box>
						) : chartData.length > 0 ? (
							<Box
								sx={{
									height: 400,
									width: '100%',
									minHeight: 400,
									display: 'block',
								}}
							>
								<ResponsiveContainer width="100%" height={400}>
									<LineChart
										data={chartData}
										margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
									>
										<CartesianGrid
											strokeDasharray="3 3"
											stroke="rgba(128,128,128,0.2)"
										/>
										<XAxis
											dataKey="time"
											tickFormatter={formatTimeLabel}
											angle={-45}
											textAnchor="end"
											height={60}
											stroke="rgba(255,255,255,0.7)"
											tick={{ fill: 'rgba(255,255,255,0.7)' }}
										/>
										<YAxis
											label={{
												value: 'Power (W)',
												angle: -90,
												position: 'insideLeft',
												fill: 'rgba(255,255,255,0.7)',
											}}
											stroke="rgba(255,255,255,0.7)"
											tick={{ fill: 'rgba(255,255,255,0.7)' }}
										/>
										<Tooltip
											labelFormatter={(value) => formatTimeLabel(value)}
											formatter={(value: number, name: string) => [
												`${value.toFixed(0)} W`,
												name,
											]}
											contentStyle={{
												backgroundColor: 'rgba(255, 255, 255, 0.95)',
												border: '1px solid rgba(0,0,0,0.1)',
												borderRadius: '4px',
												zIndex: 1000,
											}}
											wrapperStyle={{
												zIndex: 1000,
											}}
										/>
										<Legend wrapperStyle={{ color: 'rgba(255,255,255,0.7)' }} />
										{lineConfig.map((line) => (
											<Line
												key={line.name}
												type="monotone"
												dataKey={line.name}
												stroke={line.color}
												strokeWidth={line.isMain ? 2.5 : 2}
												dot={false}
												activeDot={{ r: 4 }}
												connectNulls
											/>
										))}
									</LineChart>
								</ResponsiveContainer>
							</Box>
						) : (
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									height: 400,
								}}
							>
								<Typography color="text.secondary" variant="body2">
									No historical data available
								</Typography>
							</Box>
						)}
					</CardContent>
				</Card>

				{/* Description */}
				<Typography variant="body2" color="text.secondary">
					Monitor real-time energy usage from your devices.
				</Typography>

				{/* Current Power Section */}
				{powerDevices.length > 0 && (
					<Box>
						<Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
							Current Power
						</Typography>
						<motion.div variants={staggerContainer} initial="initial" animate="animate">
							<Grid container spacing={3}>
								{powerDevices.map((energy, index) => (
									<Grid key={energy.name + index} size={{ xs: 12, md: 6, lg: 4 }}>
										<motion.div variants={staggerItem}>
											<Card
												sx={{
													borderRadius: 3,
													boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
													background:
														'linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, rgba(252, 211, 77, 0.05) 100%)',
													border: '1px solid rgba(251, 191, 36, 0.1)',
													height: '100%',
													display: 'flex',
													flexDirection: 'column',
												}}
											>
												<CardContent sx={{ flexGrow: 1 }}>
													<Box
														sx={{
															display: 'flex',
															flexDirection: 'column',
															gap: 2,
														}}
													>
														{/* Device Name */}
														<Box>
															<Typography
																variant="h6"
																sx={{ fontWeight: 600, mb: 0.5 }}
															>
																{energy.name}
															</Typography>
															<Chip
																label="Live"
																size="small"
																variant="outlined"
																sx={{ fontSize: '0.7rem' }}
															/>
														</Box>

														{/* Power Display */}
														<Box
															sx={{
																display: 'flex',
																justifyContent: 'space-between',
																alignItems: 'center',
															}}
														>
															<Typography
																variant="body2"
																color="text.secondary"
															>
																Current Power
															</Typography>
															<Box
																sx={{
																	display: 'flex',
																	alignItems: 'baseline',
																	gap: 0.5,
																}}
															>
																<Typography
																	variant="h4"
																	sx={{
																		color: '#f59e0b',
																		fontWeight: 700,
																		letterSpacing: '-0.03em',
																	}}
																>
																	{energy.power.toFixed(0)}
																</Typography>
																<Typography
																	variant="body1"
																	sx={{
																		color: '#f59e0b',
																		fontWeight: 500,
																	}}
																>
																	W
																</Typography>
															</Box>
														</Box>
													</Box>
												</CardContent>
											</Card>
										</motion.div>
									</Grid>
								))}
							</Grid>
						</motion.div>
					</Box>
				)}

				{/* Total Energy Section */}
				{energyDevices.length > 0 && (
					<Box>
						<Typography variant="h6" sx={{ mb: 2, fontWeight: 600, mt: 3 }}>
							Total Energy
						</Typography>
						<motion.div variants={staggerContainer} initial="initial" animate="animate">
							<Grid container spacing={3}>
								{energyDevices.map((energy, index) => (
									<Grid key={energy.name + index} size={{ xs: 12, md: 6, lg: 4 }}>
										<motion.div variants={staggerItem}>
											<Card
												sx={{
													borderRadius: 3,
													boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
													background:
														'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(52, 211, 153, 0.05) 100%)',
													border: '1px solid rgba(16, 185, 129, 0.1)',
													height: '100%',
													display: 'flex',
													flexDirection: 'column',
												}}
											>
												<CardContent sx={{ flexGrow: 1 }}>
													<Box
														sx={{
															display: 'flex',
															flexDirection: 'column',
															gap: 2,
														}}
													>
														{/* Device Name */}
														<Box>
															<Typography
																variant="h6"
																sx={{ fontWeight: 600, mb: 0.5 }}
															>
																{energy.name}
															</Typography>
															<Chip
																label="Live"
																size="small"
																variant="outlined"
																sx={{ fontSize: '0.7rem' }}
															/>
														</Box>

														{/* Energy Display */}
														<Box
															sx={{
																display: 'flex',
																justifyContent: 'space-between',
																alignItems: 'center',
															}}
														>
															<Typography
																variant="body2"
																color="text.secondary"
															>
																Total Energy
															</Typography>
															<Box
																sx={{
																	display: 'flex',
																	alignItems: 'baseline',
																	gap: 0.5,
																}}
															>
																<Typography
																	variant="h4"
																	sx={{
																		color: '#10b981',
																		fontWeight: 700,
																		letterSpacing: '-0.03em',
																	}}
																>
																	{energy.energy.toFixed(1)}
																</Typography>
																<Typography
																	variant="body1"
																	sx={{
																		color: '#10b981',
																		fontWeight: 500,
																	}}
																>
																	kWh
																</Typography>
															</Box>
														</Box>
													</Box>
												</CardContent>
											</Card>
										</motion.div>
									</Grid>
								))}
							</Grid>
						</motion.div>
					</Box>
				)}

				{/* Empty State */}
				{powerDevices.length === 0 && energyDevices.length === 0 && (
					<Grid container spacing={3}>
						<Grid size={12}>
							<Typography
								variant="body1"
								color="text.secondary"
								sx={{ textAlign: 'center', py: 4 }}
							>
								No energy data available. Make sure your devices are configured.
							</Typography>
						</Grid>
					</Grid>
				)}
			</Box>

			{/* Configuration Dialog */}
			<Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)}>
				<DialogTitle>Configure HomeWizard</DialogTitle>
				<DialogContent>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
						<Box>
							<Typography variant="subtitle2" gutterBottom>
								Instructions:
							</Typography>
							<Box component="ol" sx={{ pl: 2, m: 0 }}>
								{[
									'1. Open the HomeWizard Energy app on your phone',
									'2. Go to Settings > API',
									'3. Enable "Local API"',
									'4. Note the IP address shown (e.g., 192.168.1.100)',
									'5. The API token is not required for local API access',
									'6. Enter the IP address in the configuration below',
								].map((instruction, index) => (
									<Typography
										component="li"
										key={index}
										variant="body2"
										color="text.secondary"
										sx={{ mb: 0.5 }}
									>
										{instruction}
									</Typography>
								))}
							</Box>
							<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
								For more details, visit{' '}
								<a
									href={
										'https://api-documentation.homewizard.com/docs/category/api-v2'
									}
									target="_blank"
									rel="noopener noreferrer"
								>
									{
										'https://api-documentation.homewizard.com/docs/category/api-v2'
									}
								</a>
							</Typography>
						</Box>
						<TextField
							label="IP Address"
							value={ip}
							onChange={(e) => setIp(e.target.value)}
							placeholder="192.168.1.100"
							fullWidth
							helperText="Enter the IP address of your HomeWizard Energy device"
						/>
						<TextField
							label="Token"
							value={token}
							onChange={(e) => setToken(e.target.value)}
							placeholder="1234567890"
							fullWidth
							helperText="Enter the token of your HomeWizard Energy device"
						/>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
					<Button onClick={handleSaveConfig} variant="contained">
						Save
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};
