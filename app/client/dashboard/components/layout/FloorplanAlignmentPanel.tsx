import {
	Box,
	Paper,
	Typography,
	Slider,
	TextField,
	Button,
	IconButton,
	Tooltip,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	FormControlLabel,
	Switch,
	Alert,
	Snackbar,
} from '@mui/material';
import {
	RotateLeft as RotateLeftIcon,
	Save as SaveIcon,
	AccessTime as AccessTimeIcon,
	LocationOn as LocationOnIcon,
	MyLocation as MyLocationIcon,
} from '@mui/icons-material';
import type { FloorplanAlignment } from '../../types/layout';
import React from 'react';
import { apiGet, apiPost } from '../../../lib/fetch';

interface FloorplanAlignmentPanelProps {
	alignment: FloorplanAlignment;
	onAlignmentChange: (alignment: FloorplanAlignment) => void;
	onSave: () => void;
	onReset: () => void;
	timeFolders: string[];
	selectedTimeFolder: string | null;
	onTimeFolderChange: (timeFolder: string | null) => void;
}

export const FloorplanAlignmentPanel = (props: FloorplanAlignmentPanelProps): JSX.Element => {
	const [location, setLocation] = React.useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const [locationInput, setLocationInput] = React.useState<{
		latitude: string;
		longitude: string;
	}>({ latitude: '', longitude: '' });
	const [locationLoading, setLocationLoading] = React.useState(false);
	const [locationError, setLocationError] = React.useState<string | null>(null);
	const [locationSuccess, setLocationSuccess] = React.useState(false);

	// Load location on mount
	React.useEffect(() => {
		const loadLocation = async () => {
			try {
				const response = await apiGet('device', '/location', {});
				if (response.ok) {
					const data = await response.json();
					if (data.location) {
						setLocation(data.location);
						setLocationInput({
							latitude: data.location.latitude.toString(),
							longitude: data.location.longitude.toString(),
						});
					}
				}
			} catch (error) {
				console.error('Failed to load location:', error);
			}
		};
		void loadLocation();
	}, []);

	const handleGetCurrentLocation = () => {
		if (!navigator.geolocation) {
			setLocationError('Geolocation is not supported by your browser');
			return;
		}

		setLocationLoading(true);
		setLocationError(null);

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const lat = position.coords.latitude;
				const lng = position.coords.longitude;
				setLocationInput({
					latitude: lat.toString(),
					longitude: lng.toString(),
				});
				setLocationLoading(false);
			},
			(error) => {
				setLocationError(`Failed to get location: ${error.message}`);
				setLocationLoading(false);
			}
		);
	};

	const handleSaveLocation = async () => {
		const lat = parseFloat(locationInput.latitude);
		const lng = parseFloat(locationInput.longitude);

		if (isNaN(lat) || isNaN(lng)) {
			setLocationError('Please enter valid latitude and longitude values');
			return;
		}

		if (lat < -90 || lat > 90) {
			setLocationError('Latitude must be between -90 and 90');
			return;
		}

		if (lng < -180 || lng > 180) {
			setLocationError('Longitude must be between -180 and 180');
			return;
		}

		setLocationLoading(true);
		setLocationError(null);

		try {
			const response = await apiPost('device', '/location/save', {}, { latitude: lat, longitude: lng });
			if (response.ok) {
				setLocation({ latitude: lat, longitude: lng });
				setLocationSuccess(true);
				setTimeout(() => setLocationSuccess(false), 3000);
			} else {
				const data = await response.json();
				setLocationError(data.error || 'Failed to save location');
			}
		} catch (error) {
			setLocationError('Failed to save location');
			console.error('Failed to save location:', error);
		} finally {
			setLocationLoading(false);
		}
	};

	const handleXChange = (_event: Event, value: number | number[]) => {
		props.onAlignmentChange({
			...props.alignment,
			x: value as number,
		});
	};

	const handleYChange = (_event: Event, value: number | number[]) => {
		props.onAlignmentChange({
			...props.alignment,
			y: value as number,
		});
	};

	const handleScaleChange = (_event: Event, value: number | number[]) => {
		props.onAlignmentChange({
			...props.alignment,
			scale: value as number,
		});
	};

	const handleRotationChange = (_event: Event, value: number | number[]) => {
		props.onAlignmentChange({
			...props.alignment,
			rotation: value as number,
		});
	};

	const handleXInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = parseFloat(e.target.value) || 0;
		props.onAlignmentChange({
			...props.alignment,
			x: value,
		});
	};

	const handleYInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = parseFloat(e.target.value) || 0;
		props.onAlignmentChange({
			...props.alignment,
			y: value,
		});
	};

	const handleScaleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = parseFloat(e.target.value) || 1;
		props.onAlignmentChange({
			...props.alignment,
			scale: Math.max(0.1, Math.min(3, value)),
		});
	};

	const handleRotationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = parseFloat(e.target.value) || 0;
		props.onAlignmentChange({
			...props.alignment,
			rotation: ((value % 360) + 360) % 360, // Normalize to 0-360
		});
	};

	// Format time folder (HHMM) to readable time (HH:MM)
	const formatTimeFolder = (folder: string): string => {
		const hours = folder.slice(0, 2);
		const minutes = folder.slice(2, 4);
		return `${hours}:${minutes}`;
	};

	const handleTimeSimulationToggle = (checked: boolean) => {
		if (!checked) {
			props.onTimeFolderChange(null);
		} else if (props.timeFolders.length > 0) {
			// Default to first time folder when enabling
			props.onTimeFolderChange(props.timeFolders[0]);
		}
	};

	return (
		<Paper sx={{ p: 2, mb: 2 }}>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					mb: 2,
				}}
			>
				<Typography variant="h6">Floorplan Alignment</Typography>
				<Box sx={{ display: 'flex', gap: 1 }}>
					<Tooltip title="Reset">
						<IconButton size="small" onClick={props.onReset}>
							<RotateLeftIcon />
						</IconButton>
					</Tooltip>
					<Button
						variant="contained"
						size="small"
						startIcon={<SaveIcon />}
						onClick={props.onSave}
					>
						Save
					</Button>
				</Box>
			</Box>

			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
				{/* Location */}
				<Box>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							mb: 1,
						}}
					>
						<Typography
							variant="body2"
							sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
						>
							<LocationOnIcon fontSize="small" />
							Location
						</Typography>
						<Button
							size="small"
							startIcon={<MyLocationIcon />}
							onClick={handleGetCurrentLocation}
							disabled={locationLoading}
							variant="outlined"
						>
							Get Current
						</Button>
					</Box>
					<Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
						<TextField
							type="number"
							size="small"
							label="Latitude"
							value={locationInput.latitude}
							onChange={(e) =>
								setLocationInput({ ...locationInput, latitude: e.target.value })
							}
							inputProps={{ step: 0.000001, min: -90, max: 90 }}
							fullWidth
							helperText="Range: -90 to 90"
						/>
						<TextField
							type="number"
							size="small"
							label="Longitude"
							value={locationInput.longitude}
							onChange={(e) =>
								setLocationInput({ ...locationInput, longitude: e.target.value })
							}
							inputProps={{ step: 0.000001, min: -180, max: 180 }}
							fullWidth
							helperText="Range: -180 to 180"
						/>
					</Box>
					<Button
						variant="contained"
						size="small"
						startIcon={<SaveIcon />}
						onClick={handleSaveLocation}
						disabled={locationLoading}
						fullWidth
					>
						Save Location
					</Button>
					{location && (
						<Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
							Current: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
						</Typography>
					)}
				</Box>

				{/* Time Simulation */}
				<Box>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							mb: 1,
						}}
					>
						<Typography
							variant="body2"
							sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
						>
							<AccessTimeIcon fontSize="small" />
							Time Simulation
						</Typography>
						<FormControlLabel
							control={
								<Switch
									checked={props.selectedTimeFolder !== null}
									onChange={(e) => handleTimeSimulationToggle(e.target.checked)}
									size="small"
								/>
							}
							label={props.selectedTimeFolder !== null ? 'On' : 'Off'}
							labelPlacement="end"
						/>
					</Box>
					{props.selectedTimeFolder !== null && (
						<FormControl fullWidth size="small" sx={{ mt: 1 }}>
							<InputLabel>Time</InputLabel>
							<Select
								value={props.selectedTimeFolder}
								onChange={(e) => props.onTimeFolderChange(e.target.value)}
								label="Time"
							>
								{props.timeFolders.map((folder) => (
									<MenuItem key={folder} value={folder}>
										{formatTimeFolder(folder)}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					)}
				</Box>

				{/* Position X */}
				<Box>
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							mb: 1,
						}}
					>
						<Typography variant="body2">Position X</Typography>
						<TextField
							type="number"
							size="small"
							value={Math.round(props.alignment.x)}
							onChange={handleXInputChange}
							inputProps={{ style: { width: 80 } }}
							sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
						/>
					</Box>
					<Slider
						value={props.alignment.x}
						onChange={handleXChange}
						min={-1000}
						max={1000}
						step={1}
						valueLabelDisplay="auto"
					/>
				</Box>

				{/* Position Y */}
				<Box>
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							mb: 1,
						}}
					>
						<Typography variant="body2">Position Y</Typography>
						<TextField
							type="number"
							size="small"
							value={Math.round(props.alignment.y)}
							onChange={handleYInputChange}
							inputProps={{ style: { width: 80 } }}
							sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
						/>
					</Box>
					<Slider
						value={props.alignment.y}
						onChange={handleYChange}
						min={-1000}
						max={1000}
						step={1}
						valueLabelDisplay="auto"
					/>
				</Box>

				{/* Scale */}
				<Box>
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							mb: 1,
						}}
					>
						<Typography variant="body2">Scale</Typography>
						<TextField
							type="number"
							size="small"
							value={props.alignment.scale.toFixed(3)}
							onChange={handleScaleInputChange}
							inputProps={{ style: { width: 80 }, step: 0.01, min: 0.1, max: 3 }}
							sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
						/>
					</Box>
					<Slider
						value={props.alignment.scale}
						onChange={handleScaleChange}
						min={0.1}
						max={3}
						step={0.001}
						valueLabelDisplay="auto"
						valueLabelFormat={(value) => `${value.toFixed(3)}x`}
					/>
				</Box>

				{/* Rotation */}
				<Box>
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							mb: 1,
						}}
					>
						<Typography variant="body2">Rotation</Typography>
						<TextField
							type="number"
							size="small"
							value={Math.round(props.alignment.rotation)}
							onChange={handleRotationInputChange}
							inputProps={{ style: { width: 80 }, step: 1, min: 0, max: 360 }}
							sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
						/>
					</Box>
					<Slider
						value={props.alignment.rotation}
						onChange={handleRotationChange}
						min={0}
						max={360}
						step={1}
						valueLabelDisplay="auto"
						valueLabelFormat={(value) => `${Math.round(value)}°`}
					/>
				</Box>
			</Box>

			{/* Location Error Snackbar */}
			<Snackbar
				open={locationError !== null}
				autoHideDuration={6000}
				onClose={() => setLocationError(null)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
			>
				<Alert onClose={() => setLocationError(null)} severity="error" sx={{ width: '100%' }}>
					{locationError}
				</Alert>
			</Snackbar>

			{/* Location Success Snackbar */}
			<Snackbar
				open={locationSuccess}
				autoHideDuration={3000}
				onClose={() => setLocationSuccess(false)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
			>
				<Alert onClose={() => setLocationSuccess(false)} severity="success" sx={{ width: '100%' }}>
					Location saved successfully
				</Alert>
			</Snackbar>
		</Paper>
	);
};
