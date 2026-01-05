import {
	Box,
	Card,
	CardContent,
	Typography,
	Button,
	CircularProgress,
	List,
	ListItem,
	ListItemText,
	ListItemSecondaryAction,
	Checkbox,
	Divider,
	Radio,
	RadioGroup,
	FormControlLabel,
	FormControl,
	IconButton,
	TextField,
	Switch,
	Chip,
	Slider,
	Select,
	MenuItem,
	InputLabel,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
} from '@mui/material';
import {
	Save as SaveIcon,
	Add as AddIcon,
	Delete as DeleteIcon,
	BugReport as BugReportIcon,
} from '@mui/icons-material';
import { TemperatureDebugDialog } from './TemperatureDebugDialog';
import { apiGet, apiPost, apiDelete } from '../../lib/fetch';
import React, { useState, useEffect } from 'react';

type TemperatureSensorConfig = string | { type: 'device'; deviceId: string };

interface AvailableSensors {
	temperatureControllers: string[];
	deviceSensors: Array<{ deviceId: string; name: string }>;
}

interface TemperatureTimeRange {
	id: string;
	name: string;
	days: number[];
	startTime: string;
	endTime: string;
	targetTemperature: number;
	enabled: boolean;
	roomExceptions?: Record<string, number>;
}

interface TemperatureState {
	id: string;
	name: string;
	timeRanges: TemperatureTimeRange[];
}

interface Room {
	name: string;
	// other properties we don't need right now
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TemperatureConfig = (): JSX.Element => {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [availableSensors, setAvailableSensors] = useState<AvailableSensors>({
		temperatureControllers: [],
		deviceSensors: [],
	});
	const [selectedSensors, setSelectedSensors] = useState<TemperatureSensorConfig[]>([]);
	const [selectedThermostat, setSelectedThermostat] = useState<string>('');
	const [availableThermostats, setAvailableThermostats] = useState<
		Array<{ deviceId: string; name: string }>
	>([]);
	const [states, setStates] = useState<TemperatureState[]>([]);
	const [savingStates, setSavingStates] = useState(false);
	const [rooms, setRooms] = useState<Room[]>([]);
	const [roomOvershoots, setRoomOvershoots] = useState<Record<string, number>>({});
	const [roomPIDParameters, setRoomPIDParameters] = useState<
		Record<
			string,
			{
				heatingRate: number;
				overshootTimeConstant: number;
				lastUpdated: number;
				measurementCount: number;
			}
		>
	>({});
	const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
	const [editingException, setEditingException] = useState<{
		stateId: string;
		rangeId: string;
		roomName: string;
		temperature: number;
	} | null>(null);
	const [debugOpen, setDebugOpen] = useState(false);

	const loadData = async () => {
		setLoading(true);
		try {
			const [
				sensorsResponse,
				configResponse,
				thermostatsResponse,
				statesResponse,
				roomsResponse,
				overshootsResponse,
			] = await Promise.all([
				apiGet('temperature', '/temperature-sensors', {}),
				apiGet('temperature', '/inside-temperature-sensors', {}),
				apiGet('temperature', '/thermostats', {}),
				apiGet('temperature', '/states', {}),
				apiGet('device', '/rooms', {}),
				apiGet('temperature', '/rooms/overshoot', {}),
			]);

			if (sensorsResponse.ok) {
				const sensorsData = await sensorsResponse.json();
				setAvailableSensors({
					temperatureControllers: sensorsData.temperatureControllers || [],
					deviceSensors: sensorsData.deviceSensors || [],
				});
			}

			if (configResponse.ok) {
				const configData = await configResponse.json();
				setSelectedSensors(configData.sensors || []);
				setSelectedThermostat(configData.thermostat || '');
			}

			if (thermostatsResponse.ok) {
				const thermostatsData = await thermostatsResponse.json();
				setAvailableThermostats(thermostatsData.thermostats || []);
			}

			if (statesResponse.ok) {
				const statesData = await statesResponse.json();
				setStates(statesData.states || []);
			}

			if (roomsResponse.ok) {
				const roomsData = await roomsResponse.json();
				const roomList = Object.values(roomsData.rooms ?? {});
				setRooms(roomList);

				// Load PID parameters for all rooms
				const pidParams: Record<string, any> = {};
				for (const room of roomList) {
					const roomName = (room as Room).name;
					try {
						const pidResponse = await apiGet(
							'temperature',
							'/room/:roomName/pid-parameters',
							{
								roomName,
							}
						);
						if (pidResponse.ok) {
							const pidData = await pidResponse.json();
							if (pidData.parameters) {
								pidParams[roomName] = pidData.parameters;
							}
						}
					} catch {
						// Room might not have PID parameters, that's okay
					}
				}
				setRoomPIDParameters(pidParams);
			}

			if (overshootsResponse.ok) {
				const overshootsData = await overshootsResponse.json();
				setRoomOvershoots(overshootsData.overshoots || {});
			}
		} catch (error) {
			console.error('Failed to load temperature configuration:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadData();
	}, []);

	const isSensorSelected = (sensor: TemperatureSensorConfig): boolean => {
		return selectedSensors.some((selected) => {
			if (typeof sensor === 'string' && typeof selected === 'string') {
				return sensor === selected;
			}
			if (
				typeof sensor === 'object' &&
				typeof selected === 'object' &&
				sensor.type === 'device' &&
				selected.type === 'device'
			) {
				return sensor.deviceId === selected.deviceId;
			}
			return false;
		});
	};

	const handleToggleSensor = (sensor: TemperatureSensorConfig) => {
		setSelectedSensors((prev) => {
			const isSelected = isSensorSelected(sensor);
			if (isSelected) {
				return prev.filter((selected) => {
					if (typeof sensor === 'string' && typeof selected === 'string') {
						return sensor !== selected;
					}
					if (
						typeof sensor === 'object' &&
						typeof selected === 'object' &&
						sensor.type === 'device' &&
						selected.type === 'device'
					) {
						return sensor.deviceId !== selected.deviceId;
					}
					return true;
				});
			} else {
				return [...prev, sensor];
			}
		});
	};

	const handleSave = async () => {
		try {
			setSaving(true);
			const response = await apiPost(
				'temperature',
				'/inside-temperature-sensors',
				{},
				{
					sensors: selectedSensors,
					thermostat: selectedThermostat || undefined,
				}
			);
			if (response.ok) {
				// Success - could show a snackbar here
				await loadData();
			}
		} catch (error) {
			console.error('Failed to save temperature configuration:', error);
		} finally {
			setSaving(false);
		}
	};

	const handleSaveStates = async () => {
		try {
			setSavingStates(true);
			const response = await apiPost('temperature', '/states', {}, { states });
			if (response.ok) {
				// Success
				await loadData();
			}
		} catch (error) {
			console.error('Failed to save states:', error);
		} finally {
			setSavingStates(false);
		}
	};

	const handleAddState = () => {
		const newState: TemperatureState = {
			id: `state-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: `State ${states.length + 1}`,
			timeRanges: [],
		};
		setStates((prev) => [...prev, newState]);
	};

	const handleRemoveState = (stateId: string) => {
		setStates((prev) => {
			return prev.filter((state) => state.id !== stateId);
		});
	};

	const handleUpdateState = (stateId: string, updates: Partial<TemperatureState>) => {
		setStates((prev) =>
			prev.map((state) => {
				if (state.id !== stateId) {
					return state;
				}
				return { ...state, ...updates };
			})
		);
	};

	const handleAddTimeRange = (stateId: string) => {
		const newRange: TemperatureTimeRange = {
			id: `range-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: 'Time Range',
			days: [1, 2, 3, 4, 5], // Weekdays by default
			startTime: '07:00',
			endTime: '22:00',
			targetTemperature: 20,
			enabled: true,
			roomExceptions: {},
		};
		setStates((prev) =>
			prev.map((state) =>
				state.id === stateId
					? { ...state, timeRanges: [...state.timeRanges, newRange] }
					: state
			)
		);
	};

	const handleRemoveTimeRange = (stateId: string, rangeId: string) => {
		setStates((prev) =>
			prev.map((state) =>
				state.id === stateId
					? {
							...state,
							timeRanges: state.timeRanges.filter((r) => r.id !== rangeId),
						}
					: state
			)
		);
	};

	const handleUpdateTimeRange = (
		stateId: string,
		rangeId: string,
		updates: Partial<TemperatureTimeRange>
	) => {
		setStates((prev) =>
			prev.map((state) =>
				state.id === stateId
					? {
							...state,
							timeRanges: state.timeRanges.map((r) =>
								r.id === rangeId ? { ...r, ...updates } : r
							),
						}
					: state
			)
		);
	};

	const handleToggleDay = (stateId: string, rangeId: string, day: number) => {
		setStates((prev) =>
			prev.map((state) =>
				state.id === stateId
					? {
							...state,
							timeRanges: state.timeRanges.map((r) => {
								if (r.id !== rangeId) {
									return r;
								}
								const newDays = r.days.includes(day)
									? r.days.filter((d) => d !== day)
									: [...r.days, day].sort();
								return { ...r, days: newDays };
							}),
						}
					: state
			)
		);
	};

	const handleAddException = (stateId: string, rangeId: string) => {
		setEditingException({
			stateId,
			rangeId,
			roomName: '',
			temperature: 20,
		});
		setExceptionDialogOpen(true);
	};

	const handleSaveException = () => {
		if (!editingException?.roomName) {
			return;
		}

		setStates((prev) =>
			prev.map((state) => {
				if (state.id !== editingException.stateId) {
					return state;
				}
				return {
					...state,
					timeRanges: state.timeRanges.map((range) => {
						if (range.id !== editingException.rangeId) {
							return range;
						}
						const exceptions = { ...range.roomExceptions };
						exceptions[editingException.roomName] = editingException.temperature;
						return { ...range, roomExceptions: exceptions };
					}),
				};
			})
		);
		setExceptionDialogOpen(false);
		setEditingException(null);
	};

	const handleRemoveException = (stateId: string, rangeId: string, roomName: string) => {
		setStates((prev) =>
			prev.map((state) => {
				if (state.id !== stateId) {
					return state;
				}
				return {
					...state,
					timeRanges: state.timeRanges.map((range) => {
						if (range.id !== rangeId) {
							return range;
						}
						const exceptions = { ...range.roomExceptions };
						delete exceptions[roomName];
						return { ...range, roomExceptions: exceptions };
					}),
				};
			})
		);
	};

	if (loading) {
		return (
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '100%',
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
				{/* Header */}
				<Box
					sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
				>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						<Typography variant="h5">Temperature Configuration</Typography>
						<IconButton
							size="small"
							onClick={() => setDebugOpen(true)}
							color="default"
							title="Open Debug View"
						>
							<BugReportIcon />
						</IconButton>
					</Box>
					<Button
						variant="contained"
						startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
						onClick={handleSave}
						disabled={saving}
						sx={{ borderRadius: 2 }}
					>
						Save
					</Button>
				</Box>

				{/* Description */}
				<Typography variant="body2" color="text.secondary">
					Select one or more temperature sensors to use for the inside temperature. When
					multiple sensors are selected, their values will be averaged.
				</Typography>

				{/* Temperature Controllers */}
				{availableSensors.temperatureControllers.length > 0 && (
					<Card>
						<CardContent>
							<Typography variant="h6" sx={{ mb: 2 }}>
								Temperature Controllers
							</Typography>
							<List>
								{availableSensors.temperatureControllers.map(
									(controller, index) => (
										<React.Fragment key={controller}>
											<ListItem>
												<ListItemText primary={controller} />
												<ListItemSecondaryAction>
													<Checkbox
														edge="end"
														checked={isSensorSelected(controller)}
														onChange={() =>
															handleToggleSensor(controller)
														}
													/>
												</ListItemSecondaryAction>
											</ListItem>
											{index <
												availableSensors.temperatureControllers.length -
													1 && <Divider />}
										</React.Fragment>
									)
								)}
							</List>
						</CardContent>
					</Card>
				)}

				{/* Device Sensors */}
				{availableSensors.deviceSensors.length > 0 && (
					<Card>
						<CardContent>
							<Typography variant="h6" sx={{ mb: 2 }}>
								Device Sensors
							</Typography>
							<List>
								{availableSensors.deviceSensors.map((sensor, index) => {
									const sensorConfig: TemperatureSensorConfig = {
										type: 'device',
										deviceId: sensor.deviceId,
									};
									return (
										<React.Fragment key={sensor.deviceId}>
											<ListItem>
												<ListItemText
													primary={sensor.name}
													secondary={sensor.deviceId}
												/>
												<ListItemSecondaryAction>
													<Checkbox
														edge="end"
														checked={isSensorSelected(sensorConfig)}
														onChange={() =>
															handleToggleSensor(sensorConfig)
														}
													/>
												</ListItemSecondaryAction>
											</ListItem>
											{index < availableSensors.deviceSensors.length - 1 && (
												<Divider />
											)}
										</React.Fragment>
									);
								})}
							</List>
						</CardContent>
					</Card>
				)}

				{/* Central Thermostat */}
				{availableThermostats.length > 0 && (
					<Card>
						<CardContent>
							<Typography variant="h6" sx={{ mb: 2 }}>
								Central Thermostat
							</Typography>
							<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
								Select a single thermostat device to use as the central thermostat.
							</Typography>
							<FormControl component="fieldset">
								<RadioGroup
									value={selectedThermostat}
									onChange={(e) => setSelectedThermostat(e.target.value)}
								>
									{availableThermostats.map((thermostat) => (
										<FormControlLabel
											key={thermostat.deviceId}
											value={thermostat.deviceId}
											control={<Radio />}
											label={
												<Box>
													<Typography variant="body1">
														{thermostat.name}
													</Typography>
													<Typography
														variant="caption"
														color="text.secondary"
													>
														{thermostat.deviceId}
													</Typography>
												</Box>
											}
										/>
									))}
									<FormControlLabel value="" control={<Radio />} label="None" />
								</RadioGroup>
							</FormControl>
						</CardContent>
					</Card>
				)}

				{/* Room Overshoot Configuration */}
				{rooms.length > 0 && (
					<Card>
						<CardContent>
							<Typography variant="h6" sx={{ mb: 2 }}>
								Room Overshoot Configuration
							</Typography>
							<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
								Configure how much above the target temperature each room can go
								before heating stops. This prevents overshooting the target
								temperature. Default is 0.5°C.
							</Typography>
							<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
								{rooms.map((room) => {
									const currentOvershoot = roomOvershoots[room.name] ?? 0.5;
									return (
										<Box
											key={room.name}
											sx={{
												p: 2,
												border: '1px solid',
												borderColor: 'divider',
												borderRadius: 2,
											}}
										>
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'center',
													mb: 1,
												}}
											>
												<Typography variant="subtitle2">
													{room.name}
												</Typography>
												<Typography variant="body2" color="text.secondary">
													{currentOvershoot}°C
												</Typography>
											</Box>
											<Box
												sx={{
													display: 'flex',
													alignItems: 'center',
													gap: 2,
												}}
											>
												<Typography variant="body2" sx={{ minWidth: 40 }}>
													0°
												</Typography>
												<Slider
													value={currentOvershoot}
													onChange={async (_e, value) => {
														const newOvershoot = value;
														setRoomOvershoots((prev) => ({
															...prev,
															[room.name]: newOvershoot,
														}));
														try {
															await apiPost(
																'temperature',
																'/room/:roomName/overshoot',
																{ roomName: room.name },
																{ overshoot: newOvershoot }
															);
														} catch (error) {
															console.error(
																'Failed to update room overshoot:',
																error
															);
															// Revert on error
															setRoomOvershoots((prev) => ({
																...prev,
																[room.name]: currentOvershoot,
															}));
														}
													}}
													min={0}
													max={5}
													step={0.1}
													valueLabelDisplay="auto"
													valueLabelFormat={(v) => `${v}°C`}
													sx={{ flexGrow: 1 }}
												/>
												<Typography variant="body2" sx={{ minWidth: 40 }}>
													5°
												</Typography>
												<Button
													size="small"
													onClick={async () => {
														setRoomOvershoots((prev) => {
															const updated = { ...prev };
															delete updated[room.name];
															return updated;
														});
														try {
															await apiPost(
																'temperature',
																'/room/:roomName/overshoot',
																{ roomName: room.name },
																{ overshoot: null }
															);
														} catch (error) {
															console.error(
																'Failed to reset room overshoot:',
																error
															);
															// Revert on error
															setRoomOvershoots((prev) => ({
																...prev,
																[room.name]: currentOvershoot,
															}));
														}
													}}
												>
													Reset
												</Button>
											</Box>
										</Box>
									);
								})}
							</Box>
						</CardContent>
					</Card>
				)}

				{/* PID Parameters */}
				{rooms.length > 0 && (
					<Card>
						<CardContent>
							<Typography variant="h6" sx={{ mb: 2 }}>
								PID Parameters
							</Typography>
							<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
								PID parameters are automatically measured when you start a PID
								measurement for a room. These parameters are used to predict when to
								stop heating early to account for residual heat. Rooms without PID
								parameters use "dumb mode" (binary 30/15°C control).
							</Typography>
							<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
								{rooms.map((room) => {
									const pidParams = roomPIDParameters[room.name];
									return (
										<Box
											key={room.name}
											sx={{
												p: 2,
												border: '1px solid',
												borderColor: pidParams ? 'success.main' : 'divider',
												borderRadius: 2,
												bgcolor: pidParams ? 'success.50' : undefined,
											}}
										>
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'center',
													mb: pidParams ? 1 : 0,
												}}
											>
												<Typography variant="subtitle2">
													{room.name}
												</Typography>
												{pidParams ? (
													<Chip
														label="PID Mode Active"
														size="small"
														color="success"
													/>
												) : (
													<Chip label="Dumb Mode" size="small" />
												)}
											</Box>
											{pidParams ? (
												<Box>
													<Typography
														variant="body2"
														color="text.secondary"
														sx={{ mb: 0.5 }}
													>
														Heating Rate:{' '}
														{pidParams.heatingRate.toFixed(2)}°C/min
													</Typography>
													<Typography
														variant="body2"
														color="text.secondary"
														sx={{ mb: 0.5 }}
													>
														Overshoot Time Constant:{' '}
														{pidParams.overshootTimeConstant.toFixed(1)}{' '}
														min
													</Typography>
													<Typography
														variant="body2"
														color="text.secondary"
														sx={{ mb: 1 }}
													>
														Measurements: {pidParams.measurementCount} |
														Last Updated:{' '}
														{new Date(
															pidParams.lastUpdated
														).toLocaleString()}
													</Typography>
													<Button
														size="small"
														color="error"
														variant="outlined"
														onClick={async () => {
															try {
																await apiDelete(
																	'temperature',
																	'/room/:roomName/pid-parameters',
																	{
																		roomName: room.name,
																	}
																);
																setRoomPIDParameters((prev) => {
																	const updated = { ...prev };
																	delete updated[room.name];
																	return updated;
																});
															} catch (error) {
																console.error(
																	'Failed to clear PID parameters:',
																	error
																);
															}
														}}
													>
														Clear Parameters
													</Button>
												</Box>
											) : (
												<Typography variant="body2" color="text.secondary">
													No PID parameters available. Start a PID
													measurement from the room temperature popover to
													measure heating characteristics.
												</Typography>
											)}
										</Box>
									);
								})}
							</Box>
						</CardContent>
					</Card>
				)}

				{/* Temperature Schedule */}
				{selectedThermostat && (
					<Card>
						<CardContent>
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									mb: 2,
								}}
							>
								<Typography variant="h6">Temperature States</Typography>
								<Box sx={{ display: 'flex', gap: 1 }}>
									<Button
										variant="outlined"
										startIcon={<AddIcon />}
										onClick={handleAddState}
										size="small"
									>
										Add State
									</Button>
									<Button
										variant="contained"
										startIcon={
											savingStates ? (
												<CircularProgress size={16} />
											) : (
												<SaveIcon />
											)
										}
										onClick={handleSaveStates}
										disabled={savingStates}
										size="small"
									>
										Save States
									</Button>
								</Box>
							</Box>
							<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
								Configure temperature states that can be activated through scenes.
								Each state contains one or more time ranges that define when
								different temperatures should be active. The default state is used
								for time-based scheduling.
							</Typography>

							{states.length === 0 ? (
								<Box
									sx={{
										textAlign: 'center',
										py: 4,
										color: 'text.secondary',
									}}
								>
									<Typography variant="body2">
										No states configured. Click "Add State" to create one.
									</Typography>
								</Box>
							) : (
								<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
									{states.map((state) => (
										<Box
											key={state.id}
											sx={{
												p: 2,
												border: '2px solid',
												borderColor: 'divider',
												borderRadius: 2,
											}}
										>
											{/* State Header */}
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'center',
													mb: 2,
													gap: 2,
												}}
											>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														gap: 1,
														flexGrow: 1,
													}}
												>
													<TextField
														value={state.name}
														onChange={(e) =>
															handleUpdateState(state.id, {
																name: e.target.value,
															})
														}
														size="small"
														placeholder="State name"
														sx={{ flexGrow: 1 }}
														slotProps={{
															input: {
																sx: {
																	fontWeight: 600,
																	fontSize: '1.1rem',
																},
															},
														}}
													/>
												</Box>
												<IconButton
													onClick={() => handleRemoveState(state.id)}
													size="small"
													color="error"
												>
													<DeleteIcon />
												</IconButton>
											</Box>

											{/* Time Ranges */}
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
														mb: 1,
													}}
												>
													<Typography
														variant="subtitle2"
														color="text.secondary"
													>
														Time Ranges
													</Typography>
													<Button
														size="small"
														startIcon={<AddIcon />}
														onClick={() => handleAddTimeRange(state.id)}
													>
														Add Range
													</Button>
												</Box>

												{state.timeRanges.length === 0 ? (
													<Box
														sx={{
															textAlign: 'center',
															py: 2,
															color: 'text.secondary',
														}}
													>
														<Typography variant="body2">
															No time ranges. Click "Add Range" to add
															one.
														</Typography>
													</Box>
												) : (
													state.timeRanges.map((range) => (
														<Box
															key={range.id}
															sx={{
																p: 2,
																border: '1px solid',
																borderColor: range.enabled
																	? 'primary.main'
																	: 'divider',
																borderRadius: 2,
																opacity: range.enabled ? 1 : 0.6,
																bgcolor: 'background.paper',
															}}
														>
															<Box
																sx={{
																	display: 'flex',
																	justifyContent: 'space-between',
																	alignItems: 'center',
																	mb: 2,
																	gap: 2,
																}}
															>
																<Box
																	sx={{
																		display: 'flex',
																		alignItems: 'center',
																		gap: 1,
																	}}
																>
																	<Switch
																		checked={range.enabled}
																		onChange={(e) =>
																			handleUpdateTimeRange(
																				state.id,
																				range.id,
																				{
																					enabled:
																						e.target
																							.checked,
																				}
																			)
																		}
																		size="small"
																	/>
																</Box>
																<TextField
																	value={range.name}
																	onChange={(e) =>
																		handleUpdateTimeRange(
																			state.id,
																			range.id,
																			{
																				name: e.target
																					.value,
																			}
																		)
																	}
																	size="small"
																	placeholder="Time range name"
																	sx={{ flexGrow: 1 }}
																	slotProps={{
																		input: {
																			sx: { fontWeight: 500 },
																		},
																	}}
																/>
																<IconButton
																	onClick={() =>
																		handleRemoveTimeRange(
																			state.id,
																			range.id
																		)
																	}
																	size="small"
																	color="error"
																>
																	<DeleteIcon />
																</IconButton>
															</Box>

															{/* Days selection */}
															<Box sx={{ mb: 2 }}>
																<Typography
																	variant="caption"
																	color="text.secondary"
																	sx={{ display: 'block', mb: 1 }}
																>
																	Days
																</Typography>
																<Box
																	sx={{
																		display: 'flex',
																		gap: 0.5,
																		flexWrap: 'wrap',
																	}}
																>
																	{DAY_NAMES.map(
																		(dayName, dayIndex) => (
																			<Chip
																				key={dayIndex}
																				label={dayName}
																				size="small"
																				onClick={() =>
																					handleToggleDay(
																						state.id,
																						range.id,
																						dayIndex
																					)
																				}
																				color={
																					range.days.includes(
																						dayIndex
																					)
																						? 'primary'
																						: 'default'
																				}
																				variant={
																					range.days.includes(
																						dayIndex
																					)
																						? 'filled'
																						: 'outlined'
																				}
																				sx={{
																					minWidth: 45,
																				}}
																			/>
																		)
																	)}
																</Box>
															</Box>

															{/* Time range */}
															<Box
																sx={{
																	display: 'flex',
																	gap: 2,
																	mb: 2,
																	flexWrap: 'wrap',
																}}
															>
																<TextField
																	label="Start Time"
																	type="time"
																	value={range.startTime}
																	onChange={(e) =>
																		handleUpdateTimeRange(
																			state.id,
																			range.id,
																			{
																				startTime:
																					e.target.value,
																			}
																		)
																	}
																	size="small"
																	sx={{ width: 140 }}
																	slotProps={{
																		inputLabel: {
																			shrink: true,
																		},
																	}}
																/>
																<TextField
																	label="End Time"
																	type="time"
																	value={range.endTime}
																	onChange={(e) =>
																		handleUpdateTimeRange(
																			state.id,
																			range.id,
																			{
																				endTime:
																					e.target.value,
																			}
																		)
																	}
																	size="small"
																	sx={{ width: 140 }}
																	slotProps={{
																		inputLabel: {
																			shrink: true,
																		},
																	}}
																/>
															</Box>

															{/* Target temperature */}
															<Box sx={{ mb: 2 }}>
																<Typography
																	variant="caption"
																	color="text.secondary"
																	sx={{ display: 'block', mb: 1 }}
																>
																	Target Temperature:{' '}
																	{range.targetTemperature}°C
																</Typography>
																<Box
																	sx={{
																		display: 'flex',
																		alignItems: 'center',
																		gap: 2,
																	}}
																>
																	<Typography variant="body2">
																		5°
																	</Typography>
																	<Slider
																		value={
																			range.targetTemperature
																		}
																		onChange={(_e, value) =>
																			handleUpdateTimeRange(
																				state.id,
																				range.id,
																				{
																					targetTemperature:
																						value,
																				}
																			)
																		}
																		min={5}
																		max={30}
																		step={0.5}
																		valueLabelDisplay="auto"
																		valueLabelFormat={(v) =>
																			`${v}°C`
																		}
																		sx={{ flexGrow: 1 }}
																	/>
																	<Typography variant="body2">
																		30°
																	</Typography>
																</Box>
															</Box>

															{/* Room Exceptions */}
															<Box>
																<Box
																	sx={{
																		display: 'flex',
																		justifyContent:
																			'space-between',
																		alignItems: 'center',
																		mb: 1,
																	}}
																>
																	<Typography
																		variant="caption"
																		color="text.secondary"
																	>
																		Room Exceptions
																	</Typography>
																	<Button
																		startIcon={<AddIcon />}
																		size="small"
																		onClick={() =>
																			handleAddException(
																				state.id,
																				range.id
																			)
																		}
																	>
																		Add Exception
																	</Button>
																</Box>
																{range.roomExceptions &&
																	Object.keys(
																		range.roomExceptions
																	).length > 0 && (
																		<Box
																			sx={{
																				display: 'flex',
																				flexWrap: 'wrap',
																				gap: 1,
																			}}
																		>
																			{Object.entries(
																				range.roomExceptions
																			).map(
																				([room, temp]) => (
																					<Chip
																						key={room}
																						label={`${room}: ${temp}°C`}
																						onDelete={() =>
																							handleRemoveException(
																								state.id,
																								range.id,
																								room
																							)
																						}
																						onClick={() => {
																							setEditingException(
																								{
																									stateId:
																										state.id,
																									rangeId:
																										range.id,
																									roomName:
																										room,
																									temperature:
																										temp,
																								}
																							);
																							setExceptionDialogOpen(
																								true
																							);
																						}}
																						size="small"
																						variant="outlined"
																					/>
																				)
																			)}
																		</Box>
																	)}
															</Box>
														</Box>
													))
												)}
											</Box>
										</Box>
									))}
								</Box>
							)}
						</CardContent>
					</Card>
				)}

				{/* Empty state */}
				{availableSensors.temperatureControllers.length === 0 &&
					availableSensors.deviceSensors.length === 0 && (
						<Card>
							<CardContent
								sx={{
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'center',
									py: 6,
									gap: 2,
								}}
							>
								<Typography variant="h6" color="text.secondary">
									No temperature sensors available
								</Typography>
								<Typography variant="body2" color="text.secondary">
									Temperature controllers and device sensors will appear here once
									they are detected.
								</Typography>
							</CardContent>
						</Card>
					)}
			</Box>

			{/* Exception Dialog */}
			<Dialog
				open={exceptionDialogOpen}
				onClose={() => {
					setExceptionDialogOpen(false);
					setEditingException(null);
				}}
			>
				<DialogTitle>
					{editingException?.roomName ? 'Edit Room Exception' : 'Add Room Exception'}
				</DialogTitle>
				<DialogContent sx={{ minWidth: 300, pt: 1 }}>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
						<FormControl fullWidth>
							<InputLabel>Room</InputLabel>
							<Select
								value={editingException?.roomName || ''}
								label="Room"
								onChange={(e) => {
									if (editingException) {
										setEditingException((prev) =>
											prev ? { ...prev, roomName: e.target.value } : null
										);
									}
								}}
							>
								{rooms.map((room) => (
									<MenuItem key={room.name} value={room.name}>
										{room.name}
									</MenuItem>
								))}
							</Select>
						</FormControl>

						<Box>
							<Typography gutterBottom>
								Target Temperature: {editingException?.temperature || 20}
								°C
							</Typography>
							<Slider
								value={editingException?.temperature || 20}
								onChange={(_e, value) => {
									if (editingException) {
										setEditingException((prev) =>
											prev ? { ...prev, temperature: value } : null
										);
									}
								}}
								min={5}
								max={30}
								step={0.5}
								valueLabelDisplay="auto"
							/>
						</Box>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => {
							setExceptionDialogOpen(false);
							setEditingException(null);
						}}
					>
						Cancel
					</Button>
					<Button
						onClick={() => {
							if (editingException) {
								handleSaveException();
							}
						}}
						variant="contained"
						disabled={!editingException?.roomName}
					>
						Save
					</Button>
				</DialogActions>
			</Dialog>

			<TemperatureDebugDialog open={debugOpen} onClose={() => setDebugOpen(false)} />
		</Box>
	);
};
