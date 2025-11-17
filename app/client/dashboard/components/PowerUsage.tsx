import {
	Card,
	CardContent,
	Typography,
	Box,
	CircularProgress,
	ToggleButton,
	ToggleButtonGroup,
	Grid,
	Alert,
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
	// @ts-ignore - chart.js is an ESM module, Bun handles it at runtime
} from 'chart.js';
// @ts-ignore - react-chartjs-2 is an ESM module, Bun handles it at runtime
import { Line } from 'react-chartjs-2';
import { apiGet } from '../../lib/fetch';
import React, { useState, useEffect } from 'react';
import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type {
	DashboardDeviceClusterOnOff,
	DashboardDeviceClusterElectricalPowerMeasurement,
} from '../../../server/modules/device/routing';
import useWebsocket from '../../shared/resilient-socket';
import type {
	DeviceWebsocketClientMessage,
	DeviceWebsocketServerMessage,
} from '../../../server/modules/device/routing';

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

interface PowerHistoryEntry {
	activePower: number;
	timestamp: number;
}

export const PowerUsage = (): JSX.Element => {
	const [devices, setDevices] = useState<DeviceListWithValuesResponse>([]);
	const [timeframe, setTimeframe] = useState<'hour' | 'day' | 'week' | 'month'>('day');
	const [loading, setLoading] = useState<boolean>(true);
	const [devicesLoading, setDevicesLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [powerHistory, setPowerHistory] = useState<
		Map<string, Array<PowerHistoryEntry>>
	>(new Map());

	// Fetch devices
	useEffect(() => {
		const fetchDevices = async () => {
			setDevicesLoading(true);
			try {
				const response = await apiGet('device', '/listWithValues', {});
				if (response.ok) {
					const data = await response.json();
					setDevices(data.devices || []);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to fetch devices');
			} finally {
				setDevicesLoading(false);
			}
		};

		void fetchDevices();
	}, []);

	// WebSocket for real-time updates
	useWebsocket<DeviceWebsocketServerMessage, DeviceWebsocketClientMessage>(
		'device',
		(message) => {
			if (message.type === 'deviceUpdate') {
				// Refresh devices when updated
				void apiGet('device', '/listWithValues', {}).then((response) => {
					if (response.ok) {
						void response.json().then((data) => {
							setDevices(data.devices || []);
						});
					}
				});
			}
		}
	);

	// Get devices that support power measurement
	const devicesWithPower = devices.filter((device) => {
		// Check if device has power measurement cluster
		const hasPowerCluster = device.mergedAllClusters.some(
			(cluster) => cluster.name === DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT
		);

		// Also check if OnOff cluster has merged power cluster
		const onOffCluster = device.mergedAllClusters.find(
			(cluster) => cluster.name === DeviceClusterName.ON_OFF
		) as DashboardDeviceClusterOnOff | undefined;

		const hasMergedPower =
			onOffCluster?.mergedClusters?.[DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT] !==
			undefined;

		return hasPowerCluster || hasMergedPower;
	});

	// Get current power values
	const getCurrentPower = (
		device: DeviceListWithValuesResponse[number]
	): number | undefined => {
		// Check for standalone power cluster
		const powerCluster = device.mergedAllClusters.find(
			(cluster) => cluster.name === DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT
		) as DashboardDeviceClusterElectricalPowerMeasurement | undefined;

		if (powerCluster?.activePower !== undefined) {
			return powerCluster.activePower;
		}

		// Check merged power cluster
		const onOffCluster = device.mergedAllClusters.find(
			(cluster) => cluster.name === DeviceClusterName.ON_OFF
		) as DashboardDeviceClusterOnOff | undefined;

		const mergedPower =
			onOffCluster?.mergedClusters?.[DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT];
		return mergedPower?.activePower;
	};

	const formatPower = (watts: number): string => {
		if (watts >= 1000) {
			return `${(watts / 1000).toFixed(1)} kW`;
		}
		return `${Math.round(watts)} W`;
	};

	const getTimeframeMs = (): number => {
		switch (timeframe) {
			case 'hour':
				return 60 * 60 * 1000; // 1 hour
			case 'day':
				return 24 * 60 * 60 * 1000; // 24 hours
			case 'week':
				return 7 * 24 * 60 * 60 * 1000; // 7 days
			case 'month':
				return 30 * 24 * 60 * 60 * 1000; // 30 days
		}
	};

	useEffect(() => {
		if (devicesLoading) {
			return;
		}

		const fetchPowerHistory = async () => {
			setLoading(true);
			setError(null);

			try {
				const timeframeMs = getTimeframeMs();
				const historyMap = new Map<string, Array<PowerHistoryEntry>>();

				// Get devices that support power measurement
				const devicesWithPower = devices.filter((device) => {
					// Check if device has power measurement cluster
					const hasPowerCluster = device.mergedAllClusters.some(
						(cluster) => cluster.name === DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT
					);

					// Also check if OnOff cluster has merged power cluster
					const onOffCluster = device.mergedAllClusters.find(
						(cluster) => cluster.name === DeviceClusterName.ON_OFF
					) as DashboardDeviceClusterOnOff | undefined;

					const hasMergedPower =
						onOffCluster?.mergedClusters?.[DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT] !==
						undefined;

					return hasPowerCluster || hasMergedPower;
				});

				// Fetch history for each device
				for (const device of devicesWithPower) {
					try {
						const response = await apiGet('device', `/power/${device.uniqueId}/${timeframeMs}`, {});
						if (response.ok) {
							const data = await response.json();
							historyMap.set(device.uniqueId, data.history || []);
						}
					} catch (err) {
						console.error(`Failed to fetch power history for ${device.uniqueId}:`, err);
					}
				}

				setPowerHistory(historyMap);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to fetch power history');
			} finally {
				setLoading(false);
			}
		};

		void fetchPowerHistory();
	}, [timeframe, devices, devicesLoading]);

	const getChartData = (deviceId: string) => {
		const history = powerHistory.get(deviceId) || [];
		const device = devicesWithPower.find((d) => d.uniqueId === deviceId);

		if (!device || history.length === 0) {
			return null;
		}

		// Sort by timestamp ascending for chart
		const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);

		return {
			labels: sortedHistory.map((e) => {
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
					label: 'Power (W)',
					data: sortedHistory.map((e) => e.activePower),
					borderColor: 'rgb(59, 130, 246)',
					backgroundColor: 'rgba(59, 130, 246, 0.1)',
					tension: 0.4,
					fill: true,
				},
			],
		};
	};

	if (devicesLoading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
				<CircularProgress />
			</Box>
		);
	}

	if (devicesWithPower.length === 0) {
		return (
			<Box sx={{ p: 3 }}>
				<Alert severity="info">No devices with power measurement found.</Alert>
			</Box>
		);
	}

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
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
				<Typography variant="h4">Power Usage</Typography>
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

			{loading && (
				<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
					<CircularProgress />
				</Box>
			)}

			{error && (
				<Alert severity="error" sx={{ mb: 3 }}>
					{error}
				</Alert>
			)}

			{!loading && !error && (
				<Grid container spacing={3}>
					{devicesWithPower.map((device) => {
						const currentPower = getCurrentPower(device);
						const chartData = getChartData(device.uniqueId);
						const history = powerHistory.get(device.uniqueId) || [];

						return (
							<Grid item xs={12} md={6} key={device.uniqueId}>
								<Card
									sx={{
										borderRadius: 3,
										boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
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
											<Typography variant="h6" sx={{ fontWeight: 600 }}>
												{device.name}
											</Typography>
											{currentPower !== undefined && (
												<Typography
													variant="h5"
													sx={{
														fontWeight: 'bold',
														color: 'primary.main',
													}}
												>
													{formatPower(currentPower)}
												</Typography>
											)}
										</Box>

										{history.length === 0 ? (
											<Typography variant="body2" color="text.secondary">
												No history available
											</Typography>
										) : chartData ? (
											<Box sx={{ height: 250 }}>
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
																callbacks: {
																	label: (context) => {
																		return `${formatPower(context.parsed.y)}`;
																	},
																},
															},
														},
														scales: {
															y: {
																beginAtZero: true,
																ticks: {
																	callback: (value) => {
																		return formatPower(Number(value));
																	},
																},
															},
														},
													}}
												/>
											</Box>
										) : null}
									</CardContent>
								</Card>
							</Grid>
						);
					})}
				</Grid>
			)}
		</Box>
	);
};
