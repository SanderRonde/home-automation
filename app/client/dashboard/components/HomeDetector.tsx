import {
	Box,
	Card,
	CardContent,
	Typography,
	IconButton,
	Button,
	CircularProgress,
	Chip,
	Tabs,
	Tab,
	List,
	ListItem,
	ListItemText,
	ListItemSecondaryAction,
	Checkbox,
} from '@mui/material';
import {
	Add as AddIcon,
	Delete as DeleteIcon,
	Edit as EditIcon,
	Router as RouterIcon,
	Sensors as SensorsIcon,
} from '@mui/icons-material';
import type { HomeDetectorWebsocketServerMessage } from '../../../server/modules/home-detector/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type { Host } from '../../../server/modules/home-detector/routing';
import { HOME_STATE } from '../../../server/modules/home-detector/types';
import useWebsocket from '../../shared/resilient-socket';
import { HomeDetectorModal } from './HomeDetectorModal';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import { useDevices } from './Devices';

interface EventHistoryItem {
	id: number;
	host_name: string;
	state: string;
	timestamp: number;
	trigger_type?: string | null;
	scenes_triggered?: string | null;
}

export const HomeDetector = (): JSX.Element => {
	const [currentTab, setCurrentTab] = useState(0);
	const [hosts, setHosts] = useState<Host[]>([]);
	const [hostsState, setHostsState] = useState<Record<string, HOME_STATE>>({});
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingHost, setEditingHost] = useState<Host | undefined>(undefined);
	const [doorSensorIds, setDoorSensorIds] = useState<string[]>([]);
	const [savingDoorSensors, setSavingDoorSensors] = useState(false);
	const [movementSensorIds, setMovementSensorIds] = useState<string[]>([]);
	const [savingMovementSensors, setSavingMovementSensors] = useState(false);
	const [eventHistory, setEventHistory] = useState<EventHistoryItem[]>([]);
	const [loadingEvents, setLoadingEvents] = useState(false);

	const { devices } = useDevices();

	const loadHosts = async () => {
		try {
			const response = await apiGet('home-detector', '/list', {});
			if (response.ok) {
				const data = await response.json();
				setHosts(data.hosts);
			}
		} catch (error) {
			console.error('Failed to load hosts:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadHosts();
		void loadDoorSensors();
		void loadMovementSensors();
		void loadEventHistory();
	}, []);

	// Reload events when switching to the Event History tab
	useEffect(() => {
		if (currentTab === 2) {
			void loadEventHistory();
		}
	}, [currentTab]);

	// WebSocket for real-time updates
	useWebsocket<HomeDetectorWebsocketServerMessage, never>('/home-detector/ws', {
		onMessage: (message) => {
			if (message.type === 'state-change') {
				setHostsState(message.fullState);
			}
		},
	});

	const handleCreateHost = () => {
		setEditingHost(undefined);
		setModalOpen(true);
	};

	const handleEditHost = (host: Host) => {
		setEditingHost(host);
		setModalOpen(true);
	};

	const handleSaveHost = async (hostData: { name: string; ips: string[] }) => {
		try {
			if (editingHost) {
				// Update existing host
				const response = await apiPost(
					'home-detector',
					'/:name/update',
					{ name: editingHost.name },
					hostData
				);
				if (response.ok) {
					await loadHosts();
					setModalOpen(false);
				}
			} else {
				// Create new host
				const response = await apiPost('home-detector', '/create', {}, hostData);
				if (response.ok) {
					await loadHosts();
					setModalOpen(false);
				}
			}
		} catch (error) {
			console.error('Failed to save host:', error);
		}
	};

	const handleDeleteHost = async (name: string, event: React.MouseEvent) => {
		event.stopPropagation();
		if (!confirm('Are you sure you want to delete this host?')) {
			return;
		}

		await apiPost('home-detector', '/:name/delete', { name });
		await loadHosts();
	};

	const loadDoorSensors = async () => {
		try {
			const response = await apiGet('home-detector', '/door-sensors/list', {});
			if (response.ok) {
				const data = await response.json();
				setDoorSensorIds(data.doorSensorIds || []);
			}
		} catch (error) {
			console.error('Failed to load door sensors:', error);
		}
	};

	const loadMovementSensors = async () => {
		try {
			const response = await apiGet('home-detector', '/movement-sensors/list', {});
			if (response.ok) {
				const data = await response.json();
				setMovementSensorIds(data.movementSensorIds || []);
			}
		} catch (error) {
			console.error('Failed to load movement sensors:', error);
		}
	};

	const loadEventHistory = async () => {
		setLoadingEvents(true);
		try {
			const response = await apiGet('home-detector', '/events/history', {});
			if (response.ok) {
				const data = await response.json();
				setEventHistory(data.events || []);
			}
		} catch (error) {
			console.error('Failed to load event history:', error);
		} finally {
			setLoadingEvents(false);
		}
	};

	const handleToggleDoorSensor = (deviceId: string) => {
		setDoorSensorIds((prev) => {
			if (prev.includes(deviceId)) {
				return prev.filter((id) => id !== deviceId);
			} else {
				return [...prev, deviceId];
			}
		});
	};

	const handleToggleMovementSensor = (deviceId: string) => {
		setMovementSensorIds((prev) => {
			if (prev.includes(deviceId)) {
				return prev.filter((id) => id !== deviceId);
			} else {
				return [...prev, deviceId];
			}
		});
	};

	const handleSaveDoorSensors = async () => {
		try {
			setSavingDoorSensors(true);
			const response = await apiPost(
				'home-detector',
				'/door-sensors/update',
				{},
				{ doorSensorIds }
			);
			if (response.ok) {
				// Success - could show a snackbar here
			}
		} catch (error) {
			console.error('Failed to save door sensors:', error);
		} finally {
			setSavingDoorSensors(false);
		}
	};

	const handleSaveMovementSensors = async () => {
		try {
			setSavingMovementSensors(true);
			const response = await apiPost(
				'home-detector',
				'/movement-sensors/update',
				{},
				{ movementSensorIds }
			);
			if (response.ok) {
				// Success - could show a snackbar here
			}
		} catch (error) {
			console.error('Failed to save movement sensors:', error);
		} finally {
			setSavingMovementSensors(false);
		}
	};

	const booleanStateDevices = devices.filter((device) =>
		device.flatAllClusters.some((cluster) => cluster.name === DeviceClusterName.BOOLEAN_STATE)
	);

	const occupancyDevices = devices.filter((device) =>
		device.flatAllClusters.some(
			(cluster) => cluster.name === DeviceClusterName.OCCUPANCY_SENSING
		)
	);

	if (loading) {
		return (
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '50vh',
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
			<Typography variant="h4" sx={{ mb: 3 }}>
				Home Detection
			</Typography>

			<Tabs value={currentTab} onChange={(_e, value) => setCurrentTab(value)} sx={{ mb: 3 }}>
				<Tab label="Devices" />
				<Tab label="Sensors" />
				<Tab label="Event History" />
			</Tabs>

			{currentTab === 0 && (
				<Box>
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							mb: 3,
						}}
					>
						<Typography variant="h6">Tracked Devices</Typography>
						<Button
							variant="contained"
							startIcon={<AddIcon />}
							onClick={handleCreateHost}
							sx={{ borderRadius: 2 }}
						>
							Add Host
						</Button>
					</Box>

					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
						{hosts.map((host) => (
							<Card key={host.name} sx={{ borderRadius: 2 }}>
								<CardContent>
									<Box
										sx={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'flex-start',
										}}
									>
										<Box sx={{ flexGrow: 1 }}>
											<Box
												sx={{
													display: 'flex',
													alignItems: 'center',
													gap: 2,
													mb: 1,
												}}
											>
												<Typography variant="h6">{host.name}</Typography>
												<Chip
													label={
														hostsState[host.name] === HOME_STATE.HOME
															? 'Home'
															: 'Away'
													}
													color={
														hostsState[host.name] === HOME_STATE.HOME
															? 'success'
															: 'default'
													}
													size="small"
												/>
											</Box>
											<Box
												sx={{
													display: 'flex',
													alignItems: 'center',
													gap: 1,
													mb: 1,
												}}
											>
												<RouterIcon
													sx={{ fontSize: 16, color: 'text.secondary' }}
												/>
												<Typography
													variant="body2"
													sx={{ color: 'text.secondary' }}
												>
													{host.ips.join(', ')}
												</Typography>
											</Box>
											{host.lastSeen && (
												<Typography
													variant="caption"
													sx={{ color: 'text.secondary' }}
												>
													Last seen:{' '}
													{new Date(host.lastSeen).toLocaleString()}
												</Typography>
											)}
										</Box>
										<Box sx={{ display: 'flex', gap: 1 }}>
											<IconButton
												size="small"
												onClick={() => handleEditHost(host)}
												sx={{ color: 'primary.main' }}
											>
												<EditIcon />
											</IconButton>
											<IconButton
												size="small"
												onClick={(e) => handleDeleteHost(host.name, e)}
												sx={{ color: 'error.main' }}
											>
												<DeleteIcon />
											</IconButton>
										</Box>
									</Box>
								</CardContent>
							</Card>
						))}

						{hosts.length === 0 && (
							<Typography
								variant="body1"
								sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}
							>
								No hosts configured yet. Add a host to start tracking presence.
							</Typography>
						)}
					</Box>

					<HomeDetectorModal
						open={modalOpen}
						onClose={() => setModalOpen(false)}
						onSave={handleSaveHost}
						host={editingHost}
					/>
				</Box>
			)}

			{currentTab === 1 && (
				<Box>
					<Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
						<Typography variant="h6">Sensors</Typography>
						<Button
							variant="contained"
							onClick={() => {
								void handleSaveDoorSensors();
								void handleSaveMovementSensors();
							}}
							disabled={savingDoorSensors || savingMovementSensors}
						>
							{savingDoorSensors || savingMovementSensors
								? 'Saving...'
								: 'Save Changes'}
						</Button>
					</Box>

					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
						<Card sx={{ borderRadius: 2 }}>
							<CardContent>
								<Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500 }}>
									Door Sensors
								</Typography>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
									<SensorsIcon sx={{ color: 'text.secondary' }} />
									<Typography variant="body2" color="text.secondary">
										Select door sensors to trigger rapid device re-ping. When
										triggered, all devices will be pinged rapidly for 60 seconds to
										detect if someone comes home.
									</Typography>
								</Box>

								{booleanStateDevices.length === 0 ? (
									<Typography variant="body2" color="text.secondary">
										No door sensors found. Make sure your door sensors are
										connected and have a BooleanState cluster.
									</Typography>
								) : (
									<List>
										{booleanStateDevices.map((device) => (
											<ListItem key={device.uniqueId} divider>
												<ListItemText
													primary={device.name || device.uniqueId}
													secondary={device.room || 'No room assigned'}
												/>
												<ListItemSecondaryAction>
													<Checkbox
														edge="end"
														checked={doorSensorIds.includes(device.uniqueId)}
														onChange={() =>
															handleToggleDoorSensor(device.uniqueId)
														}
													/>
												</ListItemSecondaryAction>
											</ListItem>
										))}
									</List>
								)}
							</CardContent>
						</Card>

						<Card sx={{ borderRadius: 2 }}>
							<CardContent>
								<Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500 }}>
									Movement Sensors
								</Typography>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
									<SensorsIcon sx={{ color: 'text.secondary' }} />
									<Typography variant="body2" color="text.secondary">
										Select movement sensors to trigger rapid device re-ping. When
										triggered, all devices will be pinged rapidly for 60 seconds to
										detect if someone comes home.
									</Typography>
								</Box>

								{occupancyDevices.length === 0 ? (
									<Typography variant="body2" color="text.secondary">
										No movement sensors found. Make sure your movement sensors are
										connected and have an OccupancySensing cluster.
									</Typography>
								) : (
									<List>
										{occupancyDevices.map((device) => (
											<ListItem key={device.uniqueId} divider>
												<ListItemText
													primary={device.name || device.uniqueId}
													secondary={device.room || 'No room assigned'}
												/>
												<ListItemSecondaryAction>
													<Checkbox
														edge="end"
														checked={movementSensorIds.includes(
															device.uniqueId
														)}
														onChange={() =>
															handleToggleMovementSensor(device.uniqueId)
														}
													/>
												</ListItemSecondaryAction>
											</ListItem>
										))}
									</List>
								)}
							</CardContent>
						</Card>
					</Box>
				</Box>
			)}

			{currentTab === 2 && (
				<Box>
					<Box sx={{ mb: 3 }}>
						<Typography variant="h6">Recent Events</Typography>
						<Typography variant="body2" color="text.secondary">
							History of home state changes and scene triggers
						</Typography>
					</Box>

					{loadingEvents ? (
						<Box
							sx={{
								display: 'flex',
								justifyContent: 'center',
								alignItems: 'center',
								height: '200px',
							}}
						>
							<CircularProgress />
						</Box>
					) : eventHistory.length === 0 ? (
						<Card sx={{ borderRadius: 2 }}>
							<CardContent>
								<Typography
									variant="body2"
									color="text.secondary"
									textAlign="center"
								>
									No events yet. Events will appear here when devices change state
									or scenes are triggered.
								</Typography>
							</CardContent>
						</Card>
					) : (
						<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
							{eventHistory.map((event) => {
								const date = new Date(event.timestamp);
								return (
									<Card key={event.id} sx={{ borderRadius: 2 }}>
										<CardContent>
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'flex-start',
													mb: 1,
												}}
											>
												<Box sx={{ flexGrow: 1 }}>
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															gap: 1,
															mb: 1,
														}}
													>
														<Typography
															variant="subtitle1"
															fontWeight={500}
														>
															{event.host_name}
														</Typography>
														<Chip
															label={
																event.state === 'HOME'
																	? 'Home'
																	: 'Away'
															}
															color={
																event.state === 'HOME'
																	? 'success'
																	: 'default'
															}
															size="small"
														/>
													</Box>
													<Typography
														variant="body2"
														color="text.secondary"
													>
														{date.toLocaleString()}
													</Typography>
													{event.trigger_type && (
														<Typography
															variant="caption"
															color="text.secondary"
															sx={{ display: 'block', mt: 0.5 }}
														>
															Trigger:{' '}
															{event.trigger_type.replace('-', ' ')}
														</Typography>
													)}
												</Box>
											</Box>
										</CardContent>
									</Card>
								);
							})}
						</Box>
					)}
				</Box>
			)}
		</Box>
	);
};
