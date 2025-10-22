import type {
	DashboardDeviceClusterOnOff,
	DashboardDeviceClusterLevelControl,
	DashboardDeviceClusterColorControl,
	DashboardDeviceClusterWindowCovering,
	DashboardDeviceClusterWithStateMap,
	DeviceListWithValuesResponse,
	DashboardDeviceClusterWithState,
} from '../../../server/modules/device/routing';
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	TextField,
	Box,
	IconButton,
	Typography,
	Switch,
	Slider,
	FormControlLabel,
	Checkbox,
	Autocomplete,
	useMediaQuery,
	useTheme,
	Divider,
	Card,
	CardContent,
	ToggleButtonGroup,
	ToggleButton,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type { Scene, SceneDeviceAction } from '../../../../types/scene';
import type { DeviceGroup } from '../../../../types/group';
import type { Palette } from '../../../../types/palette';
import * as Icons from '@mui/icons-material';
import { apiGet } from '../../lib/fetch';
import React, { useState } from 'react';

interface SceneCreateModalProps {
	open: boolean;
	onClose: () => void;
	onSave: (scene: Omit<Scene, 'id'>) => void;
	devices: DeviceListWithValuesResponse;
	existingScene?: Scene;
}

type DeviceActionEntry = SceneDeviceAction & {
	key: string;
	targetType?: 'device' | 'group';
};

// Popular MUI icons for scenes
const SCENE_ICONS: Array<{ icon: keyof typeof Icons; label: string }> = [
	{ icon: 'Nightlight', label: 'Sleep' },
	{ icon: 'WbSunny', label: 'Wake up' },
	{ icon: 'Home', label: 'Home' },
	{ icon: 'DirectionsRun', label: 'Away' },
	{ icon: 'LocalMovies', label: 'Movie' },
	{ icon: 'MenuBook', label: 'Reading' },
	{ icon: 'Restaurant', label: 'Dinner' },
	{ icon: 'Weekend', label: 'Relax' },
	{ icon: 'Work', label: 'Work' },
	{ icon: 'FitnessCenter', label: 'Exercise' },
	{ icon: 'Celebration', label: 'Party' },
	{ icon: 'LightMode', label: 'Bright' },
	{ icon: 'DarkMode', label: 'Dark' },
	{ icon: 'Star', label: 'Favorite' },
];

export const SceneCreateModal = (props: SceneCreateModalProps): JSX.Element => {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

	const [groups, setGroups] = useState<DeviceGroup[]>([]);
	const [palettes, setPalettes] = useState<Palette[]>([]);
	const [title, setTitle] = useState(props.existingScene?.title ?? '');
	const [selectedIcon, setSelectedIcon] = useState<keyof typeof Icons>(
		props.existingScene?.icon ?? 'Star'
	);
	const [actions, setActions] = useState<DeviceActionEntry[]>(
		props.existingScene?.actions.map((action, index) => ({
			...action,
			key: `${action.deviceId || action.groupId}-${action.cluster}-${index}`,
			targetType: action.groupId ? ('group' as const) : ('device' as const),
		})) ?? []
	);

	// Load groups and palettes
	React.useEffect(() => {
		if (props.open) {
			const loadGroups = async () => {
				try {
					const response = await apiGet('device', '/groups/list', {});
					if (response.ok) {
						const data = await response.json();
						setGroups(data.groups);
					}
				} catch (error) {
					console.error('Failed to load groups:', error);
				}
			};
			const loadPalettes = async () => {
				try {
					const response = await apiGet('device', '/palettes/list', {});
					if (response.ok) {
						const data = await response.json();
						setPalettes(data.palettes);
					}
				} catch (error) {
					console.error('Failed to load palettes:', error);
				}
			};
			void loadGroups();
			void loadPalettes();
		}
	}, [props.open]);
	const [enableTrigger, setEnableTrigger] = useState(!!props.existingScene?.trigger);
	const [triggerType, setTriggerType] = useState<'occupancy' | 'button-press'>(
		props.existingScene?.trigger?.type ?? 'occupancy'
	);
	const [triggerDeviceId, setTriggerDeviceId] = useState<string | null>(
		props.existingScene?.trigger?.deviceId ?? null
	);
	const [triggerButtonIndex, setTriggerButtonIndex] = useState<number | undefined>(
		props.existingScene?.trigger?.type === 'button-press'
			? props.existingScene.trigger.buttonIndex
			: undefined
	);

	const IconComponent = Icons[selectedIcon];

	const availableDevices = React.useMemo(() => {
		return props.devices.filter((device) =>
			device.mergedAllClusters.some(
				(cluster) =>
					cluster.name === DeviceClusterName.ON_OFF ||
					cluster.name === DeviceClusterName.WINDOW_COVERING ||
					cluster.name === DeviceClusterName.COLOR_CONTROL ||
					cluster.name === DeviceClusterName.LEVEL_CONTROL
			)
		);
	}, [props.devices]);

	// Get devices with occupancy sensors for triggers
	const occupancyDevices = React.useMemo(() => {
		return props.devices.filter((device) =>
			device.mergedAllClusters.some(
				(cluster) => cluster.name === DeviceClusterName.OCCUPANCY_SENSING
			)
		);
	}, [props.devices]);

	// Get devices with switch/button clusters for triggers
	const buttonDevices = React.useMemo(() => {
		return props.devices.filter((device) =>
			device.mergedAllClusters.some((cluster) => cluster.name === DeviceClusterName.SWITCH)
		);
	}, [props.devices]);

	// Get button count for the selected device
	const selectedDeviceButtonCount = React.useMemo(() => {
		if (!triggerDeviceId || triggerType !== 'button-press') {
			return 0;
		}
		const device = buttonDevices.find((d) => d.uniqueId === triggerDeviceId);
		if (!device) {
			return 0;
		}
		// Count switch clusters
		return device.mergedAllClusters.filter(
			(cluster) => cluster.name === DeviceClusterName.SWITCH
		).length;
	}, [triggerDeviceId, triggerType, buttonDevices]);

	const handleAddAction = () => {
		const newAction: DeviceActionEntry = {
			deviceId: '',
			cluster: DeviceClusterName.ON_OFF,
			action: { isOn: true },
			key: `new-${Date.now()}`,
			targetType: 'device',
		};
		setActions([...actions, newAction]);
	};

	// Get common clusters for a group
	const getGroupCommonClusters = (groupId: string): DeviceClusterName[] => {
		const group = groups.find((g) => g.id === groupId);
		if (!group) {
			return [];
		}

		const deviceList = group.deviceIds
			.map((id) => props.devices.find((d) => d.uniqueId === id))
			.filter((d) => d !== undefined);

		if (deviceList.length === 0) {
			return [];
		}

		// Find clusters that all devices have
		const clusterCounts = new Map<DeviceClusterName, number>();
		for (const device of deviceList) {
			for (const cluster of device.mergedAllClusters) {
				clusterCounts.set(cluster.name, (clusterCounts.get(cluster.name) || 0) + 1);
			}
		}

		return Array.from(clusterCounts.entries())
			.filter(([, count]) => count === deviceList.length)
			.map(([name]) => name)
			.filter(
				(name) =>
					name === DeviceClusterName.ON_OFF ||
					name === DeviceClusterName.WINDOW_COVERING ||
					name === DeviceClusterName.COLOR_CONTROL ||
					name === DeviceClusterName.LEVEL_CONTROL
			);
	};

	const handleRemoveAction = (key: string) => {
		setActions(actions.filter((action) => action.key !== key));
	};

	const handleActionChange = (key: string, updates: Partial<DeviceActionEntry>) => {
		setActions(
			actions.map((action) => {
				if (action.key === key) {
					// When cluster changes, reset action to appropriate default
					if (updates.cluster && updates.cluster !== action.cluster) {
						if (updates.cluster === DeviceClusterName.ON_OFF) {
							return { ...action, ...updates, action: { isOn: true } };
						} else if (updates.cluster === DeviceClusterName.WINDOW_COVERING) {
							return {
								...action,
								...updates,
								action: { targetPositionLiftPercentage: 0 },
							};
						} else if (updates.cluster === DeviceClusterName.COLOR_CONTROL) {
							return {
								...action,
								...updates,
								action: { hue: 0, saturation: 100, value: 100 },
							};
						} else if (updates.cluster === DeviceClusterName.LEVEL_CONTROL) {
							return {
								...action,
								...updates,
								action: { level: 100 },
							};
						}
					}
					return { ...action, ...updates };
				}
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				return action as any;
			})
		);
	};

	const handleSave = () => {
		// Validate
		if (!title.trim()) {
			return;
		}
		if (actions.length === 0) {
			return;
		}
		if (actions.some((action) => !action.deviceId && !action.groupId)) {
			return;
		}

		let trigger: Scene['trigger'] = undefined;
		if (enableTrigger && triggerDeviceId) {
			if (triggerType === 'occupancy') {
				trigger = { type: 'occupancy', deviceId: triggerDeviceId };
			} else if (triggerType === 'button-press') {
				trigger = {
					type: 'button-press',
					deviceId: triggerDeviceId,
					buttonIndex: triggerButtonIndex!,
				};
			}
		}

		const scene: Omit<Scene, 'id'> = {
			title: title.trim(),
			icon: selectedIcon,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			actions: actions.map(({ key: _key, targetType: _targetType, ...action }) => action),
			trigger,
		};

		props.onSave(scene);
	};

	const getDeviceById = (deviceId: string) => {
		return props.devices.find((d) => d.uniqueId === deviceId);
	};

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			maxWidth="sm"
			fullWidth
			fullScreen={isMobile}
		>
			<DialogTitle>
				<Box
					sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
				>
					<Typography variant="h6">
						{props.existingScene ? 'Edit Scene' : 'Create Scene'}
					</Typography>
					{isMobile && (
						<IconButton onClick={props.onClose}>
							<CloseIcon />
						</IconButton>
					)}
				</Box>
			</DialogTitle>
			<DialogContent>
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 1 }}>
					{/* Title and Icon */}
					<Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
						<TextField
							label="Scene Name"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							fullWidth
							autoFocus={!isMobile}
						/>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								width: 56,
								height: 56,
								borderRadius: 2,
								backgroundColor: 'action.hover',
								flexShrink: 0,
							}}
						>
							<IconComponent sx={{ fontSize: 32 }} />
						</Box>
					</Box>

					<Autocomplete
						options={SCENE_ICONS}
						getOptionLabel={(option) => option.label}
						value={
							SCENE_ICONS.find((item) => item.icon === selectedIcon) ?? SCENE_ICONS[0]
						}
						onChange={(_e, newValue) => {
							if (newValue) {
								setSelectedIcon(newValue.icon);
							}
						}}
						renderOption={(props, option) => {
							const OptionIcon = Icons[option.icon] as React.ComponentType;
							return (
								<Box component="li" {...props} sx={{ display: 'flex', gap: 1 }}>
									<OptionIcon />
									<Typography>{option.label}</Typography>
								</Box>
							);
						}}
						renderInput={(params) => <TextField {...params} label="Icon" />}
					/>

					{/* Device Actions */}
					<Box>
						<Typography variant="subtitle1" gutterBottom>
							Device Actions
						</Typography>
						<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
							{actions.map((action, index) => {
								const group = action.groupId
									? groups.find((g) => g.id === action.groupId)
									: undefined;
								const devices: DeviceListWithValuesResponse[number][] = [];
								if (group) {
									devices.push(
										...group.deviceIds
											.map(getDeviceById)
											.filter((d) => d !== undefined)
									);
								} else {
									const device = getDeviceById(action.deviceId || '');
									if (device) {
										devices.push(device);
									}
								}
								return (
									<ActionConfig
										action={action}
										key={action.key}
										index={index}
										devices={devices}
										group={group}
										availableDevices={availableDevices}
										availableGroups={groups}
										availablePalettes={palettes}
										getGroupCommonClusters={getGroupCommonClusters}
										handleActionChange={handleActionChange}
										handleRemoveAction={handleRemoveAction}
									/>
								);
							})}

							<Button
								variant="outlined"
								startIcon={<AddIcon />}
								onClick={handleAddAction}
								fullWidth
							>
								Add Device Action
							</Button>
						</Box>
					</Box>

					<Divider />

					{/* Trigger Section */}
					<Box>
						<FormControlLabel
							control={
								<Checkbox
									checked={enableTrigger}
									onChange={(e) => {
										setEnableTrigger(e.target.checked);
										if (!e.target.checked) {
											setTriggerDeviceId(null);
											setTriggerButtonIndex(undefined);
										}
									}}
								/>
							}
							label="Enable Trigger"
						/>

						{enableTrigger && (
							<Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
								<ToggleButtonGroup
									value={triggerType}
									exclusive
									onChange={(_e, value) => {
										if (value) {
											setTriggerType(value);
											setTriggerDeviceId(null);
											setTriggerButtonIndex(undefined);
										}
									}}
									fullWidth
								>
									<ToggleButton value="occupancy">Occupancy</ToggleButton>
									<ToggleButton value="button-press">Button Press</ToggleButton>
								</ToggleButtonGroup>

								{triggerType === 'occupancy' && (
									<>
										<Autocomplete
											options={occupancyDevices}
											getOptionLabel={(option) => option.name}
											value={
												occupancyDevices.find(
													(d) => d.uniqueId === triggerDeviceId
												) ?? null
											}
											onChange={(_e, newValue) => {
												setTriggerDeviceId(newValue?.uniqueId ?? null);
											}}
											renderInput={(params) => (
												<TextField {...params} label="Occupancy Sensor" />
											)}
										/>
										<Typography variant="caption" color="text.secondary">
											Scene will trigger when occupancy is detected
										</Typography>
									</>
								)}

								{triggerType === 'button-press' && (
									<>
										<Autocomplete
											options={buttonDevices}
											getOptionLabel={(option) => option.name}
											value={
												buttonDevices.find(
													(d) => d.uniqueId === triggerDeviceId
												) ?? null
											}
											onChange={(_e, newValue) => {
												setTriggerDeviceId(newValue?.uniqueId ?? null);
												setTriggerButtonIndex(undefined);
											}}
											renderInput={(params) => (
												<TextField {...params} label="Button Device" />
											)}
										/>

										{triggerDeviceId && selectedDeviceButtonCount > 1 && (
											<Autocomplete
												options={Array.from(
													{ length: selectedDeviceButtonCount },
													(_, i) => i
												)}
												getOptionLabel={(option) => `Button ${option + 1}`}
												value={triggerButtonIndex ?? null}
												onChange={(_e, newValue) => {
													setTriggerButtonIndex(
														newValue !== null ? newValue : undefined
													);
												}}
												renderInput={(params) => (
													<TextField
														{...params}
														label="Button Index"
														helperText="Leave empty to trigger on any button"
													/>
												)}
											/>
										)}

										<Typography variant="caption" color="text.secondary">
											Scene will trigger when the button is pressed
										</Typography>
									</>
								)}
							</Box>
						)}
					</Box>
				</Box>
			</DialogContent>
			<DialogActions sx={{ p: 2, gap: 1 }}>
				<Button onClick={props.onClose} fullWidth={isMobile}>
					Cancel
				</Button>
				<Button
					onClick={handleSave}
					variant="contained"
					fullWidth={isMobile}
					disabled={
						!title.trim() ||
						actions.length === 0 ||
						actions.some((a) => !a.deviceId && !a.groupId)
					}
				>
					{props.existingScene ? 'Save' : 'Create'}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

interface ActionConfigProps {
	action: DeviceActionEntry;
	devices: DeviceListWithValuesResponse[number][];
	group: DeviceGroup | undefined;
	index: number;
	availableDevices: DeviceListWithValuesResponse;
	availableGroups: DeviceGroup[];
	availablePalettes: Palette[];
	getGroupCommonClusters: (groupId: string) => DeviceClusterName[];
	handleActionChange: (key: string, updates: Partial<DeviceActionEntry>) => void;
	handleRemoveAction: (key: string) => void;
}

const ActionConfig = (props: ActionConfigProps) => {
	const targetType = props.action.targetType || 'device';
	const [colorMode, setColorMode] = React.useState<'manual' | 'palette'>(
		props.action.cluster === DeviceClusterName.COLOR_CONTROL &&
			'paletteId' in props.action.action
			? 'palette'
			: 'manual'
	);
	const isGroup = targetType === 'group';

	// Get available clusters based on whether it's a device or group
	const availableClusters: DashboardDeviceClusterWithStateMap<
		| DeviceClusterName.ON_OFF
		| DeviceClusterName.WINDOW_COVERING
		| DeviceClusterName.COLOR_CONTROL
		| DeviceClusterName.LEVEL_CONTROL
	> = {};

	if (!isGroup) {
		// For devices, get clusters from the device
		for (const device of props.devices) {
			for (const cluster of device.mergedAllClusters ?? []) {
				if (cluster.name === DeviceClusterName.COLOR_CONTROL) {
					// @ts-ignore
					availableClusters[cluster.name] = cluster;
					if (cluster.mergedClusters[DeviceClusterName.LEVEL_CONTROL]) {
						// @ts-ignore
						availableClusters[DeviceClusterName.LEVEL_CONTROL] =
							cluster.mergedClusters[DeviceClusterName.LEVEL_CONTROL];
					}
					if (cluster.mergedClusters[DeviceClusterName.ON_OFF]) {
						// @ts-ignore
						availableClusters[DeviceClusterName.ON_OFF] =
							cluster.mergedClusters[DeviceClusterName.ON_OFF];
					}
				} else if (
					cluster.name === DeviceClusterName.ON_OFF ||
					cluster.name === DeviceClusterName.WINDOW_COVERING ||
					cluster.name === DeviceClusterName.LEVEL_CONTROL
				) {
					// @ts-ignore
					availableClusters[cluster.name] = cluster;
				}
			}
		}
	} else {
		const clusterMap: Partial<
			Record<
				| DeviceClusterName.ON_OFF
				| DeviceClusterName.WINDOW_COVERING
				| DeviceClusterName.COLOR_CONTROL
				| DeviceClusterName.LEVEL_CONTROL,
				DashboardDeviceClusterWithState[]
			>
		> = {};
		for (const device of props.devices) {
			for (const cluster of device.mergedAllClusters ?? []) {
				if (cluster.name === DeviceClusterName.COLOR_CONTROL) {
					clusterMap[cluster.name] ??= [];
					clusterMap[cluster.name]!.push(cluster);
					if (cluster.mergedClusters[DeviceClusterName.LEVEL_CONTROL]) {
						clusterMap[DeviceClusterName.LEVEL_CONTROL] ??= [];
						clusterMap[DeviceClusterName.LEVEL_CONTROL].push(
							cluster.mergedClusters[DeviceClusterName.LEVEL_CONTROL]
						);
					}
					if (cluster.mergedClusters[DeviceClusterName.ON_OFF]) {
						clusterMap[DeviceClusterName.ON_OFF] ??= [];
						clusterMap[DeviceClusterName.ON_OFF].push(
							cluster.mergedClusters[DeviceClusterName.ON_OFF]
						);
					}
				} else if (
					cluster.name === DeviceClusterName.ON_OFF ||
					cluster.name === DeviceClusterName.WINDOW_COVERING ||
					cluster.name === DeviceClusterName.LEVEL_CONTROL
				) {
					clusterMap[cluster.name] ??= [];
					clusterMap[cluster.name]!.push(cluster);
				}
			}
		}

		for (const clusterName in clusterMap) {
			if (
				clusterMap[clusterName as keyof typeof clusterMap]!.length === props.devices.length
			) {
				availableClusters[clusterName as keyof typeof clusterMap] = clusterMap[
					clusterName as keyof typeof clusterMap
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
				]![0] as any;
			}
		}
	}

	return (
		<Card key={props.action.key} variant="outlined">
			<CardContent sx={{ '&:last-child': { pb: 2 } }}>
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						gap: 2,
					}}
				>
					<Box
						sx={{
							display: 'flex',
							gap: 1,
							alignItems: 'center',
						}}
					>
						<Typography variant="body2" sx={{ minWidth: 60 }}>
							#{props.index + 1}
						</Typography>

						{/* Toggle between Device and Group */}
						<ToggleButtonGroup
							value={targetType}
							exclusive
							onChange={(_e, newType) => {
								if (newType) {
									props.handleActionChange(props.action.key, {
										targetType: newType,
										deviceId: newType === 'device' ? '' : undefined,
										groupId: newType === 'group' ? '' : undefined,
									});
								}
							}}
							size="small"
						>
							<ToggleButton value="device">Device</ToggleButton>
							<ToggleButton value="group">Group</ToggleButton>
						</ToggleButtonGroup>

						{/* Device or Group Selector */}
						{!isGroup ? (
							<Autocomplete
								options={props.availableDevices}
								getOptionLabel={(option) => option.name}
								value={props.devices[0] ?? null}
								onChange={(_e, newValue) => {
									if (newValue) {
										props.handleActionChange(props.action.key, {
											deviceId: newValue.uniqueId,
										});
									}
								}}
								renderInput={(params) => (
									<TextField {...params} label="Device" size="small" />
								)}
								sx={{ flex: 1 }}
							/>
						) : (
							<Autocomplete
								options={props.availableGroups}
								getOptionLabel={(option) => option.name}
								value={props.group ?? null}
								onChange={(_e, newValue) => {
									if (newValue) {
										props.handleActionChange(props.action.key, {
											groupId: newValue.id,
										});
									}
								}}
								renderInput={(params) => (
									<TextField {...params} label="Group" size="small" />
								)}
								sx={{ flex: 1 }}
							/>
						)}

						<IconButton
							size="small"
							onClick={() => props.handleRemoveAction(props.action.key)}
							color="error"
						>
							<DeleteIcon />
						</IconButton>
					</Box>

					{/* Show cluster selection if device is selected or if group is selected */}
					{((!isGroup &&
						props.devices.length > 0 &&
						Object.keys(availableClusters).length > 0) ||
						(isGroup && props.group)) && (
						<>
							{isGroup && props.group ? (
								<Autocomplete
									options={props.getGroupCommonClusters(props.group.id)}
									getOptionLabel={(option) => option}
									value={props.action.cluster}
									onChange={(_e, newValue) => {
										if (newValue) {
											props.handleActionChange(props.action.key, {
												cluster: newValue as SceneDeviceAction['cluster'],
											});
										}
									}}
									renderInput={(params) => (
										<TextField {...params} label="Action Type" size="small" />
									)}
								/>
							) : (
								<Autocomplete
									options={
										Object.values(availableClusters) as (
											| DashboardDeviceClusterLevelControl
											| DashboardDeviceClusterWindowCovering
											| DashboardDeviceClusterColorControl
											| DashboardDeviceClusterOnOff
										)[]
									}
									getOptionLabel={(option) => option.name}
									value={availableClusters[props.action.cluster] ?? null}
									onChange={(_e, newValue) => {
										if (newValue) {
											props.handleActionChange(props.action.key, {
												cluster: newValue.name,
											});
										}
									}}
									renderInput={(params) => (
										<TextField {...params} label="Cluster" size="small" />
									)}
								/>
							)}

							{/* Action Configuration */}
							{props.action.cluster === DeviceClusterName.ON_OFF && (
								<FormControlLabel
									control={
										<Switch
											checked={
												(
													props.action.action as {
														isOn: boolean;
													}
												).isOn
											}
											onChange={(e) =>
												props.handleActionChange(props.action.key, {
													action: {
														isOn: e.target.checked,
													},
												})
											}
										/>
									}
									label={props.action.action.isOn ? 'Turn On' : 'Turn Off'}
								/>
							)}

							{props.action.cluster === DeviceClusterName.WINDOW_COVERING && (
								<Box>
									<Typography variant="body2" gutterBottom>
										Position:{' '}
										{
											(
												props.action.action as {
													targetPositionLiftPercentage: number;
												}
											).targetPositionLiftPercentage
										}
										%
									</Typography>
									<Slider
										value={props.action.action.targetPositionLiftPercentage}
										onChange={(_e, value) =>
											props.handleActionChange(props.action.key, {
												action: {
													targetPositionLiftPercentage: value,
												},
											})
										}
										min={0}
										max={100}
										marks={[
											{
												value: 0,
												label: '0%',
											},
											{
												value: 50,
												label: '50%',
											},
											{
												value: 100,
												label: '100%',
											},
										]}
									/>
								</Box>
							)}

							{props.action.cluster === DeviceClusterName.LEVEL_CONTROL && (
								<Box>
									<Typography variant="body2" gutterBottom>
										Level:{' '}
										{
											(
												props.action.action as {
													level: number;
												}
											).level
										}
										%
									</Typography>
									<Slider
										value={props.action.action.level}
										onChange={(_e, value) =>
											props.handleActionChange(props.action.key, {
												action: {
													level: value,
												},
											})
										}
										min={0}
										max={100}
										marks={[
											{
												value: 0,
												label: '0%',
											},
											{
												value: 50,
												label: '50%',
											},
											{
												value: 100,
												label: '100%',
											},
										]}
									/>
								</Box>
							)}

							{((props.action.cluster === DeviceClusterName.COLOR_CONTROL &&
								availableClusters[DeviceClusterName.COLOR_CONTROL]
									?.mergedClusters?.[DeviceClusterName.ON_OFF]) ||
								props.action.cluster === DeviceClusterName.ON_OFF) && (
								<Box
									sx={{
										display: 'flex',
										flexDirection: 'column',
										gap: 2,
									}}
								>
									<ToggleButtonGroup
										value={
											props.action.cluster === DeviceClusterName.ON_OFF
												? props.action.action.isOn
													? 'on'
													: 'off'
												: 'color'
										}
										exclusive
										onChange={(_e, value) => {
											if (value === 'off') {
												props.handleActionChange(props.action.key, {
													cluster: DeviceClusterName.ON_OFF,
													action: {
														isOn: false,
													},
												});
											} else if (value === 'on') {
												props.handleActionChange(props.action.key, {
													cluster: DeviceClusterName.ON_OFF,
													action: {
														isOn: true,
													},
												});
											} else if (value === 'color') {
												props.handleActionChange(props.action.key, {
													cluster: DeviceClusterName.COLOR_CONTROL,
													action: {
														hue: 0,
														saturation: 100,
														value: 100,
													},
												});
											}
										}}
										fullWidth
									>
										<ToggleButton value="off">Off</ToggleButton>
										<ToggleButton value="on">On</ToggleButton>
										<ToggleButton value="color">Color</ToggleButton>
									</ToggleButtonGroup>
								</Box>
							)}

							{props.action.cluster === DeviceClusterName.COLOR_CONTROL && (
								<Box
									sx={{
										display: 'flex',
										flexDirection: 'column',
										gap: 2,
									}}
								>
									{/* Color Mode Selector (only for groups) */}
									{isGroup && (
										<ToggleButtonGroup
											value={colorMode}
											exclusive
											onChange={(_e, value) => {
												if (value) {
													setColorMode(value);
													// Clear action data when switching modes
													if (value === 'manual') {
														props.handleActionChange(props.action.key, {
															action: {
																hue: 0,
																saturation: 100,
																value: 100,
															},
														});
													} else {
														props.handleActionChange(props.action.key, {
															action: {
																paletteId: '',
															},
														});
													}
												}
											}}
											fullWidth
										>
											<ToggleButton value="manual">Manual Color</ToggleButton>
											<ToggleButton value="palette">Palette</ToggleButton>
										</ToggleButtonGroup>
									)}

									{/* Color Preview (only for manual mode) */}
									{colorMode === 'manual' && 'hue' in props.action.action && (
										<Box
											sx={{
												width: '100%',
												height: 60,
												borderRadius: 2,
												border: '1px solid',
												borderColor: 'divider',
												backgroundColor: `hsl(${props.action.action.hue ?? 0}, ${props.action.action.saturation ?? 100}%, ${(props.action.action.value ?? 100) / 2}%)`,
											}}
										/>
									)}

									{/* Palette Selector */}
									{colorMode === 'palette' && (
										<Box>
											<Autocomplete
												options={props.availablePalettes}
												getOptionLabel={(option) => option.name}
												value={(() => {
													if ('paletteId' in props.action.action) {
														const paletteId = (
															props.action.action as {
																paletteId: string;
															}
														).paletteId;
														return (
															props.availablePalettes.find(
																(p) => p.id === paletteId
															) ?? null
														);
													}
													return null;
												})()}
												onChange={(_e, newValue) => {
													props.handleActionChange(props.action.key, {
														action: {
															paletteId: newValue?.id ?? '',
														},
													});
												}}
												renderInput={(params) => (
													<TextField
														{...params}
														label="Select Palette"
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
																width: '100%',
															}}
														>
															<Typography sx={{ flex: 1 }}>
																{option.name}
															</Typography>
															<Box
																sx={{
																	display: 'flex',
																	gap: 0.5,
																}}
															>
																{option.colors.map((color, idx) => (
																	<Box
																		key={idx}
																		sx={{
																			width: 20,
																			height: 20,
																			backgroundColor: color,
																			borderRadius: '50%',
																			border: '1px solid rgba(0,0,0,0.2)',
																		}}
																	/>
																))}
															</Box>
														</Box>
													</li>
												)}
											/>
										</Box>
									)}

									{colorMode === 'manual' && 'hue' in props.action.action && (
										<>
											<Box>
												<Typography variant="body2" gutterBottom>
													Hue: {props.action.action.hue}°
												</Typography>
												<Slider
													value={props.action.action.hue}
													onChange={(_e, value) =>
														props.handleActionChange(props.action.key, {
															action: {
																...(props.action.action as {
																	hue: number;
																	saturation: number;
																	value: number;
																}),
																hue: value,
															},
														})
													}
													min={0}
													max={360}
													marks={[
														{
															value: 0,
															label: '0°',
														},
														{
															value: 180,
															label: '180°',
														},
														{
															value: 360,
															label: '360°',
														},
													]}
												/>
											</Box>
											<Box>
												<Typography variant="body2" gutterBottom>
													Saturation: {props.action.action.saturation}%
												</Typography>
												<Slider
													value={props.action.action.saturation}
													onChange={(_e, value) =>
														props.handleActionChange(props.action.key, {
															action: {
																...(props.action.action as {
																	hue: number;
																	saturation: number;
																	value: number;
																}),
																saturation: value,
															},
														})
													}
													min={0}
													max={100}
													marks={[
														{
															value: 0,
															label: '0%',
														},
														{
															value: 50,
															label: '50%',
														},
														{
															value: 100,
															label: '100%',
														},
													]}
												/>
											</Box>
											{'value' in props.action.action &&
												!availableClusters[DeviceClusterName.COLOR_CONTROL]
													?.mergedClusters[
													DeviceClusterName.LEVEL_CONTROL
												] && (
													<Box>
														<Typography variant="body2" gutterBottom>
															Brightness: {props.action.action.value}%
														</Typography>
														<Slider
															value={props.action.action.value}
															onChange={(_e, value) =>
																props.handleActionChange(
																	props.action.key,
																	{
																		action: {
																			...(props.action
																				.action as {
																				hue: number;
																				saturation: number;
																				value: number;
																			}),
																			value: value,
																		},
																	}
																)
															}
															min={0}
															max={100}
															marks={[
																{
																	value: 0,
																	label: '0%',
																},
																{
																	value: 50,
																	label: '50%',
																},
																{
																	value: 100,
																	label: '100%',
																},
															]}
														/>
													</Box>
												)}
										</>
									)}
								</Box>
							)}
						</>
					)}
				</Box>
			</CardContent>
		</Card>
	);
};
