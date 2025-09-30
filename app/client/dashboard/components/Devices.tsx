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

type DeviceType = ReturnTypeForApi<
	'dashboard',
	'/getDevices',
	'GET'
>['ok']['devices'][number];

interface DeviceCardProps {
	device: DeviceType;
	isExpanded: boolean;
	isEditing: boolean;
	editedName: string;
	onToggleExpansion: (deviceId: string) => void;
	onStartEdit: (deviceId: string, currentName: string) => void;
	onSaveEdit: (deviceId: string) => void;
	onCancelEdit: () => void;
	onEditedNameChange: (name: string) => void;
	onOpenRoomDialog: (
		deviceId: string,
		deviceName: string,
		room?: string
	) => void;
	isMobile: boolean;
}

const DeviceCard: React.FC<DeviceCardProps> = (props) => {
	const allEmojis = props.device.allClusters.map((c) => c.emoji).join(' ');

	const getIconComponent = (iconName: string) => {
		const IconComponent = (
			Icons as Record<string, React.ComponentType<{ sx?: SxProps }>>
		)[iconName];
		return IconComponent ? (
			<IconComponent sx={{ fill: '#2f2f2f' }} />
		) : null;
	};

	return (
		<Card key={props.device.uniqueId} elevation={1}>
			{/* Header with name, edit controls, and room */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'stretch',
					borderBottom: '1px solid',
					borderColor: 'divider',
				}}
			>
				{props.isEditing && !props.isMobile ? (
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
							onChange={(e) =>
								props.onEditedNameChange(e.target.value)
							}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									void props.onSaveEdit(
										props.device.uniqueId
									);
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
							<Tooltip title="Edit name">
								<IconButton
									size="small"
									onClick={() => {
										props.onStartEdit(
											props.device.uniqueId,
											props.device.name
										);
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
						</Box>
						<Tooltip
							title={
								props.device.room
									? 'Change room'
									: 'Assign to room'
							}
						>
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
									transition:
										'filter 0.2s, background-color 0.2s',
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
										getIconComponent(
											props.device.roomIcon
										) || <RoomIcon />
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
						{props.isEditing && props.isMobile ? (
							/* Edit dialog for mobile */
							<Dialog
								open={props.isEditing}
								onClose={props.onCancelEdit}
								maxWidth="sm"
								fullWidth
							>
								<DialogTitle>Edit Device Name</DialogTitle>
								<DialogContent>
									<TextField
										value={props.editedName}
										onChange={(e) =>
											props.onEditedNameChange(
												e.target.value
											)
										}
										onKeyDown={(e) => {
											if (e.key === 'Enter') {
												void props.onSaveEdit(
													props.device.uniqueId
												);
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
									<Button onClick={props.onCancelEdit}>
										Cancel
									</Button>
									<Button
										onClick={() => {
											void props.onSaveEdit(
												props.device.uniqueId
											);
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
					{props.device.roomIcon &&
						getIconComponent(props.device.roomIcon)}
					<Typography
						variant="body2"
						sx={{
							color: '#2f2f2f',
							fontWeight: 500,
						}}
					>
						{props.device.room}
					</Typography>
				</Box>
			)}

			{/* Bottom bar with device info and expand */}
			<CardActionArea
				onClick={() => props.onToggleExpansion(props.device.uniqueId)}
				disabled={props.isEditing}
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
						{allEmojis && (
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
								{allEmojis}
							</Typography>
						)}
						<ExpandMoreIcon
							sx={{
								transform: props.isExpanded
									? 'rotate(180deg)'
									: 'rotate(0deg)',
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
					{props.device.allClusters.length > 0 && (
						<Box sx={{ mb: 3 }}>
							<Typography variant="subtitle1" sx={{ pt: 2 }}>
								Device ID
							</Typography>
							<Typography variant="body2" sx={{ mb: 1, pt: 2 }}>
								{props.device.source.emoji}{' '}
								{props.device.uniqueId}
							</Typography>
							<Typography
								variant="subtitle1"
								sx={{ mb: 1, pt: 2 }}
							>
								All Device Clusters
							</Typography>
							<Box
								sx={{
									display: 'flex',
									flexWrap: 'wrap',
									gap: 1,
								}}
							>
								{props.device.allClusters.map(
									(cluster, idx) => (
										<Chip
											key={idx}
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
							expandIcon={<ExpandMoreIcon />}
							sx={{
								'& .MuiAccordionSummary-content': {
									alignItems: 'center',
								},
							}}
						>
							<Typography variant="subtitle1">
								Endpoint Structure
							</Typography>
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
};

export const Devices: React.FC = () => {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
	const [roomDialogFor, setRoomDialogFor] = useState<{
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
		setRoomDialogFor({ id: deviceId, name: deviceName, room });
	};

	const handleCloseRoomDialog = () => {
		setRoomDialogFor(null);
	};

	const handleRoomAssigned = () => {
		void fetchDevices();
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
			<Typography
				variant="h4"
				sx={{
					color: 'primary.main',
					fontWeight: 300,
					letterSpacing: '0.2rem',
					mb: 3,
				}}
			>
				Devices
			</Typography>

			<Grid container spacing={{ xs: 2, md: 3 }}>
				{/* Right Column - Controls (on mobile, shown first) */}
				<Grid size={{ xs: 12, md: 4 }} sx={{ order: { xs: 1, md: 2 } }}>
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
									onKeyDown={(e) => {
										if (
											e.key === 'Enter' &&
											!pairingLoading
										) {
											void handlePair();
										}
									}}
									placeholder="MT:Y.K9519960000"
									fullWidth
									disabled={pairingLoading}
									size="small"
								/>
								<Button
									variant="contained"
									onClick={handlePair}
									disabled={
										pairingLoading || !pairingCode.trim()
									}
									fullWidth
								>
									{pairingLoading ? (
										<CircularProgress
											size={24}
											color="inherit"
										/>
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
				</Grid>

				{/* Left Column - Devices List */}
				<Grid size={{ xs: 12, md: 8 }} sx={{ order: { xs: 2, md: 1 } }}>
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
							{devices.map((device) => (
								<DeviceCard
									key={device.uniqueId}
									device={device}
									isExpanded={expandedDevices.has(
										device.uniqueId
									)}
									isEditing={
										editingDeviceId === device.uniqueId
									}
									editedName={editedName}
									onToggleExpansion={toggleDeviceExpansion}
									onStartEdit={handleStartEdit}
									onSaveEdit={handleSaveEdit}
									onCancelEdit={handleCancelEdit}
									onEditedNameChange={setEditedName}
									onOpenRoomDialog={handleOpenRoomDialog}
									isMobile={isMobile}
								/>
							))}
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
		</Box>
	);
};
