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
	type ListItemProps,
	type TextFieldProps,
} from '@mui/material';
import type {
	DashboardDeviceClusterOnOff,
	DashboardDeviceClusterLevelControl,
	DashboardDeviceClusterColorControl,
	DashboardDeviceClusterWindowCovering,
	DashboardDeviceClusterWithStateMap,
	DeviceListWithValuesResponse,
	DashboardDeviceClusterWithState,
} from '../../../server/modules/device/routing';
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
				label = `Motion detected: ${device?.name || trigger.deviceId}`;
			} else if (trigger.type === SceneTriggerType.BUTTON_PRESS) {
				const device = props.devices.find((d) => d.uniqueId === trigger.deviceId);
				label = `Button pressed: ${device?.name || trigger.deviceId}`;
				if (trigger.buttonIndex !== undefined) {
					label += ` (Button ${trigger.buttonIndex + 1})`;
				}
			} else if (trigger.type === SceneTriggerType.HOST_ARRIVAL) {
				const host = hosts.find((h) => h.name === trigger.hostId);
				label = `${host?.name || trigger.hostId} arrives home`;
			} else if (trigger.type === SceneTriggerType.HOST_DEPARTURE) {
				const host = hosts.find((h) => h.name === trigger.hostId);
				label = `${host?.name || trigger.hostId} leaves home`;
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

								const group = action.groupId
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

							<Box sx={{ display: 'flex', gap: 1 }}>
								<Button
									variant="outlined"
									startIcon={<AddIcon />}
									onClick={handleAddAction}
									fullWidth
								>
									Add Device Action
								</Button>
								<Button
									variant="outlined"
									startIcon={<AddIcon />}
									onClick={handleAddHttpAction}
									fullWidth
								>
									Add HTTP Request
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
																		•{' '}
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
								!('deviceId' in a ? a.deviceId : false) &&
								!('groupId' in a ? a.groupId : false)
						) ||
						actions.some(
							(a) =>
								a.cluster === 'http-request' &&
								!('url' in a.action ? a.action.url : false)
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

	const handleBodyChange = (bodyJson: string) => {
		try {
			const body = JSON.parse(bodyJson);
			props.handleActionChange(props.action.key, {
				action: { ...httpAction, body },
			});
		} catch {
			// Invalid JSON, don't update
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
							<TextField
								label="Request Body (JSON)"
								value={
									httpAction.body
										? JSON.stringify(httpAction.body, null, 2)
										: '{}'
								}
								onChange={(e) => handleBodyChange(e.target.value)}
								placeholder='{"key": "value"}'
								fullWidth
								multiline
								rows={3}
								size="small"
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
HttpActionConfig.displayName = 'HttpActionConfig';

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

	// Handle HTTP request cluster separately (not a device cluster)
	if (props.action.cluster === 'http-request') {
		return null;
	}

	if (!isGroup) {
		// For devices, get clusters from the device
		for (const device of devices) {
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
		for (const device of devices) {
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
