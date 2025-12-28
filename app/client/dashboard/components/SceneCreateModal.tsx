import type {
	DashboardDeviceClusterOnOff,
	DashboardDeviceClusterLevelControl,
	DashboardDeviceClusterColorControlXY,
	DashboardDeviceClusterWindowCovering,
	DashboardDeviceClusterWithStateMap,
	DeviceListWithValuesResponse,
	DashboardDeviceClusterWithState,
	DashboardDeviceClusterSwitch,
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
	CircularProgress,
	type ListItemProps,
	type TextFieldProps,
} from '@mui/material';
import type {
	Scene,
	SceneDeviceAction,
	SceneTriggerWithConditions,
	SceneCondition,
} from '../../../../types/scene';
import {
	Delete as DeleteIcon,
	Add as AddIcon,
	Close as CloseIcon,
	Edit as EditIcon,
} from '@mui/icons-material';
import { SceneTriggerType, SceneConditionType } from '../../../../types/scene';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type { Host } from '../../../server/modules/home-detector/routing';
import { ClusterActionControls } from './ClusterActionControls';
import type { DeviceGroup } from '../../../../types/group';
import type { Palette } from '../../../../types/palette';
import { TriggerEditDialog } from './TriggerEditDialog';
import type { IncludedIconNames } from './icon';
import { apiGet } from '../../lib/fetch';
import React, { useState } from 'react';
import { IconComponent } from './icon';

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
const SCENE_ICONS: Array<{ icon: IncludedIconNames; label: string }> = [
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
	{ icon: 'Bed', label: 'Bed' },
];

export const SceneCreateModal = React.memo((props: SceneCreateModalProps): JSX.Element => {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

	const [groups, setGroups] = useState<DeviceGroup[]>([]);
	const [palettes, setPalettes] = useState<Palette[]>([]);
	const [title, setTitle] = useState(props.existingScene?.title ?? '');
	const [selectedIcon, setSelectedIcon] = useState<IncludedIconNames>(
		props.existingScene?.icon ?? 'Star'
	);
	const [actions, setActions] = useState<DeviceActionEntry[]>(
		props.existingScene?.actions.map((action, index) => ({
			...action,
			key: `${'deviceId' in action ? action.deviceId : 'groupId' in action ? action.groupId : 'http'}-${action.cluster}-${index}`,
			targetType:
				'groupId' in action && action.groupId ? ('group' as const) : ('device' as const),
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
	const [triggers, setTriggers] = useState<SceneTriggerWithConditions[]>(
		props.existingScene?.triggers ?? []
	);
	const [hosts, setHosts] = useState<Host[]>([]);
	const [showOnHome, setShowOnHome] = useState(props.existingScene?.showOnHome ?? false);

	// Trigger dialog state
	const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
	const [editingTriggerIndex, setEditingTriggerIndex] = useState<number | null>(null);

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

	// Load hosts for home detection triggers and conditions
	React.useEffect(() => {
		if (props.open) {
			const loadHosts = async () => {
				try {
					const response = await apiGet('home-detector', '/list', {});
					if (response.ok) {
						const data = await response.json();
						setHosts(data.hosts);
					}
				} catch (error) {
					console.error('Failed to load hosts:', error);
				}
			};
			void loadHosts();
		}
	}, [props.open]);

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

	const handleAddHttpAction = () => {
		const newAction = {
			cluster: 'http-request' as const,
			action: { url: '', method: 'GET' as const },
			key: `http-${Date.now()}`,
		} as DeviceActionEntry;
		setActions([...actions, newAction]);
	};

	const handleAddNotificationAction = () => {
		const newAction = {
			cluster: 'notification' as const,
			action: {
				title: 'Notification Title',
				body: 'Notification message',
			},
			key: `notification-${Date.now()}`,
		} as DeviceActionEntry;
		setActions([...actions, newAction]);
	};

	const handleAddRoomTemperatureAction = () => {
		const newAction = {
			cluster: 'room-temperature' as const,
			action: { roomName: 'Room 1', mode: 'setTarget', targetTemperature: 20 },
			key: `room-temperature-${Date.now()}`,
		} as DeviceActionEntry;
		setActions([...actions, newAction]);
	};

	// Get common clusters for a group
	const getGroupCommonClusters = React.useCallback(
		(groupId: string): DeviceClusterName[] => {
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
				for (const cluster of device.flatAllClusters) {
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
		},
		[groups, props.devices]
	);

	const handleRemoveAction = React.useCallback((key: string) => {
		setActions((actions) => actions.filter((action) => action.key !== key));
	}, []);

	const handleActionChange = React.useCallback(
		(key: string, updates: Partial<DeviceActionEntry>) => {
			setActions((actions) =>
				actions.map((action) => {
					if (action.key === key) {
						// When cluster changes, reset action to appropriate default
						if (updates.cluster && updates.cluster !== action.cluster) {
							// Preserve groupId, deviceId, excludeDeviceIds when cluster changes
							const preservedFields: Record<string, unknown> = {};
							if ('groupId' in action) {
								preservedFields.groupId = action.groupId;
							}
							if ('deviceId' in action) {
								preservedFields.deviceId = action.deviceId;
							}
							if ('excludeDeviceIds' in action) {
								preservedFields.excludeDeviceIds = action.excludeDeviceIds;
							}
							if (updates.cluster === DeviceClusterName.ON_OFF) {
								return {
									...action,
									...preservedFields,
									...updates,
									action: { isOn: true },
								};
							} else if (updates.cluster === DeviceClusterName.WINDOW_COVERING) {
								return {
									...action,
									...preservedFields,
									...updates,
									action: { targetPositionLiftPercentage: 0 },
								};
							} else if (updates.cluster === DeviceClusterName.COLOR_CONTROL) {
								return {
									...action,
									...preservedFields,
									...updates,
									action: { hue: 0, saturation: 100, value: 100 },
								};
							} else if (updates.cluster === DeviceClusterName.LEVEL_CONTROL) {
								return {
									...action,
									...preservedFields,
									...updates,
									action: { level: 100 },
								};
							}
						}
						// Merge updates, preserving existing fields like excludeDeviceIds
						return { ...action, ...updates };
					}
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					return action as any;
				})
			);
		},
		[]
	);

	const handleSave = () => {
		// Validate
		if (!title.trim()) {
			return;
		}
		if (actions.length === 0) {
			return;
		}
		// Check device/group actions have proper IDs, and HTTP actions have URLs
		if (
			actions.some(
				(action) =>
					action.cluster !== 'http-request' &&
					action.cluster !== 'notification' &&
					action.cluster !== 'room-temperature' &&
					!('deviceId' in action ? action.deviceId : false) &&
					!('groupId' in action ? action.groupId : false)
			)
		) {
			return;
		}
		if (
			actions.some(
				(action) =>
					action.cluster === 'http-request' &&
					!('url' in action.action ? action.action.url : false)
			)
		) {
			return;
		}
		if (
			actions.some(
				(action) =>
					action.cluster === 'notification' &&
					!('title' in action.action ? action.action.title : false) &&
					!('body' in action.action ? action.action.body : false)
			)
		) {
			return;
		}
		if (
			actions.some(
				(action) =>
					action.cluster === 'room-temperature' &&
					(!('roomName' in action.action ? action.action.roomName : false) ||
						!('mode' in action.action ? action.action.mode : false) ||
						(action.action.mode === 'setTarget' &&
							!('targetTemperature' in action.action
								? action.action.targetTemperature !== undefined
								: false)))
			)
		) {
			return;
		}

		const scene: Omit<Scene, 'id'> = {
			title: title.trim(),
			icon: selectedIcon,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			actions: actions.map(
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				({ key: _key, targetType: _targetType, ...action }) =>
					action as Scene['actions'][number]
			),
			triggers: triggers.length > 0 ? triggers : undefined,
			showOnHome,
		};

		props.onSave(scene);
	};

	const handleRemoveTrigger = React.useCallback((index: number) => {
		setTriggers((triggers) => triggers.filter((_, i) => i !== index));
	}, []);

	const handleAddTrigger = React.useCallback(() => {
		setEditingTriggerIndex(null);
		setTriggerDialogOpen(true);
	}, []);

	const handleEditTrigger = React.useCallback((index: number) => {
		setEditingTriggerIndex(index);
		setTriggerDialogOpen(true);
	}, []);

	const handleSaveTrigger = React.useCallback(
		(triggerWithConditions: SceneTriggerWithConditions) => {
			if (editingTriggerIndex !== null) {
				// Edit existing
				setTriggers(
					triggers.map((t, i) => (i === editingTriggerIndex ? triggerWithConditions : t))
				);
			} else {
				// Add new
				setTriggers([...triggers, triggerWithConditions]);
			}
			setTriggerDialogOpen(false);
			setEditingTriggerIndex(null);
		},
		[editingTriggerIndex, triggers]
	);

	const getTriggerLabel = React.useCallback(
		(triggerWithConditions: SceneTriggerWithConditions): string => {
			const trigger = triggerWithConditions.trigger;
			let label = '';

			if (trigger.type === SceneTriggerType.OCCUPANCY) {
				const device = props.devices.find((d) => d.uniqueId === trigger.deviceId);
				const triggerType = trigger.occupied ? 'Occupancy detected' : 'Occupancy removed';
				label = `${triggerType}: ${device?.name || trigger.deviceId}`;
			} else if (trigger.type === SceneTriggerType.BUTTON_PRESS) {
				const device = props.devices.find((d) => d.uniqueId === trigger.deviceId);
				label = `Button pressed: ${device?.name || trigger.deviceId}`;
				if (trigger.buttonIndex !== undefined) {
					const switchCluster = device?.flatAllClusters.find(
						(cluster): cluster is DashboardDeviceClusterSwitch =>
							cluster.name === DeviceClusterName.SWITCH &&
							cluster.index === trigger.buttonIndex
					);
					label += ` (${switchCluster?.label || `Button ${trigger.buttonIndex + 1}`})`;
				}
			} else if (trigger.type === SceneTriggerType.HOST_ARRIVAL) {
				const host = hosts.find((h) => h.name === trigger.hostId);
				label = `${host?.name || trigger.hostId} arrives home`;
			} else if (trigger.type === SceneTriggerType.HOST_DEPARTURE) {
				const host = hosts.find((h) => h.name === trigger.hostId);
				label = `${host?.name || trigger.hostId} leaves home`;
			} else if (trigger.type === SceneTriggerType.WEBHOOK) {
				label = `Webhook ${trigger.webhookName} triggers`;
			} else if (trigger.type === SceneTriggerType.ANYBODY_HOME) {
				label = 'Anybody becomes home';
			} else if (trigger.type === SceneTriggerType.NOBODY_HOME) {
				label = 'Everybody left';
			} else if (trigger.type === SceneTriggerType.NOBODY_HOME_TIMEOUT) {
				label = 'Nobody arrived after timeout';
			}

			return label;
		},
		[props.devices, hosts]
	);

	const getConditionLabel = React.useCallback(
		(condition: SceneCondition): string => {
			if (condition.type === SceneConditionType.HOST_HOME) {
				const host = hosts.find((h) => h.name === condition.hostId);
				return `${host?.name || condition.hostId} is ${condition.shouldBeHome ? 'home' : 'away'}`;
			} else if (condition.type === SceneConditionType.DEVICE_ON) {
				const device = props.devices.find((d) => d.uniqueId === condition.deviceId);
				return `${device?.name || condition.deviceId} is ${condition.shouldBeOn ? 'on' : 'off'}`;
			} else if (condition.type === SceneConditionType.TIME_WINDOW) {
				const windows = condition.windows;
				const entries = Object.entries(windows);
				return entries
					.map(([day, window]) => `${day} ${window.start} - ${window.end}`)
					.join(', ');
			} else if (condition.type === SceneConditionType.ANYONE_HOME) {
				return condition.shouldBeHome ? 'Someone is home' : 'Everyone is away';
			}
			return '';
		},
		[props.devices, hosts]
	);

	const onIconChange = React.useCallback(
		(
			_event: unknown,
			newValue: {
				icon: IncludedIconNames;
				label: string;
			} | null
		) => {
			if (newValue) {
				setSelectedIcon(newValue.icon);
			}
		},
		[]
	);

	const renderIconOption = React.useCallback(
		(
			props: ListItemProps,
			option: {
				icon: IncludedIconNames;
				label: string;
			}
		) => {
			return (
				<Box component="li" {...props} sx={{ display: 'flex', gap: 1 }}>
					<IconComponent iconName={option.icon} />
					<Typography>{option.label}</Typography>
				</Box>
			);
		},
		[]
	);

	const renderIconInput = React.useCallback((params: TextFieldProps) => {
		return <TextField {...params} label="Icon" />;
	}, []);

	const getIconOptionLabel = React.useCallback(
		(option: { icon: IncludedIconNames; label: string }) => {
			return option.label;
		},
		[]
	);

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
							<IconComponent iconName={selectedIcon} sx={{ fontSize: 32 }} />
						</Box>
					</Box>

					<Autocomplete
						options={SCENE_ICONS}
						getOptionLabel={getIconOptionLabel}
						value={
							SCENE_ICONS.find((item) => item.icon === selectedIcon) ?? SCENE_ICONS[0]
						}
						onChange={onIconChange}
						renderOption={renderIconOption}
						renderInput={renderIconInput}
					/>

					{/* Device Actions */}
					<Box>
						<Typography variant="subtitle1" gutterBottom>
							Actions
						</Typography>
						<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
							{actions.map((action, index) => {
								// Render HTTP request action separately
								if (action.cluster === 'http-request') {
									return (
										<HttpActionConfig
											action={action}
											key={action.key}
											handleActionChange={handleActionChange}
											handleRemoveAction={handleRemoveAction}
										/>
									);
								}

								// Render room temperature action separately
								if (action.cluster === 'room-temperature') {
									return (
										<RoomTemperatureActionConfig
											action={action}
											key={action.key}
											handleActionChange={handleActionChange}
											handleRemoveAction={handleRemoveAction}
										/>
									);
								}

								// Render notification action separately
								if (action.cluster === 'notification') {
									return (
										<Card key={action.key} variant="outlined" sx={{ p: 2 }}>
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
														justifyContent: 'space-between',
														alignItems: 'center',
													}}
												>
													<Typography variant="h6">
														Notification
													</Typography>
													<IconButton
														onClick={() =>
															handleRemoveAction(action.key)
														}
														size="small"
													>
														<DeleteIcon />
													</IconButton>
												</Box>
												<TextField
													label="Title"
													value={action.action.title}
													onChange={(e) =>
														handleActionChange(action.key, {
															...action,
															action: {
																...action.action,
																title: e.target.value,
															},
														})
													}
													fullWidth
												/>
												<TextField
													label="Body"
													value={action.action.body}
													onChange={(e) =>
														handleActionChange(action.key, {
															...action,
															action: {
																...action.action,
																body: e.target.value,
															},
														})
													}
													multiline
													rows={3}
													fullWidth
												/>
											</Box>
										</Card>
									);
								}

								const group =
									'groupId' in action && action.groupId
										? groups.find((g) => g.id === action.groupId)
										: undefined;

								return (
									<ActionConfig
										action={action}
										key={action.key}
										index={index}
										devices={props.devices}
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

							<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
								<Button
									variant="outlined"
									startIcon={<AddIcon />}
									onClick={handleAddAction}
									sx={{ flex: 1, minWidth: '200px' }}
								>
									Add Device Action
								</Button>
								<Button
									variant="outlined"
									startIcon={<AddIcon />}
									onClick={handleAddHttpAction}
									sx={{ flex: 1, minWidth: '200px' }}
								>
									Add HTTP Request
								</Button>
								<Button
									variant="outlined"
									startIcon={<AddIcon />}
									onClick={handleAddNotificationAction}
									sx={{ flex: 1, minWidth: '200px' }}
								>
									Add Notification
								</Button>
								<Button
									variant="outlined"
									startIcon={<AddIcon />}
									onClick={handleAddRoomTemperatureAction}
									sx={{ flex: 1, minWidth: '200px' }}
								>
									Add Room Temperature Action
								</Button>
							</Box>
						</Box>
					</Box>

					<Divider />

					{/* Show on Home Section */}
					<Box>
						<FormControlLabel
							control={
								<Checkbox
									checked={showOnHome}
									onChange={(e) => setShowOnHome(e.target.checked)}
								/>
							}
							label="Show on Home Screen"
						/>
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ ml: 4, display: 'block' }}
						>
							Display this scene as a favorite on the home screen
						</Typography>
					</Box>

					<Divider />

					{/* Triggers Section */}
					<Box>
						<Typography variant="subtitle2" gutterBottom>
							Automation Triggers
						</Typography>
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ mb: 2, display: 'block' }}
						>
							Any trigger can fire the scene (OR logic). All conditions within a
							trigger must be met (AND logic).
						</Typography>

						{triggers.length === 0 ? (
							<Typography
								variant="body2"
								color="text.secondary"
								sx={{ fontStyle: 'italic', mb: 2 }}
							>
								No triggers configured. Scene can only be triggered manually.
							</Typography>
						) : (
							<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
								{triggers.map((triggerWithConditions, index) => (
									<Card key={index} variant="outlined" sx={{ p: 2 }}>
										<Box
											sx={{
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'flex-start',
											}}
										>
											<Box sx={{ flexGrow: 1 }}>
												<Typography variant="body2" fontWeight="medium">
													{getTriggerLabel(triggerWithConditions)}
												</Typography>
												{triggerWithConditions.conditions &&
													triggerWithConditions.conditions.length > 0 && (
														<Box sx={{ mt: 1, pl: 2 }}>
															<Typography
																variant="caption"
																color="text.secondary"
															>
																Conditions (all must be true):
															</Typography>
															{triggerWithConditions.conditions.map(
																(condition, condIndex) => (
																	<Typography
																		key={condIndex}
																		variant="caption"
																		display="block"
																		sx={{ pl: 1 }}
																	>
																		?{' '}
																		{getConditionLabel(
																			condition
																		)}
																	</Typography>
																)
															)}
														</Box>
													)}
											</Box>
											<Box sx={{ display: 'flex', gap: 0.5 }}>
												<IconButton
													size="small"
													onClick={() => handleEditTrigger(index)}
													aria-label="Edit trigger"
												>
													<EditIcon fontSize="small" />
												</IconButton>
												<IconButton
													size="small"
													onClick={() => handleRemoveTrigger(index)}
													aria-label="Remove trigger"
												>
													<DeleteIcon fontSize="small" />
												</IconButton>
											</Box>
										</Box>
									</Card>
								))}
							</Box>
						)}

						<Button
							variant="outlined"
							startIcon={<AddIcon />}
							onClick={handleAddTrigger}
							fullWidth
						>
							Add Trigger
						</Button>
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
						actions.some(
							(a) =>
								a.cluster !== 'http-request' &&
								a.cluster !== 'notification' &&
								a.cluster !== 'room-temperature' &&
								!('deviceId' in a ? a.deviceId : false) &&
								!('groupId' in a ? a.groupId : false)
						) ||
						actions.some(
							(a) =>
								a.cluster === 'http-request' &&
								!('url' in a.action ? a.action.url : false)
						) ||
						actions.some(
							(a) =>
								a.cluster === 'notification' &&
								!('title' in a.action ? a.action.title : false) &&
								!('body' in a.action ? a.action.body : false)
						) ||
						actions.some(
							(a) =>
								a.cluster === 'room-temperature' &&
								(!('roomName' in a.action ? a.action.roomName : false) ||
									!('mode' in a.action ? a.action.mode : false) ||
									(a.action.mode === 'setTarget' &&
										!('targetTemperature' in a.action
											? a.action.targetTemperature !== undefined
											: false)))
						)
					}
				>
					{props.existingScene ? 'Save' : 'Create'}
				</Button>
			</DialogActions>

			{/* Trigger Edit Dialog */}
			<TriggerEditDialog
				open={triggerDialogOpen}
				onClose={() => setTriggerDialogOpen(false)}
				onSave={handleSaveTrigger}
				trigger={editingTriggerIndex !== null ? triggers[editingTriggerIndex] : undefined}
				devices={props.devices}
				hosts={hosts}
			/>
		</Dialog>
	);
});
SceneCreateModal.displayName = 'SceneCreateModal';

// HTTP Action Config Component
interface HttpActionConfigProps {
	action: DeviceActionEntry;
	handleActionChange: (key: string, updates: Partial<DeviceActionEntry>) => void;
	handleRemoveAction: (key: string) => void;
}

const HttpActionConfig = React.memo((props: HttpActionConfigProps) => {
	const httpAction = props.action.action as {
		url: string;
		method: 'GET' | 'POST';
		body?: Record<string, unknown>;
		headers?: Record<string, string>;
	};
	const [bodyJson, setBodyJson] = React.useState<string | undefined>(
		httpAction.body ? JSON.stringify(httpAction.body, null, 2) : '{}'
	);
	const [bodyJsonError, setBodyJsonError] = React.useState<string | null>(null);

	const handleUrlChange = (url: string) => {
		props.handleActionChange(props.action.key, {
			action: { ...httpAction, url },
		});
	};

	const handleMethodChange = (_e: React.MouseEvent, method: 'GET' | 'POST' | null) => {
		if (method) {
			props.handleActionChange(props.action.key, {
				action: { ...httpAction, method },
			});
		}
	};

	// When user edits JSON text field, update value and validate
	const handleBodyFieldChange = (bodyJson: string) => {
		setBodyJson(bodyJson);
		try {
			const body = JSON.parse(bodyJson);
			props.handleActionChange(props.action.key, {
				action: { ...httpAction, body },
			});
			setBodyJsonError(null);
		} catch {
			setBodyJsonError('Invalid JSON');
		}
	};

	return (
		<Card variant="outlined">
			<CardContent>
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'flex-start',
					}}
				>
					<Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
						<Typography variant="subtitle2" color="primary">
							HTTP Request
						</Typography>

						<TextField
							label="URL"
							value={httpAction.url}
							onChange={(e) => handleUrlChange(e.target.value)}
							placeholder="https://example.com/api/endpoint"
							fullWidth
							size="small"
							required
						/>

						<ToggleButtonGroup
							value={httpAction.method}
							exclusive
							onChange={handleMethodChange}
							size="small"
							fullWidth
						>
							<ToggleButton value="GET">GET</ToggleButton>
							<ToggleButton value="POST">POST</ToggleButton>
						</ToggleButtonGroup>

						{httpAction.method === 'POST' && (
							<>
								<TextField
									label="Request Body (JSON)"
									value={bodyJson}
									onChange={(e) => handleBodyFieldChange(e.target.value)}
									placeholder='{"key": "value"}'
									fullWidth
									multiline
									rows={3}
									size="small"
									error={!!bodyJsonError}
									helperText={bodyJsonError ? bodyJsonError : undefined}
								/>
							</>
						)}
					</Box>
					<IconButton
						size="small"
						onClick={() => props.handleRemoveAction(props.action.key)}
						sx={{ ml: 1 }}
					>
						<DeleteIcon />
					</IconButton>
				</Box>
			</CardContent>
		</Card>
	);
});
HttpActionConfig.displayName = 'HttpActionConfig';

// Room Temperature Action Config Component
interface RoomTemperatureActionConfigProps {
	action: DeviceActionEntry;
	handleActionChange: (key: string, updates: Partial<DeviceActionEntry>) => void;
	handleRemoveAction: (key: string) => void;
}

interface RoomInfo {
	name: string;
	currentTemperature: number;
	targetTemperature: number;
	isHeating: boolean;
	overrideActive: boolean;
}

const RoomTemperatureActionConfig = React.memo((props: RoomTemperatureActionConfigProps) => {
	const roomTemperatureAction = props.action.action as {
		roomName: string;
		mode: 'setTarget' | 'returnToSchedule';
		targetTemperature?: number;
	};
	const [rooms, setRooms] = React.useState<RoomInfo[]>([]);
	const [loading, setLoading] = React.useState(true);

	React.useEffect(() => {
		const loadRooms = async () => {
			try {
				const response = await apiGet('temperature', '/rooms', {});
				if (response.ok) {
					const data = await response.json();
					setRooms(data.rooms || []);
				}
			} catch (error) {
				console.error('Failed to load rooms:', error);
			} finally {
				setLoading(false);
			}
		};
		void loadRooms();
	}, []);

	const handleRoomChange = (_e: unknown, newValue: RoomInfo | null) => {
		if (newValue) {
			props.handleActionChange(props.action.key, {
				action: {
					...roomTemperatureAction,
					roomName: newValue.name,
				},
			});
		}
	};

	const handleModeChange = (
		_e: React.MouseEvent,
		mode: 'setTarget' | 'returnToSchedule' | null
	) => {
		if (mode) {
			const updatedAction: typeof roomTemperatureAction = {
				...roomTemperatureAction,
				mode,
			};
			// Clear targetTemperature when switching to returnToSchedule
			if (mode === 'returnToSchedule') {
				delete updatedAction.targetTemperature;
			} else if (mode === 'setTarget' && !updatedAction.targetTemperature) {
				// Set default target temperature when switching to setTarget
				updatedAction.targetTemperature = 20;
			}
			props.handleActionChange(props.action.key, {
				action: updatedAction,
			});
		}
	};

	const handleTargetTemperatureChange = (value: number) => {
		props.handleActionChange(props.action.key, {
			action: {
				...roomTemperatureAction,
				targetTemperature: value,
			},
		});
	};

	const selectedRoom = rooms.find((r) => r.name === roomTemperatureAction.roomName) ?? null;

	return (
		<Card variant="outlined">
			<CardContent>
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'flex-start',
					}}
				>
					<Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
						<Typography variant="subtitle2" color="primary">
							Room Temperature
						</Typography>

						{loading ? (
							<CircularProgress size={24} />
						) : (
							<Autocomplete
								options={rooms}
								getOptionLabel={(option) => option.name}
								value={selectedRoom}
								onChange={handleRoomChange}
								renderInput={(params) => (
									<TextField {...params} label="Room" size="small" required />
								)}
								fullWidth
							/>
						)}

						<ToggleButtonGroup
							value={roomTemperatureAction.mode}
							exclusive
							onChange={handleModeChange}
							size="small"
							fullWidth
						>
							<ToggleButton value="setTarget">Set Target Temperature</ToggleButton>
							<ToggleButton value="returnToSchedule">Return to Schedule</ToggleButton>
						</ToggleButtonGroup>

						{roomTemperatureAction.mode === 'setTarget' && (
							<TextField
								label="Target Temperature (°C)"
								type="number"
								value={roomTemperatureAction.targetTemperature ?? 20}
								onChange={(e) => {
									const value = parseFloat(e.target.value);
									if (!Number.isNaN(value)) {
										handleTargetTemperatureChange(value);
									}
								}}
								inputProps={{ min: 5, max: 30, step: 0.5 }}
								fullWidth
								size="small"
								required
							/>
						)}
					</Box>
					<IconButton
						size="small"
						onClick={() => props.handleRemoveAction(props.action.key)}
						sx={{ ml: 1 }}
					>
						<DeleteIcon />
					</IconButton>
				</Box>
			</CardContent>
		</Card>
	);
});
RoomTemperatureActionConfig.displayName = 'RoomTemperatureActionConfig';

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

const ActionConfig = React.memo((props: ActionConfigProps) => {
	const targetType = props.action.targetType || 'device';
	const isGroup = targetType === 'group';

	const devices = React.useMemo(() => {
		const getDeviceById = (deviceId: string) => {
			return props.devices.find((d) => d.uniqueId === deviceId);
		};

		const devices: DeviceListWithValuesResponse[number][] = [];
		if (props.group) {
			devices.push(
				...props.group.deviceIds.map(getDeviceById).filter((d) => d !== undefined)
			);
		} else {
			const deviceId = 'deviceId' in props.action ? props.action.deviceId : undefined;
			const device = getDeviceById(deviceId || '');
			if (device) {
				devices.push(device);
			}
		}
		return devices;
	}, [props.group, props.action, props.devices]);

	// Get available clusters based on whether it's a device or group
	const availableClusters: DashboardDeviceClusterWithStateMap<
		| DeviceClusterName.ON_OFF
		| DeviceClusterName.WINDOW_COVERING
		| DeviceClusterName.COLOR_CONTROL
		| DeviceClusterName.LEVEL_CONTROL
	> = {};

	if (
		props.action.cluster === 'http-request' ||
		props.action.cluster === 'notification' ||
		props.action.cluster === 'room-temperature'
	) {
		return null;
	}

	if (!isGroup) {
		// For devices, get clusters from the device
		for (const device of devices) {
			for (const cluster of device.mergedAllClusters ?? []) {
				if (cluster.name === DeviceClusterName.COLOR_CONTROL) {
					// @ts-ignore
					availableClusters[cluster.name] = cluster;
					if (
						cluster.clusterVariant === 'xy' &&
						cluster.mergedClusters?.[DeviceClusterName.LEVEL_CONTROL]
					) {
						// @ts-ignore
						availableClusters[DeviceClusterName.LEVEL_CONTROL] =
							cluster.mergedClusters[DeviceClusterName.LEVEL_CONTROL];
					}
					if (
						cluster.clusterVariant === 'xy' &&
						cluster.mergedClusters?.[DeviceClusterName.ON_OFF]
					) {
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
		for (const device of devices) {
			for (const cluster of device.mergedAllClusters ?? []) {
				if (cluster.name === DeviceClusterName.COLOR_CONTROL) {
					clusterMap[cluster.name] ??= [];
					clusterMap[cluster.name]!.push(cluster);
					if (
						cluster.clusterVariant === 'xy' &&
						cluster.mergedClusters?.[DeviceClusterName.LEVEL_CONTROL]
					) {
						clusterMap[DeviceClusterName.LEVEL_CONTROL] ??= [];
						clusterMap[DeviceClusterName.LEVEL_CONTROL].push(
							cluster.mergedClusters[DeviceClusterName.LEVEL_CONTROL]
						);
					}
					if (
						cluster.clusterVariant === 'xy' &&
						cluster.mergedClusters?.[DeviceClusterName.ON_OFF]
					) {
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
			if (clusterMap[clusterName as keyof typeof clusterMap]!.length === devices.length) {
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
								value={devices[0] ?? null}
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
						devices.length > 0 &&
						Object.keys(availableClusters).length > 0) ||
						(isGroup && props.group)) && (
						<>
							{isGroup && props.group ? (
								<Autocomplete<DeviceClusterName>
									options={props.getGroupCommonClusters(props.group.id)}
									getOptionLabel={(option) => option}
									value={(() => {
										const cluster = props.action.cluster;
										const validClusters = props.getGroupCommonClusters(
											props.group.id
										);
										return cluster &&
											typeof cluster === 'string' &&
											validClusters.includes(cluster as DeviceClusterName)
											? (cluster as DeviceClusterName)
											: null;
									})()}
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
											| DashboardDeviceClusterColorControlXY
											| DashboardDeviceClusterOnOff
										)[]
									}
									getOptionLabel={(option) => option.name}
									value={
										props.action.cluster &&
										props.action.cluster in availableClusters
											? ((availableClusters[props.action.cluster] as
													| DashboardDeviceClusterLevelControl
													| DashboardDeviceClusterWindowCovering
													| DashboardDeviceClusterColorControlXY
													| DashboardDeviceClusterOnOff) ?? null)
											: null
									}
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

							{/* Device Exclusions for Groups */}
							{isGroup &&
								props.group &&
								props.action.cluster &&
								'excludeDeviceIds' in props.action && (
									<Autocomplete
										multiple
										options={props.group.deviceIds
											.map((id: string) =>
												props.devices.find((d) => d.uniqueId === id)
											)
											.filter(
												(d): d is NonNullable<typeof d> => d !== undefined
											)}
										getOptionLabel={(option) => option.name}
										value={
											props.action.excludeDeviceIds
												?.map((id: string) =>
													props.devices.find((d) => d.uniqueId === id)
												)
												.filter(
													(d): d is NonNullable<typeof d> =>
														d !== undefined
												) ?? []
										}
										onChange={(_e, newValue) => {
											props.handleActionChange(props.action.key, {
												excludeDeviceIds: newValue.map((d) => d.uniqueId),
											});
										}}
										renderInput={(params) => (
											<TextField
												{...params}
												label="Exclude Devices (Optional)"
												size="small"
											/>
										)}
										sx={{ mt: 1 }}
									/>
								)}

							{/* Action Configuration */}
							<ClusterActionControls
								action={props.action}
								actionKey={props.action.key}
								isGroup={isGroup}
								availableClusters={availableClusters}
								availablePalettes={props.availablePalettes}
								onActionChange={props.handleActionChange}
							/>
						</>
					)}
				</Box>
			</CardContent>
		</Card>
	);
});
ActionConfig.displayName = 'ActionConfig';
