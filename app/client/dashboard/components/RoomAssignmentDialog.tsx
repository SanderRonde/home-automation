import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	TextField,
	Autocomplete,
	Stack,
	Box,
	Chip,
	Typography,
	IconButton,
} from '@mui/material';
import type { ReturnTypeForApi } from '../../lib/fetch';
import { Edit as EditIcon } from '@mui/icons-material';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import * as Icons from '@mui/icons-material';

interface RoomAssignmentDialogProps {
	open: boolean;
	onClose: () => void;
	deviceId: string;
	deviceName: string;
	currentRoom?: string;
	onRoomAssigned: () => void;
}

type RoomInfo = ReturnTypeForApi<'device', '/rooms', 'GET'>['ok']['rooms'][string];

const COMMON_ROOM_ICONS = [
	{ name: 'Bedroom', icon: 'Bed' },
	{ name: 'Living Room', icon: 'Weekend' },
	{ name: 'Kitchen', icon: 'Kitchen' },
	{ name: 'Bathroom', icon: 'Bathtub' },
	{ name: 'Office', icon: 'Computer' },
	{ name: 'Garage', icon: 'Garage' },
	{ name: 'Garden', icon: 'Yard' },
	{ name: 'Basement', icon: 'Foundation' },
	{ name: 'Attic', icon: 'Roofing' },
	{ name: 'Utility Closet', icon: 'Settings' },
	{ name: 'Toilet', icon: 'Wc' },
] satisfies { name: string; icon: keyof typeof Icons }[];

const ICON_OPTIONS = [
	'Bed',
	'Weekend',
	'Kitchen',
	'Bathtub',
	'Computer',
	'Garage',
	'Yard',
	'Foundation',
	'Roofing',
	'Settings',
	'Wc',
	'Chair',
	'Tv',
	'Lightbulb',
	'DoorFront',
	'Window',
	'Balcony',
	'Pool',
	'FitnessCenter',
	'MeetingRoom',
	'Shower',
	'Deck',
	'Cottage',
] satisfies (keyof typeof Icons)[];

export const RoomAssignmentDialog: React.FC<RoomAssignmentDialogProps> = (props) => {
	const [rooms, setRooms] = useState<Record<string, RoomInfo>>({});
	const [selectedRoom, setSelectedRoom] = useState<string | null>(props.currentRoom || null);
	const [newRoomName, setNewRoomName] = useState('');
	const [selectedIcon, setSelectedIcon] = useState<string>('');
	const [editingIcon, setEditingIcon] = useState(false);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (props.open) {
			void fetchRooms();
			setSelectedRoom(props.currentRoom || null);
			setNewRoomName('');
			setEditingIcon(false);
		}
	}, [props.open, props.currentRoom]);

	const fetchRooms = async () => {
		try {
			const response = await apiGet('device', '/rooms', {});
			if (response.ok) {
				const data = await response.json();
				setRooms(data.rooms);
			}
		} catch (error) {
			console.error('Failed to fetch rooms:', error);
		}
	};

	const handleAssign = async () => {
		setLoading(true);
		try {
			const roomName = selectedRoom || newRoomName.trim();
			if (!roomName) {
				return;
			}

			const response = await apiPost(
				'device',
				'/updateRoom',
				{},
				{
					deviceId: props.deviceId,
					room: roomName,
					icon: selectedIcon || undefined,
				}
			);

			if (response.ok) {
				props.onRoomAssigned();
				props.onClose();
			} else {
				console.error('Failed to assign room');
			}
		} catch (error) {
			console.error('Failed to assign room:', error);
		} finally {
			setLoading(false);
		}
	};

	const handleRemoveRoom = async () => {
		setLoading(true);
		try {
			const response = await apiPost(
				'device',
				'/updateRoom',
				{},
				{
					deviceId: props.deviceId,
					room: undefined,
				}
			);

			if (response.ok) {
				props.onRoomAssigned();
				props.onClose();
			}
		} catch (error) {
			console.error('Failed to remove room:', error);
		} finally {
			setLoading(false);
		}
	};

	const roomOptions = Object.values(rooms).map((room) => room.name);
	const isNewRoom = selectedRoom && !roomOptions.includes(selectedRoom);
	const currentRoomInfo = selectedRoom ? rooms[selectedRoom] : undefined;

	// Set icon when selecting existing room
	useEffect(() => {
		if (currentRoomInfo?.icon && !editingIcon) {
			setSelectedIcon(currentRoomInfo.icon);
		}
	}, [currentRoomInfo, editingIcon]);

	// Suggest icon for new rooms
	useEffect(() => {
		if (newRoomName && !editingIcon) {
			const suggestion = COMMON_ROOM_ICONS.find(
				(r) => r.name.toLowerCase() === newRoomName.toLowerCase()
			);
			if (suggestion) {
				setSelectedIcon(suggestion.icon);
			}
		}
	}, [newRoomName, editingIcon]);

	const getIconComponent = (iconName: string) => {
		const IconComponent = (Icons as Record<string, React.ComponentType>)[iconName];
		return IconComponent ? <IconComponent /> : null;
	};

	const displayRoomName = selectedRoom || newRoomName.trim();

	return (
		<Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
			<DialogTitle>Assign Room for {props.deviceName}</DialogTitle>
			<DialogContent>
				<Stack spacing={3} sx={{ mt: 1 }}>
					<Autocomplete
						freeSolo
						options={roomOptions}
						value={selectedRoom}
						onChange={(_, value) => {
							setSelectedRoom(value);
							setNewRoomName('');
						}}
						onInputChange={(_, value) => {
							if (!roomOptions.includes(value)) {
								setNewRoomName(value);
								setSelectedRoom(null);
							}
						}}
						renderInput={(params) => (
							<TextField
								{...params}
								label="Select or Create Room"
								placeholder="Type to create new room..."
							/>
						)}
						renderOption={(props, option) => {
							const roomInfo = rooms[option];
							return (
								<li {...props}>
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 1,
											width: '100%',
										}}
									>
										{roomInfo?.icon && getIconComponent(roomInfo.icon)}
										<Typography sx={{ flex: 1 }}>{option}</Typography>
										<Chip
											size="small"
											label="Existing"
											sx={{
												backgroundColor: roomInfo?.color,
												color: '#000',
											}}
										/>
									</Box>
								</li>
							);
						}}
					/>

					{(isNewRoom || newRoomName) && (
						<Box>
							<Typography variant="body2" color="text.secondary" gutterBottom>
								Creating new room: <strong>{displayRoomName}</strong>
							</Typography>
						</Box>
					)}

					{displayRoomName && (
						<Box>
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1,
									mb: 1,
								}}
							>
								<Typography variant="subtitle2">Room Icon</Typography>
								{currentRoomInfo && !editingIcon && (
									<IconButton size="small" onClick={() => setEditingIcon(true)}>
										<EditIcon fontSize="small" />
									</IconButton>
								)}
							</Box>
							<Autocomplete
								options={ICON_OPTIONS}
								value={selectedIcon}
								onChange={(_, value) => {
									setSelectedIcon(value || '');
									setEditingIcon(true);
								}}
								renderInput={(params) => (
									<TextField
										{...params}
										label="Icon"
										placeholder="Select an icon..."
										size="small"
									/>
								)}
								renderOption={(props, option) => (
									<li {...props}>
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 1,
											}}
										>
											{getIconComponent(option)}
											<Typography>{option}</Typography>
										</Box>
									</li>
								)}
							/>
							{selectedIcon && (
								<Box sx={{ mt: 2, textAlign: 'center' }}>
									<Typography variant="caption" color="text.secondary">
										Preview
									</Typography>
									<Box
										sx={{
											mt: 1,
											p: 2,
											backgroundColor: 'action.hover',
											borderRadius: 1,
											display: 'inline-block',
										}}
									>
										{getIconComponent(selectedIcon)}
									</Box>
								</Box>
							)}
						</Box>
					)}
				</Stack>
			</DialogContent>
			<DialogActions>
				{props.currentRoom && (
					<Button
						onClick={handleRemoveRoom}
						color="error"
						disabled={loading}
						sx={{ mr: 'auto' }}
					>
						Remove Room
					</Button>
				)}
				<Button onClick={props.onClose} disabled={loading}>
					Cancel
				</Button>
				<Button
					onClick={handleAssign}
					variant="contained"
					disabled={loading || !displayRoomName}
				>
					{loading ? 'Assigning...' : 'Assign'}
				</Button>
			</DialogActions>
		</Dialog>
	);
};
