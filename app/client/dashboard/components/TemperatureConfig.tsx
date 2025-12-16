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
	MenuItem,
	Select,
	Alert,
	InputLabel,
} from '@mui/material';
import {
	Save as SaveIcon,
	Add as AddIcon,
	Delete as DeleteIcon,
	Warning as WarningIcon,
} from '@mui/icons-material';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

type TemperatureSensorConfig = string | { type: 'device'; deviceId: string };

interface AvailableSensors {
	temperatureControllers: string[];
	deviceSensors: Array<{ deviceId: string; name: string }>;
}

interface TemperatureScheduleEntry {
	id: string;
	name: string;
	roomName: string; // Required: which room this schedule applies to
	days: number[];
	startTime: string;
	endTime: string;
	targetTemperature: number;
	enabled: boolean;
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
	const [schedule, setSchedule] = useState<TemperatureScheduleEntry[]>([]);
	const [savingSchedule, setSavingSchedule] = useState(false);
	const [roomsWithThermostats, setRoomsWithThermostats] = useState<string[]>([]);
	const [migratedSchedules, setMigratedSchedules] = useState(false);

	const loadData = async () => {
		setLoading(true);
		try {
			const [
				sensorsResponse,
				configResponse,
				thermostatsResponse,
				scheduleResponse,
				roomsResponse,
			] = await Promise.all([
				apiGet('temperature', '/temperature-sensors', {}),
				apiGet('temperature', '/inside-temperature-sensors', {}),
				apiGet('temperature', '/thermostats', {}),
				apiGet('temperature', '/schedule', {}),
				apiGet('temperature', '/rooms-with-thermostats', {}),
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

			let rooms: string[] = [];
			if (roomsResponse.ok) {
				const roomsData = await roomsResponse.json();
				rooms = roomsData.rooms || [];
				setRoomsWithThermostats(rooms);
			}

			if (scheduleResponse.ok) {
				const scheduleData = await scheduleResponse.json();
				const loadedSchedule = (scheduleData.schedule || []) as TemperatureScheduleEntry[];

				// Filter out schedules without roomName (old format) - they will be discarded
				const validSchedules = loadedSchedule.filter(
					(s) => s.roomName && rooms.includes(s.roomName)
				);
				const invalidCount = loadedSchedule.length - validSchedules.length;

				if (invalidCount > 0) {
					setMigratedSchedules(true);
				}

				setSchedule(validSchedules);
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

	const handleSaveSchedule = async () => {
		try {
			setSavingSchedule(true);
			const response = await apiPost('temperature', '/schedule', {}, { schedule });
			if (response.ok) {
				// Success
				await loadData();
			}
		} catch (error) {
			console.error('Failed to save schedule:', error);
		} finally {
			setSavingSchedule(false);
		}
	};

	const handleAddScheduleEntry = () => {
		// Use first available room as default
		const defaultRoom = roomsWithThermostats[0] || '';
		const newEntry: TemperatureScheduleEntry = {
			id: `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: `Schedule ${schedule.length + 1}`,
			roomName: defaultRoom,
			days: [1, 2, 3, 4, 5], // Weekdays by default
			startTime: '07:00',
			endTime: '22:00',
			targetTemperature: 20,
			enabled: true,
		};
		setSchedule((prev) => [...prev, newEntry]);
	};

	const handleRemoveScheduleEntry = (id: string) => {
		setSchedule((prev) => prev.filter((entry) => entry.id !== id));
	};

	const handleUpdateScheduleEntry = (id: string, updates: Partial<TemperatureScheduleEntry>) => {
		setSchedule((prev) =>
			prev.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry))
		);
	};

	const handleToggleDay = (entryId: string, day: number) => {
		setSchedule((prev) =>
			prev.map((entry) => {
				if (entry.id !== entryId) {
					return entry;
				}
				const newDays = entry.days.includes(day)
					? entry.days.filter((d) => d !== day)
					: [...entry.days, day].sort();
				return { ...entry, days: newDays };
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
					<Typography variant="h5">Temperature Configuration</Typography>
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

				{/* Temperature Schedule */}
				{roomsWithThermostats.length > 0 && (
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
								<Typography variant="h6">Temperature Schedule</Typography>
								<Box sx={{ display: 'flex', gap: 1 }}>
									<Button
										variant="outlined"
										startIcon={<AddIcon />}
										onClick={handleAddScheduleEntry}
										size="small"
										disabled={roomsWithThermostats.length === 0}
									>
										Add
									</Button>
									<Button
										variant="contained"
										startIcon={
											savingSchedule ? (
												<CircularProgress size={16} />
											) : (
												<SaveIcon />
											)
										}
										onClick={handleSaveSchedule}
										disabled={savingSchedule}
										size="small"
									>
										Save Schedule
									</Button>
								</Box>
							</Box>

							{migratedSchedules && (
								<Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
									Some schedules without a room assignment have been removed.
									Please recreate them with a specific room.
								</Alert>
							)}

							<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
								Configure automatic temperature schedules for specific rooms. When a
								schedule starts, the room&apos;s thermostats will be set to the
								target temperature. If any room thermostat is heating, the central
								thermostat will also heat.
							</Typography>

							{schedule.length === 0 ? (
								<Box
									sx={{
										textAlign: 'center',
										py: 4,
										color: 'text.secondary',
									}}
								>
									<Typography variant="body2">
										No schedules configured. Click "Add" to create one.
									</Typography>
								</Box>
							) : (
								<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
									{schedule.map((entry) => (
										<Box
											key={entry.id}
											sx={{
												p: 2,
												border: '1px solid',
												borderColor: entry.enabled
													? 'primary.main'
													: 'divider',
												borderRadius: 2,
												opacity: entry.enabled ? 1 : 0.6,
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
														checked={entry.enabled}
														onChange={(e) =>
															handleUpdateScheduleEntry(entry.id, {
																enabled: e.target.checked,
															})
														}
														size="small"
													/>
												</Box>
												<TextField
													value={entry.name}
													onChange={(e) =>
														handleUpdateScheduleEntry(entry.id, {
															name: e.target.value,
														})
													}
													size="small"
													placeholder="Schedule name"
													sx={{ flexGrow: 1 }}
													slotProps={{
														input: {
															sx: { fontWeight: 500 },
														},
													}}
												/>
												<IconButton
													onClick={() =>
														handleRemoveScheduleEntry(entry.id)
													}
													size="small"
													color="error"
												>
													<DeleteIcon />
												</IconButton>
											</Box>

											{/* Room selection */}
											<Box sx={{ mb: 2 }}>
												<FormControl fullWidth size="small">
													<InputLabel
														id={`room-select-label-${entry.id}`}
													>
														Room
													</InputLabel>
													<Select
														labelId={`room-select-label-${entry.id}`}
														value={entry.roomName}
														label="Room"
														onChange={(e) =>
															handleUpdateScheduleEntry(entry.id, {
																roomName: e.target.value,
															})
														}
													>
														{roomsWithThermostats.map((room) => (
															<MenuItem key={room} value={room}>
																{room}
															</MenuItem>
														))}
													</Select>
												</FormControl>
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
													{DAY_NAMES.map((dayName, dayIndex) => (
														<Chip
															key={dayIndex}
															label={dayName}
															size="small"
															onClick={() =>
																handleToggleDay(entry.id, dayIndex)
															}
															color={
																entry.days.includes(dayIndex)
																	? 'primary'
																	: 'default'
															}
															variant={
																entry.days.includes(dayIndex)
																	? 'filled'
																	: 'outlined'
															}
															sx={{ minWidth: 45 }}
														/>
													))}
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
													value={entry.startTime}
													onChange={(e) =>
														handleUpdateScheduleEntry(entry.id, {
															startTime: e.target.value,
														})
													}
													size="small"
													sx={{ width: 140 }}
													slotProps={{
														inputLabel: { shrink: true },
													}}
												/>
												<TextField
													label="End Time"
													type="time"
													value={entry.endTime}
													onChange={(e) =>
														handleUpdateScheduleEntry(entry.id, {
															endTime: e.target.value,
														})
													}
													size="small"
													sx={{ width: 140 }}
													slotProps={{
														inputLabel: { shrink: true },
													}}
												/>
											</Box>

											{/* Target temperature */}
											<Box>
												<Typography
													variant="caption"
													color="text.secondary"
													sx={{ display: 'block', mb: 1 }}
												>
													Target Temperature: {entry.targetTemperature}°C
												</Typography>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														gap: 2,
													}}
												>
													<Typography variant="body2">5°</Typography>
													<Slider
														value={entry.targetTemperature}
														onChange={(_e, value) =>
															handleUpdateScheduleEntry(entry.id, {
																targetTemperature: value,
															})
														}
														min={5}
														max={30}
														step={0.5}
														valueLabelDisplay="auto"
														valueLabelFormat={(v) => `${v}°C`}
														sx={{ flexGrow: 1 }}
													/>
													<Typography variant="body2">30°</Typography>
												</Box>
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
		</Box>
	);
};
