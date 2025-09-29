import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	List,
	ListItem,
	ListItemText,
	Checkbox,
	TextField,
	Box,
	Typography,
	Chip,
	CircularProgress,
} from '@mui/material';
import type { ReturnTypeForApi } from '../../lib/fetch';
import { apiGet } from '../../lib/fetch';
import React from 'react';

interface DevicePickerProps {
	open: boolean;
	onClose: () => void;
	onConfirm: (selectedDevices: string[]) => void;
	currentSelection: string[];
	title?: string;
}

export const DevicePicker: React.FC<DevicePickerProps> = (props) => {
	const [selectedDevices, setSelectedDevices] = React.useState<string[]>(
		props.currentSelection
	);
	const [searchTerm, setSearchTerm] = React.useState('');
	const [devices, setDevices] = React.useState<
		ReturnTypeForApi<'device', '/list', 'GET'>['ok']['devices']
	>([]);
	const [loading, setLoading] = React.useState(false);

	React.useEffect(() => {
		setSelectedDevices(props.currentSelection);
		if (props.open) {
			void loadDevices();
		}
	}, [props.currentSelection, props.open]);

	const loadDevices = async () => {
		setLoading(true);
		try {
			const response = await apiGet('device', '/list', {});

			if (response.ok) {
				const data = await response.json();
				setDevices(data.devices || []);
			} else {
				console.error('Failed to load devices');
				setDevices([]);
			}
		} catch (error) {
			console.error('Error loading devices:', error);
			setDevices([]);
		} finally {
			setLoading(false);
		}
	};

	const filteredDevices = devices.filter(
		(device) =>
			device.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
			device.name?.toLowerCase().includes(searchTerm.toLowerCase())
	);

	const handleToggleDevice = (deviceId: string) => {
		setSelectedDevices((prev) =>
			prev.includes(deviceId)
				? prev.filter((id) => id !== deviceId)
				: [...prev, deviceId]
		);
	};

	const handleConfirm = () => {
		props.onConfirm(selectedDevices);
		props.onClose();
	};

	const handleRemoveChip = (deviceId: string) => {
		setSelectedDevices((prev) => prev.filter((id) => id !== deviceId));
	};

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			maxWidth="md"
			fullWidth
			PaperProps={{
				sx: {
					bgcolor: 'background.paper',
					minHeight: '60vh',
				},
			}}
		>
			<DialogTitle sx={{ color: 'primary.main' }}>
				{props.title || 'Select Devices'}
			</DialogTitle>
			<DialogContent>
				<Box sx={{ mb: 2 }}>
					<TextField
						fullWidth
						placeholder="Search devices..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						variant="outlined"
						size="small"
						sx={{ mb: 2 }}
					/>

					{selectedDevices.length > 0 && (
						<Box sx={{ mb: 2 }}>
							<Typography variant="subtitle2" sx={{ mb: 1 }}>
								Selected Devices ({selectedDevices.length}):
							</Typography>
							<Box
								sx={{
									display: 'flex',
									flexWrap: 'wrap',
									gap: 1,
								}}
							>
								{selectedDevices.map((deviceId) => (
									<Chip
										key={deviceId}
										label={deviceId}
										onDelete={() =>
											handleRemoveChip(deviceId)
										}
										color="primary"
										variant="outlined"
										size="small"
									/>
								))}
							</Box>
						</Box>
					)}
				</Box>

				<Typography variant="subtitle2" sx={{ mb: 1 }}>
					Available Devices:
				</Typography>
				{loading ? (
					<Box
						sx={{ display: 'flex', justifyContent: 'center', p: 3 }}
					>
						<CircularProgress />
					</Box>
				) : (
					<List
						sx={{
							maxHeight: '300px',
							overflow: 'auto',
							border: '1px solid',
							borderColor: 'divider',
							borderRadius: 1,
						}}
					>
						{filteredDevices.length === 0 ? (
							<ListItem>
								<ListItemText
									primary="No devices found"
									secondary={
										searchTerm
											? 'Try adjusting your search term'
											: 'No devices available'
									}
								/>
							</ListItem>
						) : (
							filteredDevices.map((device) => (
								<ListItem
									key={device.id}
									component="button"
									onClick={() =>
										handleToggleDevice(device.id)
									}
									sx={{
										'&:hover': {
											bgcolor: 'action.hover',
										},
										opacity:
											device.status === 'offline'
												? 0.6
												: 1,
									}}
								>
									<Checkbox
										checked={selectedDevices.includes(
											device.id
										)}
										onChange={() =>
											handleToggleDevice(device.id)
										}
										color="primary"
									/>
									<ListItemText
										primary={
											<Box
												sx={{
													display: 'flex',
													alignItems: 'center',
													gap: 1,
												}}
											>
												<Typography
													sx={{
														fontFamily: 'monospace',
														fontSize: '0.9rem',
													}}
												>
													{device.name || device.id}
												</Typography>
												<Chip
													label={device.status}
													size="small"
													color={
														device.status ===
														'online'
															? 'success'
															: 'default'
													}
													variant="outlined"
													sx={{
														fontSize: '0.7rem',
														height: '20px',
													}}
												/>
											</Box>
										}
										secondary={
											device.name ? (
												<Typography
													sx={{
														fontFamily: 'monospace',
														fontSize: '0.8rem',
														color: 'text.secondary',
													}}
												>
													{device.id}
												</Typography>
											) : undefined
										}
									/>
								</ListItem>
							))
						)}
					</List>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={props.onClose} color="inherit">
					Cancel
				</Button>
				<Button
					onClick={handleConfirm}
					variant="contained"
					color="primary"
					disabled={selectedDevices.length === 0}
				>
					Confirm ({selectedDevices.length} selected)
				</Button>
			</DialogActions>
		</Dialog>
	);
};
