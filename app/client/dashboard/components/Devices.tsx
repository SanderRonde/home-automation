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
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	useMediaQuery,
	useTheme,
} from '@mui/material';
import {
	RoomPreferences as RoomIcon,
	Edit as EditIcon,
	Check as CheckIcon,
	Close as CloseIcon,
	Battery90 as BatteryIcon,
	CloudOff as CloudOffIcon,
	Delete as DeleteIcon,
	QrCode as QrCodeIcon,
} from '@mui/icons-material';
import type {
	DeviceListWithValuesResponse,
	DeviceWebsocketClientMessage,
	DeviceWebsocketServerMessage,
} from '../../../server/modules/device/routing';
import type {
	DashboardWebsocketClientMessage,
	DashboardWebsocketServerMessage,
} from '../../../server/modules/dashboard/routing';
import { RoomAssignmentDialog } from './RoomAssignmentDialog';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import useWebsocket from '../../shared/resilient-socket';
import { fadeInUpStaggered } from '../../lib/animations';
import { apiPost, apiDelete } from '../../lib/fetch';
import { QrScanner } from './QrScanner';
import React, { useState } from 'react';
import { IconComponent } from './icon';

interface EndpointVisualizationProps {
	endpoint: DeviceListWithValuesResponse[number]['endpoints'][number];
	level: number;
	title?: string;
}

const EndpointVisualization = React.memo<EndpointVisualizationProps>((props) => {
	const hasContent =
		props.endpoint.childClusters.length > 0 || props.endpoint.endpoints.length > 0;

	if (!hasContent) {
		return null;
	}

	return (
		<Box sx={{ ml: props.level * 2, mt: props.level > 0 ? 1 : 0 }}>
			{props.title && (
				<Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
					{props.title}
				</Typography>
			)}

			{props.endpoint.childClusters.length > 0 && (
				<Box sx={{ mb: 2 }}>
					<Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
						Clusters:
					</Typography>
					<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
						{props.endpoint.childClusters.map((cluster, idx) => (
							<Chip
								key={idx}
								icon={
									cluster.icon ? (
										<IconComponent iconName={cluster.icon} />
									) : undefined
								}
								label={cluster.name}
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
								title={subEndpoint.name}
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
});
EndpointVisualization.displayName = 'EndpointVisualization';

interface DeviceCardProps {
	device: DeviceListWithValuesResponse[number];
	isExpanded: boolean;
	editedName: string | undefined;
	onToggleExpansion: (deviceId: string) => void;
	onStartEdit: (deviceId: string, currentName: string) => void;
	onSaveEdit: (deviceId: string) => void;
	onCancelEdit: () => void;
	onEditedNameChange: (name: string) => void;
	onOpenRoomDialog: (deviceId: string, deviceName: string, room?: string) => void;
	onDeleteDevice?: (deviceId: string) => void;
	isMobile: boolean;
	animationIndex?: number;
}

const DeviceCard = React.memo<DeviceCardProps>((props) => {
	// Helper to get battery percentage from all device clusters (including nested endpoints)
	const getBatteryPercentage = (): number | undefined => {
		const findBatteryInClusters = (
			clusters: typeof props.device.mergedAllClusters
		): number | undefined => {
			for (const cluster of clusters) {
				// Type guard to check if this is a power source cluster with battery percentage
				if ('batteryPercentage' in cluster && cluster.batteryPercentage !== undefined) {
					return cluster.batteryPercentage;
				}
			}
			return undefined;
		};

		// Check root device clusters
		const rootBattery = findBatteryInClusters(props.device.mergedAllClusters);
		if (rootBattery !== undefined) {
			return rootBattery;
		}

		// Check endpoint clusters
		for (const endpoint of props.device.endpoints) {
			const endpointBattery = findBatteryInClusters(endpoint.mergedAllClusters);
			if (endpointBattery !== undefined) {
				return endpointBattery;
			}
		}

		return undefined;
	};

	const batteryPercentage = getBatteryPercentage();

	return (
		<Card
			key={props.device.uniqueId}
			elevation={1}
			sx={props.animationIndex !== undefined ? fadeInUpStaggered(props.animationIndex) : {}}
		>
			{/* Header with name, edit controls, and room */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'stretch',
					borderBottom: '1px solid',
					borderColor: 'divider',
				}}
			>
				{props.editedName !== undefined && !props.isMobile ? (
					/* Inline edit for desktop */
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
							value={props.editedName}
							onChange={(e) => props.onEditedNameChange(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									void props.onSaveEdit(props.device.uniqueId);
								} else if (e.key === 'Escape') {
									props.onCancelEdit();
								}
							}}
							size="small"
							autoFocus
							sx={{ flex: 1 }}
						/>
						<IconButton
							size="small"
							onClick={() => {
								void props.onSaveEdit(props.device.uniqueId);
							}}
							color="primary"
						>
							<CheckIcon fontSize="small" />
						</IconButton>
						<IconButton size="small" onClick={props.onCancelEdit}>
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
								alignItems: 'center',
								gap: 1,
								flexGrow: 1,
								minWidth: 0, // Allow shrinking
							}}
						>
							<Typography
								variant="h6"
								sx={{
									fontWeight: 'bold',
									flex: 1,
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap',
									fontSize: {
										xs: '1rem',
										sm: '1.25rem',
									},
								}}
							>
								{props.device.name}
							</Typography>
							{batteryPercentage !== undefined && (
								<Tooltip title={`Battery: ${Math.round(batteryPercentage * 100)}%`}>
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 0.5,
											px: 1,
											py: 0.5,
											borderRadius: 1,
											backgroundColor: 'action.hover',
											flexShrink: 0,
										}}
									>
										<BatteryIcon
											sx={{
												fontSize: '1.2rem',
												color:
													batteryPercentage > 0.2
														? 'success.main'
														: batteryPercentage > 0.1
															? 'warning.main'
															: 'error.main',
											}}
										/>
										<Typography
											variant="body2"
											sx={{
												fontWeight: 500,
												color: 'text.secondary',
											}}
										>
											{Math.round(batteryPercentage * 100)}%
										</Typography>
									</Box>
								</Tooltip>
							)}
							{props.device.status === 'offline' && (
								<Tooltip title="Device is offline">
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 0.5,
											px: 1,
											py: 0.5,
											borderRadius: 1,
											backgroundColor: 'action.hover',
											flexShrink: 0,
											opacity: 0.7,
										}}
									>
										<CloudOffIcon
											sx={{
												fontSize: '1.2rem',
												color: 'text.secondary',
											}}
										/>
									</Box>
								</Tooltip>
							)}
							<Tooltip title="Edit name">
								<IconButton
									size="small"
									onClick={() => {
										props.onStartEdit(props.device.uniqueId, props.device.name);
									}}
									sx={{
										opacity: 0.6,
										flexShrink: 0,
										'&:hover': {
											opacity: 1,
										},
									}}
								>
									<EditIcon fontSize="small" />
								</IconButton>
							</Tooltip>
							{props.device.status === 'offline' && (
								<Tooltip title="Delete offline device">
									<IconButton
										size="small"
										onClick={(e) => {
											e.stopPropagation();
											props.onDeleteDevice?.(props.device.uniqueId);
										}}
										sx={{
											opacity: 0.6,
											flexShrink: 0,
											color: 'error.main',
											'&:hover': {
												opacity: 1,
												backgroundColor: 'error.light',
											},
										}}
									>
										<DeleteIcon fontSize="small" />
									</IconButton>
								</Tooltip>
							)}
						</Box>
						<Tooltip title={props.device.room ? 'Change room' : 'Assign to room'}>
							<Box
								onClick={() => {
									props.onOpenRoomDialog(
										props.device.uniqueId,
										props.device.name,
										props.device.room
									);
								}}
								sx={{
									display: {
										xs: 'none',
										sm: 'flex',
									},
									alignItems: 'center',
									gap: 1,
									px: 2,
									minWidth: 180,
									borderLeft: '1px solid',
									borderColor: 'divider',
									backgroundColor: props.device.room
										? props.device.roomColor
										: 'transparent',
									cursor: 'pointer',
									transition: 'filter 0.2s, background-color 0.2s',
									justifyContent: 'center',
									'&:hover': {
										filter: props.device.room
											? 'brightness(0.9)'
											: 'brightness(0.95)',
										backgroundColor: props.device.room
											? props.device.roomColor
											: 'action.hover',
									},
								}}
							>
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
									}}
								>
									{props.device.roomIcon ? (
										<IconComponent
											sx={{ fill: '#2f2f2f' }}
											iconName={props.device.roomIcon}
										/>
									) : (
										<RoomIcon />
									)}
								</Box>
								{props.device.room && (
									<Typography
										variant="body2"
										sx={{
											color: '#2f2f2f',
											fontWeight: 500,
										}}
									>
										{props.device.room}
									</Typography>
								)}
							</Box>
						</Tooltip>
						{props.editedName !== undefined && props.isMobile ? (
							/* Edit dialog for mobile */
							<Dialog
								open={props.editedName !== undefined}
								onClose={props.onCancelEdit}
								maxWidth="sm"
								fullWidth
							>
								<DialogTitle>Edit Device Name</DialogTitle>
								<DialogContent>
									<TextField
										value={props.editedName}
										onChange={(e) => props.onEditedNameChange(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter') {
												void props.onSaveEdit(props.device.uniqueId);
											} else if (e.key === 'Escape') {
												props.onCancelEdit();
											}
										}}
										fullWidth
										autoFocus
										label="Device Name"
										margin="normal"
									/>
								</DialogContent>
								<DialogActions>
									<Button onClick={props.onCancelEdit}>Cancel</Button>
									<Button
										onClick={() => {
											void props.onSaveEdit(props.device.uniqueId);
										}}
										variant="contained"
									>
										Save
									</Button>
								</DialogActions>
							</Dialog>
						) : null}
					</>
				)}
			</Box>

			{props.device.room && (
				<Box
					onClick={() => {
						props.onOpenRoomDialog(
							props.device.uniqueId,
							props.device.name,
							props.device.room
						);
					}}
					sx={{
						display: {
							xs: 'flex',
							sm: 'none',
						},
						alignItems: 'center',
						gap: 1,
						width: '100%',
						px: 2,
						py: 1,
						backgroundColor: props.device.roomColor,
					}}
				>
					{props.device.roomIcon && (
						<IconComponent sx={{ fill: '#2f2f2f' }} iconName={props.device.roomIcon} />
					)}
					<Typography variant="body2" sx={{ color: '#2f2f2f', fontWeight: 500 }}>
						{props.device.room}
					</Typography>
				</Box>
			)}

			{/* Bottom bar with device info and expand */}
			<CardActionArea
				onClick={() => props.onToggleExpansion(props.device.uniqueId)}
				disabled={props.editedName !== undefined}
			>
				<CardContent sx={{ px: 0, pt: 1.5 }}>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 2,
							px: 2,
						}}
					>
						<Typography
							color="text.secondary"
							variant="body2"
							sx={{
								flex: 1,
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								fontSize: {
									xs: '0.75rem',
									sm: '0.875rem',
								},
							}}
						>
							{props.device.source.emoji}{' '}
							<Box
								component="span"
								sx={{
									display: {
										xs: 'none',
										md: 'inline',
									},
								}}
							>
								Device ID:{' '}
							</Box>
							{props.device.uniqueId.slice(0, 15)}...
						</Typography>
						<Typography
							variant="body2"
							sx={{
								fontSize: {
									xs: '0.875rem',
									sm: '1rem',
								},
								flexShrink: 0,
							}}
						>
							{props.device.mergedAllClusters
								.filter((cluster) => cluster.icon)
								.map((cluster, idx) => (
									<Box
										key={`${cluster.name}-${idx}`}
										component="span"
										sx={{ mr: 0.5 }}
									>
										{cluster.icon ? (
											<IconComponent iconName={cluster.icon} />
										) : null}
									</Box>
								))}
						</Typography>
						<ExpandMoreIcon
							sx={{
								transform: props.isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
								transition: 'transform 0.2s',
								flexShrink: 0,
							}}
						/>
					</Box>
				</CardContent>
			</CardActionArea>

			{props.isExpanded && (
				<CardContent
					sx={{
						pt: 0,
						borderTop: '1px solid',
						borderColor: 'divider',
					}}
				>
					{props.device.mergedAllClusters.length > 0 && (
						<Box sx={{ mb: 3 }}>
							<Typography variant="subtitle1" sx={{ pt: 2 }}>
								Device ID
							</Typography>
							<Typography variant="body2" sx={{ mb: 1, pt: 2 }}>
								{props.device.source.emoji} {props.device.uniqueId}
							</Typography>
							<Typography variant="subtitle1" sx={{ mb: 1, pt: 2 }}>
								All Device Clusters
							</Typography>
							<Box
								sx={{
									display: 'flex',
									flexWrap: 'wrap',
									gap: 1,
								}}
							>
								{props.device.mergedAllClusters.map((cluster, idx) => (
									<Chip
										key={idx}
										icon={
											cluster.icon ? (
												<IconComponent iconName={cluster.icon} />
											) : undefined
										}
										label={cluster.name}
										size="small"
										color="primary"
										variant="outlined"
									/>
								))}
							</Box>
						</Box>
					)}

					<Accordion>
						<AccordionSummary
							expandIcon={<ExpandMoreIcon />}
							sx={{
								'& .MuiAccordionSummary-content': {
									alignItems: 'center',
								},
							}}
						>
							<Typography variant="subtitle1">Endpoint Structure</Typography>
							<Chip
								label={`${props.device.endpoints.length} endpoint${props.device.endpoints.length !== 1 ? 's' : ''}`}
								size="small"
								sx={{ ml: 2 }}
							/>
						</AccordionSummary>
						<AccordionDetails>
							<EndpointVisualization
								endpoint={props.device}
								level={0}
								title="Root Device"
							/>
						</AccordionDetails>
					</Accordion>
				</CardContent>
			)}
		</Card>
	);
});
DeviceCard.displayName = 'DeviceCard';

export const Devices: React.FC = () => {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

	const [pairingCode, setPairingCode] = useState('');
	const [pairingLoading, setPairingLoading] = useState(false);
	const [pairingMessage, setPairingMessage] = useState<{
		type: 'success' | 'error';
		text: string;
	} | null>(null);
	const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());
	const [roomDialogFor, setRoomDialogFor] = useState<{
		id: string;
		name: string;
		room?: string;
	} | null>(null);
	const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
	const [editedName, setEditedName] = useState('');
	const [isDiscovering, setIsDiscovering] = useState(false);
	const [discoveries, setDiscoveries] = useState<
		{ id: string; discriminator: number; discoveredAt: Date }[]
	>([]);
	const [deleteConfirmDevice, setDeleteConfirmDevice] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [qrScannerOpen, setQrScannerOpen] = useState(false);
	const [hasCamera, setHasCamera] = useState<boolean | null>(null);

	const { devices, loading, refresh } = useDevices();

	const { sendMessage } = useWebsocket<
		DashboardWebsocketServerMessage,
		DashboardWebsocketClientMessage
	>('/dashboard/ws', {
		onMessage: (message) => {
			if (message.type === 'startDiscovery') {
				setIsDiscovering(true);
			}
			if (message.type === 'endDiscovery') {
				setIsDiscovering(false);
			}
			if (message.type === 'commissionableDevices') {
				setDiscoveries((prev) => {
					// Check if device already exists to avoid duplicates
					const exists = prev.some((d) => d.id === message.device.id);
					if (exists) {
						return prev;
					}
					return [
						...prev,
						{
							id: message.device.id,
							discriminator: message.device.discriminator,
							discoveredAt: new Date(),
						},
					];
				});
			}
		},
	});

	const handleStartDiscovery = React.useCallback(() => {
		sendMessage({ type: 'startDiscovery' });
	}, [sendMessage]);

	React.useEffect(() => {
		handleStartDiscovery();
	}, [handleStartDiscovery]);

	// Check camera availability
	React.useEffect(() => {
		const checkCamera = async () => {
			if (!navigator.mediaDevices?.getUserMedia) {
				setHasCamera(false);
				return;
			}

			try {
				const devices = await navigator.mediaDevices.enumerateDevices();
				const videoDevices = devices.filter((device) => device.kind === 'videoinput');
				setHasCamera(videoDevices.length > 0);
			} catch (err) {
				console.error('Error checking camera:', err);
				setHasCamera(false);
			}
		};

		void checkCamera();
	}, []);

	const pairDevice = React.useCallback(
		async (code: string) => {
			if (!code.trim()) {
				return;
			}

			setPairingLoading(true);
			setPairingMessage(null);

			try {
				const response = await apiPost('dashboard', '/pair/:code', {
					code,
				});

				if (!response.ok) {
					throw new Error(`Failed to pair device: ${await response.text()}`);
				}

				const pairedDevices = await response.json();
				setPairingMessage({
					type: 'success',
					text: `Device pairing initiated successfully. ${pairedDevices} device${pairedDevices !== 1 ? 's' : ''} paired.`,
				});
				setPairingCode('');

				// Refresh the device list immediately and clear message after delay
				refresh(true);
				setTimeout(() => setPairingMessage(null), 3000);
			} catch (error) {
				console.error('Failed to pair Matter device:', error);
				setPairingMessage({
					type: 'error',
					text: error instanceof Error ? error.message : 'Failed to pair device',
				});

				// Clear error message after delay
				setTimeout(() => setPairingMessage(null), 5000);
			} finally {
				setPairingLoading(false);
			}
		},
		[refresh]
	);

	const handlePair = React.useCallback(async () => {
		await pairDevice(pairingCode);
	}, [pairingCode, pairDevice]);

	const handleQrScan = React.useCallback(
		(qrCode: string) => {
			setPairingCode(qrCode);
			setQrScannerOpen(false);
			// Small delay to ensure state update is visible before pairing
			setTimeout(() => {
				void pairDevice(qrCode);
			}, 100);
		},
		[pairDevice]
	);

	const toggleDeviceExpansion = React.useCallback((deviceId: string) => {
		setExpandedDevices((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(deviceId)) {
				newSet.delete(deviceId);
			} else {
				newSet.add(deviceId);
			}
			return newSet;
		});
	}, []);

	const handleOpenRoomDialog = React.useCallback(
		(deviceId: string, deviceName: string, room?: string) =>
			setRoomDialogFor({ id: deviceId, name: deviceName, room }),
		[]
	);

	const handleCloseRoomDialog = React.useCallback(() => {
		setRoomDialogFor(null);
	}, []);

	const handleRoomAssigned = React.useCallback(() => {
		void refresh();
	}, [refresh]);

	const handleStartEdit = React.useCallback((deviceId: string, currentName: string) => {
		setEditingDeviceId(deviceId);
		setEditedName(currentName);
	}, []);

	const handleCancelEdit = React.useCallback(() => {
		setEditingDeviceId(null);
		setEditedName('');
	}, []);

	const editedNameRef = React.useRef<string | undefined>(undefined);
	editedNameRef.current = editedName;

	const handleSaveEdit = React.useCallback(
		async (deviceId: string) => {
			const editedName = editedNameRef.current;
			if (
				!editedName?.trim() ||
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
					refresh();
					handleCancelEdit();
				} else {
					console.error('Failed to update device name');
				}
			} catch (error) {
				console.error('Failed to update device name:', error);
			}
		},
		[devices, handleCancelEdit, refresh]
	);

	const handleDeleteDevice = React.useCallback(
		(deviceId: string) => {
			const device = devices.find((d) => d.uniqueId === deviceId);
			if (device) {
				setDeleteConfirmDevice({ id: deviceId, name: device.name });
			}
		},
		[devices]
	);

	const handleConfirmDelete = React.useCallback(async () => {
		if (!deleteConfirmDevice) {
			return;
		}

		try {
			const response = await apiDelete('device', '/device/:deviceId/delete', {
				deviceId: deleteConfirmDevice.id,
			});

			if (response.ok) {
				refresh();
				setDeleteConfirmDevice(null);
			} else {
				const error = (await response.json()) as { error?: string };
				console.error('Failed to delete device:', error);
				alert(`Failed to delete device: ${error.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('Failed to delete device:', error);
			alert('Failed to delete device. Please try again.');
		}
	}, [deleteConfirmDevice, refresh]);

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
			<Grid container spacing={{ xs: 2, md: 3 }}>
				{/* Left Column - Devices List (on mobile, shown first) */}
				<Grid size={{ xs: 12, md: 8 }} sx={{ order: { xs: 1, md: 1 } }}>
					<Box
						sx={{
							maxHeight: '100%',
							overflow: 'auto',
							pr: { xs: 0, sm: 1 },
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
							{loading && (
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
							{devices.map((device, index) => (
								<DeviceCard
									key={device.uniqueId}
									device={device}
									isExpanded={expandedDevices.has(device.uniqueId)}
									editedName={
										editingDeviceId === device.uniqueId ? editedName : undefined
									}
									onToggleExpansion={toggleDeviceExpansion}
									onStartEdit={handleStartEdit}
									onSaveEdit={handleSaveEdit}
									onCancelEdit={handleCancelEdit}
									animationIndex={index}
									onEditedNameChange={setEditedName}
									onOpenRoomDialog={handleOpenRoomDialog}
									onDeleteDevice={handleDeleteDevice}
									isMobile={isMobile}
								/>
							))}
							{devices.length === 0 && (
								<Box sx={{ textAlign: 'center', py: 4 }}>
									<Typography color="text.secondary">No devices found</Typography>
								</Box>
							)}
						</Stack>
					</Box>
				</Grid>

				{/* Right Column - Controls (on mobile, shown at bottom) */}
				<Grid size={{ xs: 12, md: 4 }} sx={{ order: { xs: 2, md: 2 } }}>
					<Stack spacing={3}>
						{/* Pairing Section */}
						<Card>
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
										onChange={(e) => setPairingCode(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter' && !pairingLoading) {
												void handlePair();
											}
										}}
										placeholder="MT:Y.K9519960000"
										fullWidth
										disabled={pairingLoading}
										size="small"
									/>
									{hasCamera === true && (
										<Button
											variant="outlined"
											onClick={() => setQrScannerOpen(true)}
											disabled={pairingLoading}
											startIcon={<QrCodeIcon />}
											fullWidth
										>
											Scan QR Code
										</Button>
									)}
									<Button
										variant="contained"
										onClick={handlePair}
										disabled={pairingLoading || !pairingCode.trim()}
										fullWidth
									>
										{pairingLoading ? (
											<CircularProgress size={24} color="inherit" />
										) : (
											'Pair Device'
										)}
									</Button>
									{pairingMessage && (
										<Alert severity={pairingMessage.type}>
											{pairingMessage.text}
										</Alert>
									)}
								</Box>
							</CardContent>
						</Card>

						{/* Discovering Devices Section */}
						<Card>
							<CardContent>
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between',
										mb: 2,
									}}
								>
									<Typography variant="h6">Discovering Devices</Typography>
									{isDiscovering && <CircularProgress size={20} />}
								</Box>
								{isDiscovering ? (
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 1,
											py: 2,
										}}
									>
										<CircularProgress size={16} />
										<Typography variant="body2" color="text.secondary">
											Scanning for Matter devices...
										</Typography>
									</Box>
								) : discoveries.length === 0 ? (
									<Box sx={{ py: 2 }}>
										<Typography
											variant="body2"
											color="text.secondary"
											sx={{ mb: 2 }}
										>
											No devices discovered yet. Start discovery to scan for
											commissionable Matter devices.
										</Typography>
										<Button
											variant="outlined"
											onClick={handleStartDiscovery}
											fullWidth
										>
											Start Discovery
										</Button>
									</Box>
								) : (
									<Box>
										<Box
											sx={{
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
												mb: 2,
											}}
										>
											<Typography variant="body2" color="text.secondary">
												{discoveries.length} device
												{discoveries.length !== 1 ? 's' : ''} discovered
											</Typography>
											<Button
												variant="outlined"
												size="small"
												onClick={handleStartDiscovery}
											>
												Restart Discovery
											</Button>
										</Box>
										<Stack spacing={1.5}>
											{discoveries.map((device) => (
												<Box
													key={device.id}
													sx={{
														p: 1.5,
														border: '1px solid',
														borderColor: 'divider',
														borderRadius: 1,
														display: 'flex',
														justifyContent: 'space-between',
														alignItems: 'center',
													}}
												>
													<Box>
														<Typography
															variant="body2"
															sx={{ fontWeight: 500 }}
														>
															Device ID: {device.id.slice(0, 15)}...
														</Typography>
														<Typography
															variant="caption"
															color="text.secondary"
														>
															Discriminator: {device.discriminator}
														</Typography>
														<Typography
															variant="caption"
															color="text.secondary"
															sx={{ display: 'block', mt: 0.5 }}
														>
															Discovered:{' '}
															{device.discoveredAt.toLocaleTimeString()}
														</Typography>
													</Box>
													<Button
														variant="contained"
														size="small"
														onClick={() => {
															// TODO: Implement pairing handler
														}}
													>
														Pair
													</Button>
												</Box>
											))}
										</Stack>
									</Box>
								)}
							</CardContent>
						</Card>

						{/* eWeLink Integration */}
						<Card>
							<CardContent>
								<Typography variant="h6" gutterBottom>
									eWeLink Integration
								</Typography>
								<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
									Connect your eWeLink smart devices through OAuth authentication.
								</Typography>
								<Button
									variant="outlined"
									fullWidth
									onClick={() => {
										window.location.hash = 'ewelink';
									}}
								>
									Configure eWeLink
								</Button>
							</CardContent>
						</Card>
					</Stack>
				</Grid>
			</Grid>

			{roomDialogFor && (
				<RoomAssignmentDialog
					open
					onClose={handleCloseRoomDialog}
					deviceId={roomDialogFor.id}
					deviceName={roomDialogFor.name}
					currentRoom={roomDialogFor.room}
					onRoomAssigned={handleRoomAssigned}
				/>
			)}

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={deleteConfirmDevice !== null}
				onClose={() => setDeleteConfirmDevice(null)}
			>
				<DialogTitle>Delete Offline Device</DialogTitle>
				<DialogContent>
					<Typography>
						Are you sure you want to delete the offline device "
						{deleteConfirmDevice?.name}"? This action cannot be undone.
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setDeleteConfirmDevice(null)}>Cancel</Button>
					<Button onClick={handleConfirmDelete} color="error" variant="contained">
						Delete
					</Button>
				</DialogActions>
			</Dialog>

			{/* QR Scanner Dialog */}
			<QrScanner
				open={qrScannerOpen}
				onClose={() => setQrScannerOpen(false)}
				onScan={handleQrScan}
			/>
		</Box>
	);
};

export function useDevices(): {
	open: boolean;
	refresh: (showSpinner?: boolean) => void;
	devices: DeviceListWithValuesResponse;
	loading: boolean;
} {
	const [devices, setDevices] = useState<DeviceListWithValuesResponse>([]);
	const [loading, setLoading] = useState(false);

	const { sendMessage, open } = useWebsocket<
		DeviceWebsocketServerMessage,
		DeviceWebsocketClientMessage
	>('/device/ws', {
		onMessage: (message) => {
			if (message.type === 'devices') {
				// Sort devices first by source, then alphabetically by name
				const sortedDevices = message.devices.sort((a, b) => {
					if (a.source.name !== b.source.name) {
						return a.source.name.localeCompare(b.source.name);
					}
					return a.name.localeCompare(b.name);
				});
				setDevices(sortedDevices);
				setLoading(false);
			}
		},
	});

	return {
		open,
		refresh: React.useCallback(
			(showSpinner = false) => {
				if (showSpinner) {
					setLoading(true);
				}
				sendMessage({ type: 'refreshDevices' });
			},
			[sendMessage]
		),
		devices,
		loading,
	};
}
