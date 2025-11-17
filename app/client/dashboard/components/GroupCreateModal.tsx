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
	Autocomplete,
} from '@mui/material';
import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import type { DeviceGroup } from '../../../../types/group';
import React, { useState, useEffect } from 'react';
import type { IncludedIconNames } from './icon';
import { IconComponent } from './icon';

interface GroupCreateModalProps {
	open: boolean;
	onClose: () => void;
	onSave: (group: Omit<DeviceGroup, 'id'>) => Promise<void>;
	group?: DeviceGroup;
	devices: DeviceListWithValuesResponse;
}

// Popular MUI icons for groups
const GROUP_ICONS: Array<{ icon: IncludedIconNames; label: string }> = [
	{ icon: 'Group', label: 'Group' },
	{ icon: 'Lightbulb', label: 'Lights' },
	{ icon: 'Palette', label: 'Colors' },
	{ icon: 'Home', label: 'Home' },
	{ icon: 'Bed', label: 'Bedroom' },
	{ icon: 'Weekend', label: 'Living Room' },
	{ icon: 'Kitchen', label: 'Kitchen' },
	{ icon: 'Yard', label: 'Outdoor' },
	{ icon: 'Garage', label: 'Garage' },
	{ icon: 'Star', label: 'Favorite' },
	{ icon: 'Window', label: 'Windows' },
	{ icon: 'Sensors', label: 'Sensors' },
	{ icon: 'DeviceThermostat', label: 'Climate' },
];

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
	const [selectedIcon, setSelectedIcon] = useState<IncludedIconNames>('Group');
	const [showOnHome, setShowOnHome] = useState(false);

	useEffect(() => {
		if (props.open) {
			if (props.group) {
				setName(props.group.name);
				setSelectedDeviceIds(props.group.deviceIds);
				setSelectedIcon(props.group.icon || 'Group');
				setShowOnHome(props.group.showOnHome || false);
			} else {
				setName('');
				setSelectedDeviceIds([]);
				setSelectedIcon('Group');
				setShowOnHome(false);
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
			icon: selectedIcon,
			showOnHome,
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

					{/* Icon Selector */}
					<Box>
						<Typography variant="subtitle2" gutterBottom>
							Icon
						</Typography>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
							<Box
								sx={{
									width: 48,
									height: 48,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									borderRadius: 2,
									backgroundColor: 'action.hover',
									flexShrink: 0,
								}}
							>
								<IconComponent iconName={selectedIcon} sx={{ fontSize: 32 }} />
							</Box>
						</Box>
						<Autocomplete
							options={GROUP_ICONS}
							getOptionLabel={(option) => option.label}
							value={
								GROUP_ICONS.find((item) => item.icon === selectedIcon) ??
								GROUP_ICONS[0]
							}
							onChange={(_, newValue) => {
								if (newValue) {
									setSelectedIcon(newValue.icon);
								}
							}}
							renderOption={(props, option) => (
								<li {...props} key={option.icon}>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
										<IconComponent iconName={option.icon} />
										<span>{option.label}</span>
									</Box>
								</li>
							)}
							renderInput={(params) => (
								<TextField {...params} placeholder="Select icon" />
							)}
						/>
					</Box>

					{/* Show on Home Checkbox */}
					<FormControlLabel
						control={
							<Checkbox
								checked={showOnHome}
								onChange={(e) => setShowOnHome(e.target.checked)}
							/>
						}
						label="Show on Home Screen"
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
