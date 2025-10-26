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
	ToggleButtonGroup,
	ToggleButton,
	Autocomplete,
	Card,
	Divider,
	Switch,
	FormControlLabel,
	useMediaQuery,
	useTheme,
	Alert,
} from '@mui/material';
import type {
	DeviceListWithValuesResponse,
	DashboardDeviceClusterSwitch,
} from '../../../server/modules/device/routing';
import type {
	SceneTriggerWithConditions,
	SceneTrigger,
	SceneCondition,
} from '../../../../types/scene';
import { Delete as DeleteIcon, Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import { SceneTriggerType, SceneConditionType } from '../../../../types/scene';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type { Host } from '../../../server/modules/home-detector/routing';
import type { Webhook } from '../../../server/modules/webhook/types';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers';
import React, { useState, useEffect } from 'react';
import { TimePicker } from '@mui/x-date-pickers';
import { apiGet } from '../../lib/fetch';

interface TriggerEditDialogProps {
	open: boolean;
	onClose: () => void;
	onSave: (trigger: SceneTriggerWithConditions) => void;
	trigger?: SceneTriggerWithConditions;
	devices: DeviceListWithValuesResponse;
	hosts: Host[];
}

type TriggerType = SceneTriggerType;
type ConditionType = SceneConditionType;

// Helper functions to convert between HH:MM strings and Date objects
const timeStringToDate = (timeStr: string): Date => {
	const [hours, minutes] = timeStr.split(':').map(Number);
	const date = new Date();
	date.setHours(hours, minutes, 0, 0);
	return date;
};

const dateToTimeString = (date: Date | null): string => {
	if (!date) {
		return '09:00';
	}
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
	return `${hours}:${minutes}`;
};

export const TriggerEditDialog = (props: TriggerEditDialogProps): JSX.Element => {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
	const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

	// Trigger state
	const [triggerType, setTriggerType] = useState<TriggerType>(SceneTriggerType.OCCUPANCY);
	const [triggerDeviceId, setTriggerDeviceId] = useState<string>('');
	const [triggerButtonIndex, setTriggerButtonIndex] = useState<number | undefined>(undefined);
	const [triggerHostId, setTriggerHostId] = useState<string>('');
	const [triggerWebhookName, setTriggerWebhookName] = useState<string>('');

	// Webhooks
	const [webhooks, setWebhooks] = useState<Webhook[]>([]);

	// Conditions state
	const [conditions, setConditions] = useState<SceneCondition[]>([]);

	// Condition editor state
	const [addingCondition, setAddingCondition] = useState(false);
	const [conditionType, setConditionType] = useState<ConditionType>(SceneConditionType.HOST_HOME);
	const [conditionHostId, setConditionHostId] = useState<string>('');
	const [conditionDeviceId, setConditionDeviceId] = useState<string>('');
	const [conditionShouldBeHome, setConditionShouldBeHome] = useState(true);
	const [conditionShouldBeOn, setConditionShouldBeOn] = useState(true);

	// Time window state
	type DayOfWeek =
		| 'monday'
		| 'tuesday'
		| 'wednesday'
		| 'thursday'
		| 'friday'
		| 'saturday'
		| 'sunday';
	const [timeWindowDays, setTimeWindowDays] = useState<Record<DayOfWeek, boolean>>({
		monday: false,
		tuesday: false,
		wednesday: false,
		thursday: false,
		friday: false,
		saturday: false,
		sunday: false,
	});
	const [timeWindowStart, setTimeWindowStart] = useState<Record<DayOfWeek, string>>({
		monday: '09:00',
		tuesday: '09:00',
		wednesday: '09:00',
		thursday: '09:00',
		friday: '09:00',
		saturday: '09:00',
		sunday: '09:00',
	});
	const [timeWindowEnd, setTimeWindowEnd] = useState<Record<DayOfWeek, string>>({
		monday: '17:00',
		tuesday: '17:00',
		wednesday: '17:00',
		thursday: '17:00',
		friday: '17:00',
		saturday: '17:00',
		sunday: '17:00',
	});

	// Validation
	const [errors, setErrors] = useState<string[]>([]);

	// Initialize from existing trigger
	useEffect(() => {
		if (props.open && props.trigger) {
			const trigger = props.trigger.trigger;
			setTriggerType(trigger.type);

			if (trigger.type === SceneTriggerType.OCCUPANCY) {
				setTriggerDeviceId(trigger.deviceId);
			} else if (trigger.type === SceneTriggerType.BUTTON_PRESS) {
				setTriggerDeviceId(trigger.deviceId);
				setTriggerButtonIndex(trigger.buttonIndex);
			} else if (trigger.type === SceneTriggerType.HOST_ARRIVAL) {
				setTriggerHostId(trigger.hostId);
			} else if (trigger.type === SceneTriggerType.HOST_DEPARTURE) {
				setTriggerHostId(trigger.hostId);
			} else if (trigger.type === SceneTriggerType.WEBHOOK) {
				setTriggerWebhookName(trigger.webhookName);
			}

			setConditions(props.trigger.conditions || []);
		} else if (props.open) {
			// Reset for new trigger
			setTriggerType(SceneTriggerType.OCCUPANCY);
			setTriggerDeviceId('');
			setTriggerButtonIndex(undefined);
			setTriggerHostId('');
			setTriggerWebhookName('');
			setConditions([]);
		}
		setErrors([]);
		setAddingCondition(false);
	}, [props.open, props.trigger]);

	// Load webhooks
	useEffect(() => {
		if (props.open) {
			const fetchWebhooks = async () => {
				try {
					const response = await apiGet('webhook', '/list', {});
					if (response.ok) {
						const data = await response.json();
						setWebhooks(data.webhooks);
					}
				} catch (error) {
					console.error('Failed to load webhooks:', error);
				}
			};
			void fetchWebhooks();
		}
	}, [props.open]);

	// Get filtered device lists
	const occupancyDevices = React.useMemo(() => {
		return props.devices.filter((device) =>
			device.mergedAllClusters.some(
				(cluster) => cluster.name === DeviceClusterName.OCCUPANCY_SENSING
			)
		);
	}, [props.devices]);

	const buttonDevices = React.useMemo(() => {
		return props.devices.filter((device) =>
			device.mergedAllClusters.some((cluster) => cluster.name === DeviceClusterName.SWITCH)
		);
	}, [props.devices]);

	const onOffDevices = React.useMemo(() => {
		return props.devices.filter((device) =>
			device.mergedAllClusters.some((cluster) => {
				// Check if it's a direct OnOff cluster
				if (cluster.name === DeviceClusterName.ON_OFF) {
					return true;
				}
				// Check if OnOff is merged into ColorControl
				if (
					cluster.name === DeviceClusterName.COLOR_CONTROL &&
					'mergedClusters' in cluster
				) {
					return !!cluster.mergedClusters[DeviceClusterName.ON_OFF];
				}
				return false;
			})
		);
	}, [props.devices]);

	// Get button count and labels for the selected device
	const selectedDeviceButtons = React.useMemo(() => {
		if (!triggerDeviceId || triggerType !== 'button-press') {
			return [];
		}
		const device = buttonDevices.find((d) => d.uniqueId === triggerDeviceId);
		if (!device) {
			return [];
		}

		// Get switch clusters with their labels from the backend
		const switchClusters = device.mergedAllClusters.filter(
			(cluster): cluster is DashboardDeviceClusterSwitch =>
				cluster.name === DeviceClusterName.SWITCH
		);

		return switchClusters.map((cluster) => ({
			index: cluster.index,
			label: cluster.label,
		}));
	}, [triggerDeviceId, triggerType, buttonDevices]);

	const handleTriggerTypeChange = (_e: React.MouseEvent, value: TriggerType | null) => {
		if (value) {
			setTriggerType(value);
			setTriggerDeviceId('');
			setTriggerHostId('');
			setTriggerButtonIndex(undefined);
			setTriggerWebhookName('');
		}
	};

	const handleAddCondition = () => {
		let newCondition: SceneCondition;

		if (conditionType === SceneConditionType.HOST_HOME) {
			newCondition = {
				type: SceneConditionType.HOST_HOME,
				hostId: conditionHostId,
				shouldBeHome: conditionShouldBeHome,
			};
		} else if (conditionType === SceneConditionType.DEVICE_ON) {
			newCondition = {
				type: SceneConditionType.DEVICE_ON,
				deviceId: conditionDeviceId,
				shouldBeOn: conditionShouldBeOn,
			};
		} else {
			// TIME_WINDOW
			const windows: Record<string, { start: string; end: string }> = {};
			const days: DayOfWeek[] = [
				'monday',
				'tuesday',
				'wednesday',
				'thursday',
				'friday',
				'saturday',
				'sunday',
			];
			for (const day of days) {
				if (timeWindowDays[day]) {
					windows[day] = {
						start: timeWindowStart[day],
						end: timeWindowEnd[day],
					};
				}
			}
			newCondition = {
				type: SceneConditionType.TIME_WINDOW,
				windows,
			};
		}

		setConditions([...conditions, newCondition]);
		setAddingCondition(false);
		setConditionHostId('');
		setConditionDeviceId('');
		setConditionShouldBeHome(true);
		setConditionShouldBeOn(true);
		// Reset time window state
		setTimeWindowDays({
			monday: false,
			tuesday: false,
			wednesday: false,
			thursday: false,
			friday: false,
			saturday: false,
			sunday: false,
		});
	};

	const handleRemoveCondition = (index: number) => {
		setConditions(conditions.filter((_, i) => i !== index));
	};

	const getConditionLabel = (condition: SceneCondition): string => {
		if (condition.type === SceneConditionType.HOST_HOME) {
			const host = props.hosts.find((h) => h.name === condition.hostId);
			return `${host?.name || condition.hostId} is ${condition.shouldBeHome ? 'home' : 'away'}`;
		} else if (condition.type === SceneConditionType.DEVICE_ON) {
			const device = props.devices.find((d) => d.uniqueId === condition.deviceId);
			return `${device?.name || condition.deviceId} is ${condition.shouldBeOn ? 'on' : 'off'}`;
		} else if (condition.type === SceneConditionType.TIME_WINDOW) {
			const dayAbbr: Record<string, string> = {
				monday: 'Mon',
				tuesday: 'Tue',
				wednesday: 'Wed',
				thursday: 'Thu',
				friday: 'Fri',
				saturday: 'Sat',
				sunday: 'Sun',
			};

			const windows = condition.windows;
			const entries = Object.entries(windows);

			if (entries.length === 0) {
				return 'Time window (no days configured)';
			}

			// Group consecutive days with the same time window
			const groups: Array<{ days: string[]; window: { start: string; end: string } }> = [];
			for (const [day, window] of entries) {
				const lastGroup = groups[groups.length - 1];
				if (
					lastGroup &&
					lastGroup.window.start === window.start &&
					lastGroup.window.end === window.end
				) {
					lastGroup.days.push(dayAbbr[day]);
				} else {
					groups.push({ days: [dayAbbr[day]], window });
				}
			}

			// Format groups
			const formatted = groups.map((group) => {
				const dayRange =
					group.days.length > 1
						? `${group.days[0]}-${group.days[group.days.length - 1]}`
						: group.days[0];
				return `${dayRange} ${group.window.start}-${group.window.end}`;
			});

			return formatted.join(', ');
		}
		return '';
	};

	const validate = (): boolean => {
		const newErrors: string[] = [];

		// Validate trigger
		if (
			triggerType === SceneTriggerType.OCCUPANCY ||
			triggerType === SceneTriggerType.BUTTON_PRESS
		) {
			if (!triggerDeviceId) {
				newErrors.push('Please select a device for the trigger');
			}
		} else if (
			triggerType === SceneTriggerType.HOST_ARRIVAL ||
			triggerType === SceneTriggerType.HOST_DEPARTURE
		) {
			if (!triggerHostId) {
				newErrors.push('Please select a host for the trigger');
			}
		} else if (triggerType === SceneTriggerType.WEBHOOK) {
			if (!triggerWebhookName) {
				newErrors.push('Please select a webhook for the trigger');
			}
		}

		setErrors(newErrors);
		return newErrors.length === 0;
	};

	const handleSave = () => {
		if (!validate()) {
			return;
		}

		let trigger: SceneTrigger;

		if (triggerType === SceneTriggerType.OCCUPANCY) {
			trigger = {
				type: SceneTriggerType.OCCUPANCY,
				deviceId: triggerDeviceId,
			};
		} else if (triggerType === SceneTriggerType.BUTTON_PRESS) {
			trigger = {
				type: SceneTriggerType.BUTTON_PRESS,
				deviceId: triggerDeviceId,
				buttonIndex: triggerButtonIndex ?? 0,
			};
		} else if (triggerType === SceneTriggerType.HOST_ARRIVAL) {
			trigger = {
				type: SceneTriggerType.HOST_ARRIVAL,
				hostId: triggerHostId,
			};
		} else if (triggerType === SceneTriggerType.HOST_DEPARTURE) {
			trigger = {
				type: SceneTriggerType.HOST_DEPARTURE,
				hostId: triggerHostId,
			};
		} else {
			trigger = {
				type: SceneTriggerType.WEBHOOK,
				webhookName: triggerWebhookName,
			};
		}

		const triggerWithConditions: SceneTriggerWithConditions = {
			trigger,
			conditions: conditions.length > 0 ? conditions : undefined,
		};

		props.onSave(triggerWithConditions);
	};

	const canAddCondition =
		(conditionType === SceneConditionType.HOST_HOME && conditionHostId) ||
		(conditionType === SceneConditionType.DEVICE_ON && conditionDeviceId) ||
		(conditionType === SceneConditionType.TIME_WINDOW &&
			Object.values(timeWindowDays).some((enabled) => enabled));

	return (
		<LocalizationProvider dateAdapter={AdapterDateFns}>
			<Dialog
				open={props.open}
				onClose={props.onClose}
				maxWidth="md"
				fullWidth
				fullScreen={fullScreen}
			>
				<DialogTitle>
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
						}}
					>
						<Typography variant="h6">
							{props.trigger ? 'Edit Trigger' : 'Add Trigger'}
						</Typography>
						<IconButton onClick={props.onClose} size="small">
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>

				<DialogContent>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
						{/* Errors */}
						{errors.length > 0 && (
							<Alert severity="error">
								{errors.map((error, i) => (
									<Typography key={i} variant="body2">
										{error}
									</Typography>
								))}
							</Alert>
						)}

						{/* Trigger Configuration */}
						<Box>
							<Typography variant="subtitle1" fontWeight="medium" gutterBottom>
								Trigger
							</Typography>
							<Typography
								variant="caption"
								color="text.secondary"
								sx={{ mb: 2, display: 'block' }}
							>
								Select what event will trigger this scene
							</Typography>

							<ToggleButtonGroup
								value={triggerType}
								exclusive
								onChange={handleTriggerTypeChange}
								fullWidth
								size="small"
								sx={{ mb: 2 }}
							>
								<ToggleButton value={SceneTriggerType.OCCUPANCY}>
									Occupancy
								</ToggleButton>
								<ToggleButton value={SceneTriggerType.BUTTON_PRESS}>
									Button
								</ToggleButton>
								<ToggleButton value={SceneTriggerType.WEBHOOK}>
									Webhook
								</ToggleButton>
								<ToggleButton value={SceneTriggerType.HOST_ARRIVAL}>
									Arrival
								</ToggleButton>
								<ToggleButton value={SceneTriggerType.HOST_DEPARTURE}>
									Departure
								</ToggleButton>
							</ToggleButtonGroup>

							{/* Occupancy trigger */}
							{triggerType === SceneTriggerType.OCCUPANCY && (
								<Autocomplete
									options={occupancyDevices}
									getOptionLabel={(option) => option.name}
									value={
										occupancyDevices.find(
											(d) => d.uniqueId === triggerDeviceId
										) ?? null
									}
									onChange={(_e, newValue) => {
										setTriggerDeviceId(newValue?.uniqueId ?? '');
									}}
									renderInput={(params) => (
										<TextField {...params} label="Occupancy Sensor" required />
									)}
								/>
							)}

							{/* Button press trigger */}
							{triggerType === SceneTriggerType.BUTTON_PRESS && (
								<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
									<Autocomplete
										options={buttonDevices}
										getOptionLabel={(option) => option.name}
										value={
											buttonDevices.find(
												(d) => d.uniqueId === triggerDeviceId
											) ?? null
										}
										onChange={(_e, newValue) => {
											setTriggerDeviceId(newValue?.uniqueId ?? '');
											setTriggerButtonIndex(undefined);
										}}
										renderInput={(params) => (
											<TextField {...params} label="Button Device" required />
										)}
									/>
									{triggerDeviceId && selectedDeviceButtons.length > 0 && (
										<Autocomplete
											options={selectedDeviceButtons}
											getOptionLabel={(option) => option.label}
											value={
												selectedDeviceButtons.find(
													(b) => b.index === triggerButtonIndex
												) ?? null
											}
											onChange={(_e, newValue) => {
												setTriggerButtonIndex(
													newValue !== null ? newValue.index : undefined
												);
											}}
											renderInput={(params) => (
												<TextField
													{...params}
													label="Button"
													helperText="Optional: Leave empty to trigger on any button"
												/>
											)}
										/>
									)}
								</Box>
							)}

							{/* Host arrival trigger */}
							{triggerType === SceneTriggerType.HOST_ARRIVAL && (
								<Autocomplete
									options={props.hosts}
									getOptionLabel={(option) => option.name}
									value={
										props.hosts.find((h) => h.name === triggerHostId) ?? null
									}
									onChange={(_e, newValue) => {
										setTriggerHostId(newValue?.name ?? '');
									}}
									renderInput={(params) => (
										<TextField {...params} label="Host" required />
									)}
								/>
							)}

							{/* Host departure trigger */}
							{triggerType === SceneTriggerType.HOST_DEPARTURE && (
								<Autocomplete
									options={props.hosts}
									getOptionLabel={(option) => option.name}
									value={
										props.hosts.find((h) => h.name === triggerHostId) ?? null
									}
									onChange={(_e, newValue) => {
										setTriggerHostId(newValue?.name ?? '');
									}}
									renderInput={(params) => (
										<TextField {...params} label="Host" required />
									)}
								/>
							)}

							{/* Webhook trigger */}
							{triggerType === SceneTriggerType.WEBHOOK && (
								<Autocomplete<Webhook>
									options={webhooks}
									getOptionLabel={(option) => option.name}
									value={
										webhooks.find((w) => w.name === triggerWebhookName) ?? null
									}
									onChange={(_e, newValue) => {
										setTriggerWebhookName(newValue?.name ?? '');
									}}
									renderInput={(params) => (
										<TextField {...params} label="Webhook" required />
									)}
								/>
							)}
						</Box>

						<Divider />

						{/* Conditions */}
						<Box>
							<Typography variant="subtitle1" fontWeight="medium" gutterBottom>
								Conditions (Optional)
							</Typography>
							<Typography
								variant="caption"
								color="text.secondary"
								sx={{ mb: 2, display: 'block' }}
							>
								All conditions must be true for the trigger to fire (AND logic)
							</Typography>

							{/* Condition list */}
							{conditions.length > 0 && (
								<Box
									sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}
								>
									{conditions.map((condition, index) => (
										<Card key={index} variant="outlined" sx={{ p: 1.5 }}>
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'center',
												}}
											>
												<Typography variant="body2">
													{getConditionLabel(condition)}
												</Typography>
												<IconButton
													size="small"
													onClick={() => handleRemoveCondition(index)}
												>
													<DeleteIcon fontSize="small" />
												</IconButton>
											</Box>
										</Card>
									))}
								</Box>
							)}

							{/* Add condition section */}
							{!addingCondition ? (
								<Button
									variant="outlined"
									startIcon={<AddIcon />}
									onClick={() => setAddingCondition(true)}
									fullWidth
								>
									Add Condition
								</Button>
							) : (
								<Card variant="outlined" sx={{ p: 2 }}>
									<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
										<Typography variant="subtitle2">New Condition</Typography>

										<ToggleButtonGroup
											value={conditionType}
											exclusive
											onChange={(_e, value) => {
												if (value) {
													setConditionType(value);
												}
											}}
											fullWidth
											size="small"
										>
											<ToggleButton value={SceneConditionType.HOST_HOME}>
												Host Home/Away
											</ToggleButton>
											<ToggleButton value={SceneConditionType.DEVICE_ON}>
												Device On/Off
											</ToggleButton>
											<ToggleButton value={SceneConditionType.TIME_WINDOW}>
												Time Window
											</ToggleButton>
										</ToggleButtonGroup>

										{conditionType === SceneConditionType.HOST_HOME && (
											<>
												<Autocomplete
													options={props.hosts}
													getOptionLabel={(option) => option.name}
													value={
														props.hosts.find(
															(h) => h.name === conditionHostId
														) ?? null
													}
													onChange={(_e, newValue) => {
														setConditionHostId(newValue?.name ?? '');
													}}
													renderInput={(params) => (
														<TextField
															{...params}
															label="Host"
															required
														/>
													)}
												/>
												<FormControlLabel
													control={
														<Switch
															checked={conditionShouldBeHome}
															onChange={(e) =>
																setConditionShouldBeHome(
																	e.target.checked
																)
															}
														/>
													}
													label={
														conditionShouldBeHome
															? 'Must be home'
															: 'Must be away'
													}
												/>
											</>
										)}

										{conditionType === SceneConditionType.DEVICE_ON && (
											<>
												<Autocomplete
													options={onOffDevices}
													getOptionLabel={(option) => option.name}
													value={
														onOffDevices.find(
															(d) => d.uniqueId === conditionDeviceId
														) ?? null
													}
													onChange={(_e, newValue) => {
														setConditionDeviceId(
															newValue?.uniqueId ?? ''
														);
													}}
													renderInput={(params) => (
														<TextField
															{...params}
															label="Device"
															required
														/>
													)}
												/>
												<FormControlLabel
													control={
														<Switch
															checked={conditionShouldBeOn}
															onChange={(e) =>
																setConditionShouldBeOn(
																	e.target.checked
																)
															}
														/>
													}
													label={
														conditionShouldBeOn
															? 'Must be on'
															: 'Must be off'
													}
												/>
											</>
										)}

										{conditionType === SceneConditionType.TIME_WINDOW && (
											<Box
												sx={{
													display: 'flex',
													flexDirection: 'column',
													gap: 1.5,
												}}
											>
												<Typography
													variant="caption"
													color="text.secondary"
												>
													Enable days and set time windows. Days without a
													window are allowed all day.
												</Typography>

												{(
													[
														'monday',
														'tuesday',
														'wednesday',
														'thursday',
														'friday',
														'saturday',
														'sunday',
													] as DayOfWeek[]
												).map((day) => {
													const dayLabel =
														day.charAt(0).toUpperCase() + day.slice(1);
													return (
														<Box
															key={day}
															sx={{
																display: 'flex',
																alignItems: 'center',
																gap: 1,
																flexWrap: 'wrap',
															}}
														>
															<FormControlLabel
																control={
																	<Switch
																		checked={
																			timeWindowDays[day]
																		}
																		onChange={(e) =>
																			setTimeWindowDays({
																				...timeWindowDays,
																				[day]: e.target
																					.checked,
																			})
																		}
																		size="small"
																	/>
																}
																label={dayLabel}
																sx={{ minWidth: 120 }}
															/>
															{timeWindowDays[day] && (
																<>
																	<TimePicker
																		label="Start"
																		value={timeStringToDate(
																			timeWindowStart[day]
																		)}
																		onChange={(
																			newValue: Date | null
																		) => {
																			setTimeWindowStart({
																				...timeWindowStart,
																				[day]: dateToTimeString(
																					newValue
																				),
																			});
																		}}
																		ampm={false}
																		slotProps={{
																			textField: {
																				size: 'small',
																				sx: { width: 130 },
																			},
																		}}
																	/>
																	<Typography
																		variant="body2"
																		color="text.secondary"
																	>
																		to
																	</Typography>
																	<TimePicker
																		label="End"
																		value={timeStringToDate(
																			timeWindowEnd[day]
																		)}
																		onChange={(
																			newValue: Date | null
																		) => {
																			setTimeWindowEnd({
																				...timeWindowEnd,
																				[day]: dateToTimeString(
																					newValue
																				),
																			});
																		}}
																		ampm={false}
																		slotProps={{
																			textField: {
																				size: 'small',
																				sx: { width: 130 },
																			},
																		}}
																	/>
																	{timeWindowStart[day] >
																		timeWindowEnd[day] && (
																		<Typography
																			variant="caption"
																			color="warning.main"
																			sx={{ ml: 1 }}
																		>
																			(overnight)
																		</Typography>
																	)}
																</>
															)}
														</Box>
													);
												})}
											</Box>
										)}

										<Box
											sx={{
												display: 'flex',
												gap: 1,
												justifyContent: 'flex-end',
											}}
										>
											<Button
												onClick={() => {
													setAddingCondition(false);
													setConditionHostId('');
													setConditionDeviceId('');
												}}
											>
												Cancel
											</Button>
											<Button
												variant="contained"
												onClick={handleAddCondition}
												disabled={!canAddCondition}
											>
												Add
											</Button>
										</Box>
									</Box>
								</Card>
							)}
						</Box>
					</Box>
				</DialogContent>

				<DialogActions sx={{ p: 2, gap: 1 }}>
					<Button onClick={props.onClose} fullWidth={isMobile}>
						Cancel
					</Button>
					<Button variant="contained" onClick={handleSave} fullWidth={isMobile}>
						Save Trigger
					</Button>
				</DialogActions>
			</Dialog>
		</LocalizationProvider>
	);
};
