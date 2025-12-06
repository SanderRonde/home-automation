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
	FormLabel,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

type TemperatureSensorConfig = string | { type: 'device'; deviceId: string };

interface AvailableSensors {
	temperatureControllers: string[];
	deviceSensors: Array<{ deviceId: string; name: string }>;
}

interface AvailableThermostats {
	thermostats: Array<{ deviceId: string; name: string }>;
}

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

	const loadData = async () => {
		setLoading(true);
		try {
			const [sensorsResponse, configResponse, thermostatsResponse] = await Promise.all([
				apiGet('temperature', '/temperature-sensors', {}),
				apiGet('temperature', '/inside-temperature-sensors', {}),
				apiGet('temperature', '/thermostats', {}),
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
									<FormControlLabel
										value=""
										control={<Radio />}
										label="None"
									/>
								</RadioGroup>
							</FormControl>
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
