import {
	Card,
	CardContent,
	Typography,
	Box,
	Chip,
	Stack,
	Accordion,
	AccordionSummary,
	AccordionDetails,
	Divider,
	TextField,
	Button,
	Alert,
	Grid,
	CardActionArea,
	CircularProgress,
	Tooltip,
	IconButton,
} from '@mui/material';
import {
	RoomPreferences as RoomIcon,
	Edit as EditIcon,
	Check as CheckIcon,
	Close as CloseIcon,
} from '@mui/icons-material';
import { RoomAssignmentDialog } from './RoomAssignmentDialog';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { ReturnTypeForApi } from '../../lib/fetch';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import * as Icons from '@mui/icons-material';
import type { SxProps } from '@mui/material';

interface EndpointVisualizationProps {
	endpoint: ReturnTypeForApi<
		'dashboard',
		'/getDevices',
		'GET'
	>['ok']['devices'][number]['endpoints'][number];
	level: number;
	title?: string;
}

const EndpointVisualization: React.FC<EndpointVisualizationProps> = (props) => {
	const hasContent =
		props.endpoint.clusters.length > 0 ||
		props.endpoint.endpoints.length > 0;

	if (!hasContent) {
		return null;
	}

	return (
		<Box sx={{ ml: props.level * 2, mt: props.level > 0 ? 1 : 0 }}>
			{props.title && (
				<Typography
					variant="subtitle2"
					sx={{ mb: 1, fontWeight: 'bold' }}
				>
					{props.title}
				</Typography>
			)}

			{props.endpoint.clusters.length > 0 && (
				<Box sx={{ mb: 2 }}>
					<Typography
						variant="body2"
						sx={{ mb: 1, color: 'text.secondary' }}
					>
						Clusters:
					</Typography>
					<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
						{props.endpoint.clusters.map((cluster, idx) => (
							<Chip
								key={idx}
								label={`${cluster.emoji} ${cluster.name}`}
								size="small"
								variant="outlined"
								sx={{ fontSize: '0.75rem' }}
							/>
						))}
					</Box>
				</Box>
			)}

			{props.endpoint.endpoints.length > 0 && (
				<Box sx={{ ml: 1 }}>
					{props.endpoint.endpoints.map((subEndpoint, idx) => (
						<Box key={idx} sx={{ mb: 1 }}>
							<EndpointVisualization
								endpoint={subEndpoint}
								level={props.level + 1}
								title={`Endpoint ${idx + 1}`}
							/>
							{idx < props.endpoint.endpoints.length - 1 && (
								<Divider sx={{ my: 1, opacity: 0.3 }} />
							)}
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
};

export const Devices: React.FC = () => {
	const [devices, setDevices] = useState<
		ReturnTypeForApi<'dashboard', '/getDevices', 'GET'>['ok']['devices']
	>([]);
	const [pairingCode, setPairingCode] = useState('');
	const [pairingLoading, setPairingLoading] = useState(false);
	const [pairingMessage, setPairingMessage] = useState<{
		type: 'success' | 'error';
		text: string;
	} | null>(null);
	const [expandedDevices, setExpandedDevices] = useState<Set<string>>(
		new Set()
	);
	const [loadingDevices, setLoadingDevices] = useState(false);
	const [roomDialogOpen, setRoomDialogOpen] = useState(false);
	const [selectedDevice, setSelectedDevice] = useState<{
		id: string;
		name: string;
		room?: string;
	} | null>(null);
	const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
	const [editedName, setEditedName] = useState('');

	const fetchDevices = async (showLoading = false) => {
		try {
			if (showLoading) {
				setLoadingDevices(true);
			}
			const response = await apiGet('dashboard', '/getDevices', {});

			if (!response.ok) {
				throw new Error(
					`Failed to fetch devices: ${await response.text()}`
				);
			}

			const data = await response.json();
			// Sort devices first by source, then alphabetically by name
			const sortedDevices = data.devices.sort((a, b) => {
				if (a.source.name !== b.source.name) {
					return a.source.name.localeCompare(b.source.name);
				}
				return a.name.localeCompare(b.name);
			});

			setDevices(sortedDevices);
		} catch (error) {
			console.error('Failed to fetch devices:', error);
		} finally {
			if (showLoading) {
				setLoadingDevices(false);
			}
		}
	};

	const handlePair = async () => {
		if (!pairingCode.trim()) {
			return;
		}

		setPairingLoading(true);
		setPairingMessage(null);

		try {
			const response = await apiPost('dashboard', '/pair/:code', {
				code: pairingCode,
			});

			if (!response.ok) {
				throw new Error(
					`Failed to pair device: ${await response.text()}`
				);
			}

			const pairedDevices = await response.json();
			setPairingMessage({
				type: 'success',
				text: `Device pairing initiated successfully. ${pairedDevices.devices.length} device${pairedDevices.devices.length !== 1 ? 's' : ''} paired.`,
			});
			setPairingCode('');

			// Refresh the device list immediately and clear message after delay
			await fetchDevices(true);
			setTimeout(() => setPairingMessage(null), 3000);
		} catch (error) {
			console.error('Failed to pair Matter device:', error);
			setPairingMessage({
				type: 'error',
				text:
					error instanceof Error
						? error.message
						: 'Failed to pair device',
			});

			// Clear error message after delay
			setTimeout(() => setPairingMessage(null), 5000);
		} finally {
			setPairingLoading(false);
		}
	};

	const toggleDeviceExpansion = (deviceId: string) => {
		setExpandedDevices((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(deviceId)) {
				newSet.delete(deviceId);
			} else {
				newSet.add(deviceId);
			}
			return newSet;
		});
	};

	const handleOpenRoomDialog = (
		deviceId: string,
		deviceName: string,
		room?: string
	) => {
		setSelectedDevice({ id: deviceId, name: deviceName, room });
		setRoomDialogOpen(true);
	};

	const handleCloseRoomDialog = () => {
		setRoomDialogOpen(false);
		setSelectedDevice(null);
	};

	const handleRoomAssigned = () => {
		void fetchDevices();
	};

	const getIconComponent = (iconName: string) => {
		const IconComponent = (
			Icons as Record<string, React.ComponentType<{ sx?: SxProps }>>
		)[iconName];
		return IconComponent ? (
			<IconComponent sx={{ fill: '#2f2f2f' }} />
		) : null;
	};

	const handleStartEdit = (deviceId: string, currentName: string) => {
		setEditingDeviceId(deviceId);
		setEditedName(currentName);
	};

	const handleCancelEdit = () => {
		setEditingDeviceId(null);
		setEditedName('');
	};

	const handleSaveEdit = async (deviceId: string) => {
		if (
			!editedName.trim() ||
			editedName === devices.find((d) => d.uniqueId === deviceId)?.name
		) {
			handleCancelEdit();
			return;
		}

		try {
			const response = await apiPost(
				'device',
				'/updateName',
				{},
				{
					deviceId,
					name: editedName.trim(),
				}
			);

			if (response.ok) {
				await fetchDevices();
				handleCancelEdit();
			} else {
				console.error('Failed to update device name');
			}
		} catch (error) {
			console.error('Failed to update device name:', error);
		}
	};

	useEffect(() => {
		void fetchDevices();
		// Poll for updates every 30 seconds
		const interval = setInterval(fetchDevices, 30000);
		return () => clearInterval(interval);
	}, []);

	return (
		<Box>
			<Typography variant="h5" gutterBottom>
				Devices
			</Typography>

			<Grid container spacing={3}>
				{/* Left Column - Devices List */}
				<Grid size={8}>
					<Box
						sx={{
							maxHeight: '100%',
							overflow: 'auto',
							pr: 1,
							'&::-webkit-scrollbar': {
								width: '6px',
							},
							'&::-webkit-scrollbar-track': {
								background: 'rgba(0,0,0,0.1)',
								borderRadius: '3px',
							},
							'&::-webkit-scrollbar-thumb': {
								background: 'rgba(0,0,0,0.3)',
								borderRadius: '3px',
								'&:hover': {
									background: 'rgba(0,0,0,0.5)',
								},
							},
						}}
					>
						<Stack spacing={2}>
							{loadingDevices && (
								<Box
									sx={{
										display: 'flex',
										justifyContent: 'center',
										py: 2,
									}}
								>
									<CircularProgress size={24} />
								</Box>
							)}
							{devices.map((device) => {
								const isExpanded = expandedDevices.has(
									device.uniqueId
								);
								const allEmojis = device.allClusters
									.map((c) => c.emoji)
									.join(' ');
								const isEditing =
									editingDeviceId === device.uniqueId;

								return (
									<Card key={device.uniqueId} elevation={1}>
										{/* Header with name, edit controls, and room */}
										<Box
											sx={{
												display: 'flex',
												alignItems: 'stretch',
												borderBottom: '1px solid',
												borderColor: 'divider',
											}}
										>
											{isEditing ? (
												<Box
													sx={{
														py: 2,
														px: 2,
														display: 'flex',
														alignItems: 'center',
														gap: 1,
														flexGrow: 1,
													}}
												>
													<TextField
														value={editedName}
														onChange={(e) =>
															setEditedName(
																e.target.value
															)
														}
														onKeyDown={(e) => {
															if (
																e.key ===
																'Enter'
															) {
																void handleSaveEdit(
																	device.uniqueId
																);
															} else if (
																e.key ===
																'Escape'
															) {
																handleCancelEdit();
															}
														}}
														size="small"
														autoFocus
														sx={{ flex: 1 }}
													/>
													<IconButton
														size="small"
														onClick={() => {
															void handleSaveEdit(
																device.uniqueId
															);
														}}
														color="primary"
													>
														<CheckIcon fontSize="small" />
													</IconButton>
													<IconButton
														size="small"
														onClick={
															handleCancelEdit
														}
													>
														<CloseIcon fontSize="small" />
													</IconButton>
												</Box>
											) : (
												<>
													<Box
														sx={{
															py: 2,
															px: 2,
															display: 'flex',
															alignItems:
																'center',
															gap: 1,
															flexGrow: 1,
														}}
													>
														<Typography
															variant="h6"
															sx={{
																fontWeight:
																	'bold',
																flex: 1,
															}}
														>
															{device.name}
														</Typography>
														<Tooltip title="Edit name">
															<IconButton
																size="small"
																onClick={() => {
																	handleStartEdit(
																		device.uniqueId,
																		device.name
																	);
																}}
																sx={{
																	opacity: 0.6,
																	'&:hover': {
																		opacity: 1,
																	},
																}}
															>
																<EditIcon fontSize="small" />
															</IconButton>
														</Tooltip>
													</Box>
													<Tooltip
														title={
															device.room
																? 'Change room'
																: 'Assign to room'
														}
													>
														<Box
															onClick={() => {
																handleOpenRoomDialog(
																	device.uniqueId,
																	device.name,
																	device.room
																);
															}}
															sx={{
																display: 'flex',
																alignItems:
																	'center',
																gap: 1,
																px: 2,
																minWidth: 180,
																borderLeft:
																	'1px solid',
																borderColor:
																	'divider',
																backgroundColor:
																	device.room
																		? device.roomColor
																		: 'transparent',
																cursor: 'pointer',
																transition:
																	'filter 0.2s, background-color 0.2s',
																justifyContent:
																	'center',
																'&:hover': {
																	filter: device.room
																		? 'brightness(0.9)'
																		: 'brightness(0.95)',
																	backgroundColor:
																		device.room
																			? device.roomColor
																			: 'action.hover',
																},
															}}
														>
															<Box
																sx={{
																	display:
																		'flex',
																	alignItems:
																		'center',
																}}
															>
																{device.roomIcon ? (
																	getIconComponent(
																		device.roomIcon
																	) || (
																		<RoomIcon />
																	)
																) : (
																	<RoomIcon />
																)}
															</Box>
															{device.room && (
																<Typography
																	variant="body2"
																	sx={{
																		color: '#2f2f2f',
																		fontWeight: 500,
																	}}
																>
																	{
																		device.room
																	}
																</Typography>
															)}
														</Box>
													</Tooltip>
												</>
											)}
										</Box>

										{/* Bottom bar with device info and expand */}
										<CardActionArea
											onClick={() =>
												toggleDeviceExpansion(
													device.uniqueId
												)
											}
											disabled={isEditing}
										>
											<CardContent sx={{ py: 1.5 }}>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														gap: 2,
													}}
												>
													<Typography
														color="text.secondary"
														variant="body2"
														sx={{ flex: 1 }}
													>
														{device.source.emoji}{' '}
														Device ID:{' '}
														{device.uniqueId}
													</Typography>
													{allEmojis && (
														<Typography
															variant="body2"
															sx={{
																fontSize:
																	'1rem',
															}}
														>
															{allEmojis}
														</Typography>
													)}
													<ExpandMoreIcon
														sx={{
															transform:
																isExpanded
																	? 'rotate(180deg)'
																	: 'rotate(0deg)',
															transition:
																'transform 0.2s',
														}}
													/>
												</Box>
											</CardContent>
										</CardActionArea>

										{isExpanded && (
											<CardContent
												sx={{
													pt: 0,
													borderTop: '1px solid',
													borderColor: 'divider',
												}}
											>
												{device.allClusters.length >
													0 && (
													<Box sx={{ mb: 3 }}>
														<Typography
															variant="subtitle1"
															sx={{ mb: 1 }}
														>
															All Device Clusters
														</Typography>
														<Box
															sx={{
																display: 'flex',
																flexWrap:
																	'wrap',
																gap: 1,
															}}
														>
															{device.allClusters.map(
																(
																	cluster,
																	idx
																) => (
																	<Chip
																		key={
																			idx
																		}
																		label={`${cluster.emoji} ${cluster.name}`}
																		size="small"
																		color="primary"
																		variant="outlined"
																	/>
																)
															)}
														</Box>
													</Box>
												)}

												<Accordion>
													<AccordionSummary
														expandIcon={
															<ExpandMoreIcon />
														}
														sx={{
															'& .MuiAccordionSummary-content':
																{
																	alignItems:
																		'center',
																},
														}}
													>
														<Typography variant="subtitle1">
															Endpoint Structure
														</Typography>
														<Chip
															label={`${device.endpoints.length} endpoint${device.endpoints.length !== 1 ? 's' : ''}`}
															size="small"
															sx={{ ml: 2 }}
														/>
													</AccordionSummary>
													<AccordionDetails>
														<EndpointVisualization
															endpoint={device}
															level={0}
															title="Root Device"
														/>
													</AccordionDetails>
												</Accordion>
											</CardContent>
										)}
									</Card>
								);
							})}
							{devices.length === 0 && (
								<Box sx={{ textAlign: 'center', py: 4 }}>
									<Typography color="text.secondary">
										No devices found
									</Typography>
								</Box>
							)}
						</Stack>
					</Box>
				</Grid>

				{/* Right Column - Controls */}
				<Grid size={4}>
					{/* Pairing Section */}
					<Card sx={{ mb: 3 }}>
						<CardContent>
							<Typography variant="h6" gutterBottom>
								Pair New Matter Device
							</Typography>
							<Box
								sx={{
									display: 'flex',
									flexDirection: 'column',
									gap: 2,
								}}
							>
								<TextField
									label="Matter Pairing Code"
									value={pairingCode}
									onChange={(e) =>
										setPairingCode(e.target.value)
									}
									disabled={pairingLoading}
									placeholder="Enter Matter pairing code"
									fullWidth
									size="small"
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											void handlePair();
										}
									}}
								/>
								<Button
									variant="contained"
									onClick={handlePair}
									disabled={
										pairingLoading || !pairingCode.trim()
									}
									fullWidth
								>
									{pairingLoading
										? 'Pairing...'
										: 'Pair Matter Device'}
								</Button>
							</Box>
							{pairingMessage && (
								<Alert
									severity={pairingMessage.type}
									sx={{ mt: 2 }}
								>
									{pairingMessage.text}
								</Alert>
							)}
						</CardContent>
					</Card>
				</Grid>
			</Grid>

			{selectedDevice && (
				<RoomAssignmentDialog
					open={roomDialogOpen}
					onClose={handleCloseRoomDialog}
					deviceId={selectedDevice.id}
					deviceName={selectedDevice.name}
					currentRoom={selectedDevice.room}
					onRoomAssigned={handleRoomAssigned}
				/>
			)}
		</Box>
	);
};
