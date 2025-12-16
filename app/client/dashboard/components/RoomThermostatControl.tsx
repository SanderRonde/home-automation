import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Box,
	Typography,
	Slider,
	IconButton,
	Chip,
	CircularProgress,
	Divider,
} from '@mui/material';
import {
	Close as CloseIcon,
	LocalFireDepartment,
	DeviceThermostat,
	Add as AddIcon,
	Remove as RemoveIcon,
} from '@mui/icons-material';
import type { RoomThermostatStatus } from '../../../server/modules/temperature/types';
import React, { useState, useEffect } from 'react';
import { apiPost } from '../../lib/fetch';

interface RoomThermostatControlProps {
	open: boolean;
	onClose: () => void;
	roomName: string;
	thermostatStatus: RoomThermostatStatus | null;
	onUpdate: () => void;
}

const PRESETS = [
	{ label: 'Off', temp: 5, icon: '❄️' },
	{ label: 'Eco', temp: 16, icon: '🌿' },
	{ label: 'Comfort', temp: 20, icon: '🏠' },
	{ label: 'Warm', temp: 22, icon: '☀️' },
];

export const RoomThermostatControl = (props: RoomThermostatControlProps): JSX.Element => {
	const [targetTemp, setTargetTemp] = useState<number>(20);
	const [isSaving, setIsSaving] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);

	// Initialize target temp from thermostat status
	useEffect(() => {
		if (props.thermostatStatus) {
			setTargetTemp(props.thermostatStatus.targetTemperature);
			setHasChanges(false);
		}
	}, [props.thermostatStatus]);

	const handleTempChange = (_event: Event, newValue: number | number[]) => {
		const temp = typeof newValue === 'number' ? newValue : newValue[0];
		setTargetTemp(temp);
		setHasChanges(true);
	};

	const handleIncrement = () => {
		setTargetTemp((prev) => Math.min(prev + 0.5, 30));
		setHasChanges(true);
	};

	const handleDecrement = () => {
		setTargetTemp((prev) => Math.max(prev - 0.5, 5));
		setHasChanges(true);
	};

	const handlePreset = (temp: number) => {
		setTargetTemp(temp);
		setHasChanges(true);
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			const response = await apiPost(
				'temperature',
				'/room/:roomName/thermostat',
				{ roomName: encodeURIComponent(props.roomName) },
				{ targetTemperature: targetTemp }
			);
			if (response.ok) {
				setHasChanges(false);
				props.onUpdate();
			}
		} catch (error) {
			console.error('Failed to set room thermostat:', error);
		} finally {
			setIsSaving(false);
		}
	};

	const status = props.thermostatStatus;
	const isHeating = status?.isHeating ?? false;
	const currentTemp =
		status?.averageThermostatTemperature ?? status?.averageSensorTemperature ?? null;
	const sensorTemp = status?.averageSensorTemperature ?? null;

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			maxWidth="xs"
			fullWidth
			PaperProps={{
				sx: {
					borderRadius: 3,
					overflow: 'hidden',
				},
			}}
		>
			<DialogTitle
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					bgcolor: isHeating ? 'warning.main' : 'primary.main',
					color: 'white',
					py: 1.5,
				}}
			>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					{isHeating ? <LocalFireDepartment /> : <DeviceThermostat />}
					<Typography variant="h6">{props.roomName}</Typography>
				</Box>
				<IconButton onClick={props.onClose} sx={{ color: 'white' }}>
					<CloseIcon />
				</IconButton>
			</DialogTitle>

			<DialogContent sx={{ pt: 3, pb: 2 }}>
				{!status ? (
					<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
						<CircularProgress />
					</Box>
				) : (
					<>
						{/* Current Temperature Display */}
						<Box sx={{ textAlign: 'center', mb: 3 }}>
							<Typography variant="body2" color="text.secondary" gutterBottom>
								{sensorTemp !== null &&
								currentTemp !== null &&
								sensorTemp !== currentTemp
									? 'Thermostat Temperature'
									: 'Current Temperature'}
							</Typography>
							<Typography
								variant="h2"
								sx={{
									fontWeight: 300,
									color: isHeating ? 'warning.main' : 'text.primary',
								}}
							>
								{currentTemp !== null
									? `${Math.round(currentTemp * 10) / 10}°`
									: '--°'}
							</Typography>
							{sensorTemp !== null &&
								currentTemp !== null &&
								sensorTemp !== currentTemp && (
									<Typography variant="body2" color="text.secondary">
										Sensor: {Math.round(sensorTemp * 10) / 10}°C
									</Typography>
								)}
							{isHeating && (
								<Chip
									icon={<LocalFireDepartment />}
									label="Heating"
									color="warning"
									size="small"
									sx={{ mt: 1 }}
								/>
							)}
						</Box>

						<Divider sx={{ my: 2 }} />

						{/* Target Temperature Control */}
						<Box sx={{ mb: 3 }}>
							<Typography variant="body2" color="text.secondary" gutterBottom>
								Target Temperature
							</Typography>
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: 2,
									mb: 2,
								}}
							>
								<IconButton
									onClick={handleDecrement}
									disabled={targetTemp <= 5}
									sx={{
										bgcolor: 'action.hover',
										'&:hover': { bgcolor: 'action.selected' },
									}}
								>
									<RemoveIcon />
								</IconButton>
								<Typography
									variant="h3"
									sx={{
										fontWeight: 500,
										minWidth: 100,
										textAlign: 'center',
										color: hasChanges ? 'primary.main' : 'text.primary',
									}}
								>
									{Math.round(targetTemp * 10) / 10}°
								</Typography>
								<IconButton
									onClick={handleIncrement}
									disabled={targetTemp >= 30}
									sx={{
										bgcolor: 'action.hover',
										'&:hover': { bgcolor: 'action.selected' },
									}}
								>
									<AddIcon />
								</IconButton>
							</Box>
							<Box sx={{ px: 2 }}>
								<Slider
									value={targetTemp}
									onChange={handleTempChange}
									min={5}
									max={30}
									step={0.5}
									valueLabelDisplay="auto"
									valueLabelFormat={(v) => `${v}°C`}
									marks={[
										{ value: 5, label: '5°' },
										{ value: 15, label: '15°' },
										{ value: 20, label: '20°' },
										{ value: 25, label: '25°' },
										{ value: 30, label: '30°' },
									]}
								/>
							</Box>
						</Box>

						{/* Presets */}
						<Box sx={{ mb: 2 }}>
							<Typography variant="body2" color="text.secondary" gutterBottom>
								Quick Presets
							</Typography>
							<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
								{PRESETS.map((preset) => (
									<Chip
										key={preset.label}
										label={`${preset.icon} ${preset.label} (${preset.temp}°)`}
										onClick={() => handlePreset(preset.temp)}
										variant={targetTemp === preset.temp ? 'filled' : 'outlined'}
										color={targetTemp === preset.temp ? 'primary' : 'default'}
										sx={{ flex: '1 1 45%' }}
									/>
								))}
							</Box>
						</Box>

						{/* Individual Thermostats */}
						{status.thermostats.length > 1 && (
							<>
								<Divider sx={{ my: 2 }} />
								<Box>
									<Typography variant="body2" color="text.secondary" gutterBottom>
										Thermostats in Room ({status.thermostats.length})
									</Typography>
									{status.thermostats.map((thermostat) => (
										<Box
											key={thermostat.deviceId}
											sx={{
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
												py: 0.5,
											}}
										>
											<Typography variant="body2">
												{thermostat.deviceName}
											</Typography>
											<Box
												sx={{
													display: 'flex',
													alignItems: 'center',
													gap: 1,
												}}
											>
												<Typography variant="body2" color="text.secondary">
													{Math.round(
														thermostat.currentTemperature * 10
													) / 10}
													° →{' '}
													{Math.round(thermostat.targetTemperature * 10) /
														10}
													°
												</Typography>
												{thermostat.isHeating && (
													<LocalFireDepartment
														sx={{ fontSize: 16, color: 'warning.main' }}
													/>
												)}
											</Box>
										</Box>
									))}
								</Box>
							</>
						)}
					</>
				)}
			</DialogContent>

			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button onClick={props.onClose}>Cancel</Button>
				<Button
					variant="contained"
					onClick={handleSave}
					disabled={!hasChanges || isSaving}
					startIcon={isSaving ? <CircularProgress size={16} /> : null}
				>
					{isSaving ? 'Saving...' : 'Set Temperature'}
				</Button>
			</DialogActions>
		</Dialog>
	);
};
