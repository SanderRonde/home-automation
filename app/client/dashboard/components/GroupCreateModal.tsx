import {
	Box,
	Button,
	Checkbox,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControlLabel,
	TextField,
	Typography,
} from '@mui/material';
import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import type { DeviceGroup } from '../../../../types/group';
import React, { useState, useEffect } from 'react';

interface GroupCreateModalProps {
	open: boolean;
	onClose: () => void;
	onSave: (group: Omit<DeviceGroup, 'id'>) => Promise<void>;
	group?: DeviceGroup;
	devices: DeviceListWithValuesResponse;
}

interface GroupDeviceItemProps {
	device: DeviceListWithValuesResponse[number];
	isChecked: boolean;
	onToggle: (deviceId: string) => void;
}

const GroupDeviceItem = React.memo((props: GroupDeviceItemProps): JSX.Element => {
	return (
		<FormControlLabel
			key={props.device.uniqueId}
			control={
				<Checkbox
					checked={props.isChecked}
					onChange={() => props.onToggle(props.device.uniqueId)}
				/>
			}
			label={
				<Box>
					<Typography variant="body2">
						{props.device.name || props.device.uniqueId}
					</Typography>
					{props.device.room && (
						<Typography variant="caption" sx={{ color: 'text.secondary' }}>
							{props.device.room}
						</Typography>
					)}
				</Box>
			}
		/>
	);
});
GroupDeviceItem.displayName = 'GroupDeviceItem';

export const GroupCreateModal = React.memo((props: GroupCreateModalProps): JSX.Element => {
	const [name, setName] = useState('');
	const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);

	useEffect(() => {
		if (props.open) {
			if (props.group) {
				setName(props.group.name);
				setSelectedDeviceIds(props.group.deviceIds);
			} else {
				setName('');
				setSelectedDeviceIds([]);
			}
		}
	}, [props.open, props.group]);

	const handleSave = async () => {
		if (name.trim() === '') {
			alert('Please enter a group name');
			return;
		}

		if (selectedDeviceIds.length === 0) {
			alert('Please select at least one device');
			return;
		}

		await props.onSave({
			name: name.trim(),
			deviceIds: selectedDeviceIds,
		});
	};

	const handleToggleDevice = (deviceId: string) => {
		setSelectedDeviceIds((prev) => {
			if (prev.includes(deviceId)) {
				return prev.filter((id) => id !== deviceId);
			} else {
				return [...prev, deviceId];
			}
		});
	};

	// Calculate common clusters for preview
	const selectedDevices = props.devices.filter((d) => selectedDeviceIds.includes(d.uniqueId));
	const clusterMap = new Map<string, number>();
	for (const device of selectedDevices) {
		for (const cluster of device.flatAllClusters) {
			clusterMap.set(cluster.name, (clusterMap.get(cluster.name) || 0) + 1);
		}
	}
	const commonClusters = Array.from(clusterMap.entries())
		.filter(([, count]) => count === selectedDevices.length)
		.map(([name]) => name);

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			maxWidth="sm"
			fullWidth
			PaperProps={{ sx: { borderRadius: 2 } }}
		>
			<DialogTitle>{props.group ? 'Edit Group' : 'Create New Group'}</DialogTitle>
			<DialogContent>
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
					<TextField
						label="Group Name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						fullWidth
						required
					/>

					<Typography variant="subtitle2" sx={{ mt: 1 }}>
						Select Devices:
					</Typography>
					<Box
						sx={{
							display: 'flex',
							flexDirection: 'column',
							maxHeight: 300,
							overflowY: 'auto',
						}}
					>
						{props.devices.map((device) => (
							<GroupDeviceItem
								key={device.uniqueId}
								device={device}
								isChecked={selectedDeviceIds.includes(device.uniqueId)}
								onToggle={handleToggleDevice}
							/>
						))}
					</Box>

					{selectedDevices.length > 0 && (
						<Box sx={{ mt: 1, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
							<Typography variant="caption" sx={{ color: 'text.secondary' }}>
								Selected: {selectedDevices.length} device
								{selectedDevices.length !== 1 ? 's' : ''}
							</Typography>
							{commonClusters.length > 0 && (
								<Typography
									variant="caption"
									sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
								>
									Common clusters: {commonClusters.join(', ')}
								</Typography>
							)}
							{commonClusters.length === 0 && selectedDevices.length > 1 && (
								<Typography
									variant="caption"
									sx={{ display: 'block', mt: 0.5, color: 'warning.main' }}
								>
									No common clusters - this group can't be used in scenes
								</Typography>
							)}
						</Box>
					)}
				</Box>
			</DialogContent>
			<DialogActions sx={{ p: 2 }}>
				<Button onClick={props.onClose}>Cancel</Button>
				<Button onClick={handleSave} variant="contained">
					Save
				</Button>
			</DialogActions>
		</Dialog>
	);
});
GroupCreateModal.displayName = 'GroupCreateModal';
