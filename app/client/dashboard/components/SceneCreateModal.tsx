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
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type { Scene, SceneDeviceAction } from '../../../../types/scene';
import * as Icons from '@mui/icons-material';
import React, { useState } from 'react';

interface SceneCreateModalProps {
	open: boolean;
	onClose: () => void;
	onSave: (scene: Omit<Scene, 'id'>) => void;
	devices: DeviceListWithValuesResponse;
	existingScene?: Scene;
}

type DeviceActionEntry = SceneDeviceAction & { key: string };

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

	const [title, setTitle] = useState(props.existingScene?.title ?? '');
	const [selectedIcon, setSelectedIcon] = useState<keyof typeof Icons>(
		props.existingScene?.icon ?? 'Star'
	);
	const [actions, setActions] = useState<DeviceActionEntry[]>(
		props.existingScene?.actions.map((action, index) => ({
			...action,
			key: `${action.deviceId}-${action.cluster}-${index}`,
		})) ?? []
	);
	const [enableTrigger, setEnableTrigger] = useState(!!props.existingScene?.trigger);
	const [triggerDeviceId, setTriggerDeviceId] = useState<string | null>(
		props.existingScene?.trigger?.deviceId ?? null
	);

	const IconComponent = Icons[selectedIcon];

	// Get devices with OnOff or WindowCovering clusters
	const availableDevices = React.useMemo(() => {
		return props.devices.filter((device) =>
			device.allClusters.some(
				(cluster) =>
					cluster.name === DeviceClusterName.ON_OFF ||
					cluster.name === DeviceClusterName.WINDOW_COVERING
			)
		);
	}, [props.devices]);

	// Get devices with occupancy sensors for triggers
	const occupancyDevices = React.useMemo(() => {
		return props.devices.filter((device) =>
			device.allClusters.some(
				(cluster) => cluster.name === DeviceClusterName.OCCUPANCY_SENSING
			)
		);
	}, [props.devices]);

	const handleAddAction = () => {
		const newAction: DeviceActionEntry = {
			deviceId: '',
			cluster: DeviceClusterName.ON_OFF,
			action: { isOn: true },
			key: `new-${Date.now()}`,
		};
		setActions([...actions, newAction]);
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
						}
					}
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					return { ...action, ...updates } as any;
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
		if (actions.some((action) => !action.deviceId)) {
			return;
		}

		const scene: Omit<Scene, 'id'> = {
			title: title.trim(),
			icon: selectedIcon,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			actions: actions.map(({ key: _key, ...action }) => action),
			trigger:
				enableTrigger && triggerDeviceId
					? { type: 'occupancy', deviceId: triggerDeviceId }
					: undefined,
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
								const device = getDeviceById(action.deviceId);
								const availableClusters = device?.allClusters.filter(
									(c) =>
										c.name === DeviceClusterName.ON_OFF ||
										c.name === DeviceClusterName.WINDOW_COVERING
								);

								return (
									<Card key={action.key} variant="outlined">
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
													<Typography
														variant="body2"
														sx={{ minWidth: 60 }}
													>
														#{index + 1}
													</Typography>
													<Autocomplete
														options={availableDevices}
														getOptionLabel={(option) => option.name}
														value={device ?? null}
														onChange={(_e, newValue) => {
															if (newValue) {
																handleActionChange(action.key, {
																	deviceId: newValue.uniqueId,
																});
															}
														}}
														renderInput={(params) => (
															<TextField
																{...params}
																label="Device"
																size="small"
															/>
														)}
														sx={{ flex: 1 }}
													/>
													<IconButton
														size="small"
														onClick={() =>
															handleRemoveAction(action.key)
														}
														color="error"
													>
														<DeleteIcon />
													</IconButton>
												</Box>

												{device &&
													availableClusters &&
													availableClusters.length > 0 && (
														<>
															<Autocomplete
																options={availableClusters}
																getOptionLabel={(option) =>
																	option.name
																}
																value={
																	availableClusters.find(
																		(c) =>
																			c.name ===
																			action.cluster
																	) ?? null
																}
																onChange={(_e, newValue) => {
																	if (newValue) {
																		handleActionChange(
																			action.key,
																			{
																				cluster:
																					newValue.name,
																			}
																		);
																	}
																}}
																renderInput={(params) => (
																	<TextField
																		{...params}
																		label="Cluster"
																		size="small"
																	/>
																)}
															/>

															{/* Action Configuration */}
															{action.cluster ===
																DeviceClusterName.ON_OFF && (
																<FormControlLabel
																	control={
																		<Switch
																			checked={
																				(
																					action.action as {
																						isOn: boolean;
																					}
																				).isOn
																			}
																			onChange={(e) =>
																				handleActionChange(
																					action.key,
																					{
																						action: {
																							isOn: e
																								.target
																								.checked,
																						},
																					}
																				)
																			}
																		/>
																	}
																	label={
																		(
																			action.action as {
																				isOn: boolean;
																			}
																		).isOn
																			? 'Turn On'
																			: 'Turn Off'
																	}
																/>
															)}

															{action.cluster ===
																DeviceClusterName.WINDOW_COVERING && (
																<Box>
																	<Typography
																		variant="body2"
																		gutterBottom
																	>
																		Position:{' '}
																		{
																			(
																				action.action as {
																					targetPositionLiftPercentage: number;
																				}
																			)
																				.targetPositionLiftPercentage
																		}
																		%
																	</Typography>
																	<Slider
																		value={
																			(
																				action.action as {
																					targetPositionLiftPercentage: number;
																				}
																			)
																				.targetPositionLiftPercentage
																		}
																		onChange={(_e, value) =>
																			handleActionChange(
																				action.key,
																				{
																					action: {
																						targetPositionLiftPercentage:
																							value,
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
										</CardContent>
									</Card>
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
										}
									}}
								/>
							}
							label="Enable Trigger"
						/>

						{enableTrigger && (
							<Box sx={{ mt: 2 }}>
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
								<Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
									Scene will trigger when occupancy is detected
								</Typography>
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
						!title.trim() || actions.length === 0 || actions.some((a) => !a.deviceId)
					}
				>
					{props.existingScene ? 'Save' : 'Create'}
				</Button>
			</DialogActions>
		</Dialog>
	);
};
