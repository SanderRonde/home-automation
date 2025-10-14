import type {
	DashboardDeviceClusterOccupancySensing,
	DashboardDeviceClusterWithState,
	DeviceListWithValuesResponse,
} from '../../../server/modules/device/routing';
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
} from '@mui/material';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import React, { useState, useEffect } from 'react';
import { apiGet } from '../../lib/fetch';

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
					backgroundColor: currentState?.occupied ? '#1a472a' : '#2f2f2f',
					py: 1,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
				}}
			>
				<IconButton style={{ position: 'absolute', left: 0 }} onClick={props.onExit}>
					<ArrowBackIcon style={{ fill: 'white' }} />
				</IconButton>
				<Typography style={{ color: 'white', fontWeight: 'bold' }} variant="h6">
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

export const DeviceDetail = (
	props: DeviceDetailBaseProps<DashboardDeviceClusterWithState>
): JSX.Element | null => {
	if (props.cluster.name === DeviceClusterName.OCCUPANCY_SENSING) {
		return <OccupancyDetail {...props} cluster={props.cluster} />;
	}
	return null;
};
