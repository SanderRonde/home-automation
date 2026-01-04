import {
	Box,
	Button,
	Checkbox,
	Collapse,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControlLabel,
	IconButton,
	TextField,
	Typography,
	Autocomplete,
} from '@mui/material';
import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
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
	const [deviceSearch, setDeviceSearch] = useState('');
	const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

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
			setDeviceSearch('');
			setExpandedClusters(new Set());
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
	const clusterDeviceMap = new Map<string, Set<string>>();

	for (const device of selectedDevices) {
		const deviceClusters = new Set(device.flatAllClusters.map((c) => c.name));
		for (const clusterName of deviceClusters) {
			clusterMap.set(clusterName, (clusterMap.get(clusterName) || 0) + 1);
			if (!clusterDeviceMap.has(clusterName)) {
				clusterDeviceMap.set(clusterName, new Set());
			}
			clusterDeviceMap.get(clusterName)!.add(device.uniqueId);
		}
	}

	const commonClusters = Array.from(clusterMap.entries())
		.filter(([, count]) => count === selectedDevices.length)
		.map(([name]) => name);

	// Calculate which devices don't have each cluster
	const getDevicesWithoutCluster = (
		clusterName: string
	): DeviceListWithValuesResponse[number][] => {
		const devicesWithCluster = clusterDeviceMap.get(clusterName) || new Set();
		return selectedDevices.filter((d) => !devicesWithCluster.has(d.uniqueId));
	};

	// Filter devices based on search
	const filteredDevices = React.useMemo(() => {
		if (!deviceSearch.trim()) {
			return props.devices;
		}
		const searchLower = deviceSearch.toLowerCase();
		return props.devices.filter(
			(d) =>
				d.name?.toLowerCase().includes(searchLower) ||
				d.uniqueId.toLowerCase().includes(searchLower) ||
				d.room?.toLowerCase().includes(searchLower)
		);
	}, [props.devices, deviceSearch]);

	const toggleClusterExpanded = (clusterName: string) => {
		setExpandedClusters((prev) => {
			const next = new Set(prev);
			if (next.has(clusterName)) {
				next.delete(clusterName);
			} else {
				next.add(clusterName);
			}
			return next;
		});
	};

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
					<TextField
						label="Search devices"
						value={deviceSearch}
						onChange={(e) => setDeviceSearch(e.target.value)}
						fullWidth
						size="small"
						sx={{ mb: 1 }}
					/>
					<Box
						sx={{
							display: 'flex',
							flexDirection: 'column',
							maxHeight: 300,
							overflowY: 'auto',
						}}
					>
						{filteredDevices.map((device) => (
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
								<Box sx={{ mt: 0.5 }}>
									<Typography
										variant="caption"
										sx={{ display: 'block', color: 'warning.main', mb: 0.5 }}
									>
										No common clusters - this group can't be used in scenes
									</Typography>
									{Array.from(clusterMap.entries())
										.sort((a, b) => b[1] - a[1])
										.map(([clusterName, count]) => {
											const missingDevices =
												getDevicesWithoutCluster(clusterName);
											const isExpanded = expandedClusters.has(clusterName);
											return (
												<Box key={clusterName} sx={{ mb: 0.5 }}>
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															cursor: 'pointer',
														}}
														onClick={() =>
															toggleClusterExpanded(clusterName)
														}
													>
														<IconButton
															size="small"
															sx={{ p: 0.25, mr: 0.5 }}
														>
															{isExpanded ? (
																<ExpandLess fontSize="small" />
															) : (
																<ExpandMore fontSize="small" />
															)}
														</IconButton>
														<Typography
															variant="caption"
															sx={{
																color: 'text.secondary',
																flex: 1,
															}}
														>
															{clusterName}: {count} /{' '}
															{selectedDevices.length}
															{missingDevices.length > 0 && (
																<span
																	style={{
																		color: 'warning.main',
																	}}
																>
																	{' '}
																	({missingDevices.length}{' '}
																	missing)
																</span>
															)}
														</Typography>
													</Box>
													<Collapse in={isExpanded}>
														{missingDevices.length > 0 && (
															<Box sx={{ pl: 4, mt: 0.5 }}>
																<Typography
																	variant="caption"
																	sx={{
																		color: 'text.secondary',
																		display: 'block',
																	}}
																>
																	Missing from:
																</Typography>
																{missingDevices.map((device) => (
																	<Typography
																		key={device.uniqueId}
																		variant="caption"
																		sx={{
																			display: 'block',
																			color: 'warning.main',
																			pl: 1,
																		}}
																	>
																		•{' '}
																		{device.name ||
																			device.uniqueId}
																	</Typography>
																))}
															</Box>
														)}
													</Collapse>
												</Box>
											);
										})}
								</Box>
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
