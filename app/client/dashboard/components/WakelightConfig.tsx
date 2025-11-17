import {
	Box,
	Card,
	CardContent,
	Typography,
	Button,
	Alert,
	Stack,
	TextField,
	Chip,
	CircularProgress,
	Divider,
} from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import DeleteIcon from '@mui/icons-material/Delete';
import React, { useState, useEffect } from 'react';
import AlarmIcon from '@mui/icons-material/Alarm';
import { apiGet, apiPost } from '../../lib/fetch';
import SaveIcon from '@mui/icons-material/Save';
import { DevicePicker } from './DevicePicker';

export const WakelightConfig = (): JSX.Element => {
	const [deviceIds, setDeviceIds] = useState<string[]>([]);
	const [durationMinutes, setDurationMinutes] = useState<number>(7);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [showDevicePicker, setShowDevicePicker] = useState(false);
	const [alarmActive, setAlarmActive] = useState(false);
	const [alarmInfo, setAlarmInfo] = useState<{
		alarmTimestamp: number;
		startTimestamp: number;
		durationMinutes: number;
		deviceCount: number;
	} | null>(null);

	// Load config on component mount
	useEffect(() => {
		void loadConfig();
		void loadStatus();

		// Poll status every 5 seconds
		const interval = setInterval(() => {
			void loadStatus();
		}, 5000);

		return () => clearInterval(interval);
	}, []);

	const loadConfig = async () => {
		try {
			const response = await apiGet('wakelight', '/config', {});
			if (response.ok) {
				const data = await response.json();
				setDeviceIds(data.deviceIds || []);
				setDurationMinutes(data.durationMinutes || 7);
			}
		} catch (err) {
			console.error('Failed to load wakelight config:', err);
			setError('Failed to load configuration');
		}
	};

	const loadStatus = async () => {
		try {
			const response = await apiGet('wakelight', '/status', {});
			if (response.ok) {
				const data = await response.json();
				setAlarmActive(data.active);
				setAlarmInfo(data.alarm);
			}
		} catch (err) {
			console.error('Failed to load wakelight status:', err);
		}
	};

	const saveConfig = async () => {
		setLoading(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await apiPost(
				'wakelight',
				'/config',
				{},
				{
					deviceIds,
					durationMinutes,
				}
			);

			if (response.ok) {
				setSuccess('Configuration saved successfully');
				setTimeout(() => setSuccess(null), 3000);
			} else {
				setError('Failed to save configuration');
			}
		} catch (err) {
			console.error('Failed to save config:', err);
			setError('Failed to save configuration');
		} finally {
			setLoading(false);
		}
	};

	const clearAlarm = async () => {
		setLoading(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await apiPost('wakelight', '/clear', {});

			if (response.ok) {
				setSuccess('Alarm cleared');
				setTimeout(() => setSuccess(null), 3000);
				await loadStatus();
			} else {
				setError('Failed to clear alarm');
			}
		} catch (err) {
			console.error('Failed to clear alarm:', err);
			setError('Failed to clear alarm');
		} finally {
			setLoading(false);
		}
	};

	const handleDeviceSelection = (selectedDeviceIds: string[]) => {
		setDeviceIds(selectedDeviceIds);
	};

	const handleRemoveDevice = (deviceId: string) => {
		setDeviceIds(deviceIds.filter((id) => id !== deviceId));
	};

	const formatTimestamp = (timestamp: number): string => {
		return new Date(timestamp).toLocaleString();
	};

	return (
		<Box sx={{ p: 3 }}>
			<Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
				<LightbulbIcon />
				Wakelight Configuration
			</Typography>

			{error && (
				<Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}

			{success && (
				<Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
					{success}
				</Alert>
			)}

			{/* Alarm Status Card */}
			{(alarmActive || alarmInfo) && (
				<Card sx={{ mb: 3, bgcolor: alarmActive ? 'info.dark' : 'background.paper' }}>
					<CardContent>
						<Typography
							variant="h6"
							sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
						>
							<AlarmIcon />
							{alarmActive ? 'Wakelight Active' : 'Alarm Scheduled'}
						</Typography>
						{alarmInfo && (
							<Box sx={{ mb: 2 }}>
								<Typography variant="body2" sx={{ mb: 1 }}>
									<strong>Alarm Time:</strong>{' '}
									{formatTimestamp(alarmInfo.alarmTimestamp)}
								</Typography>
								<Typography variant="body2" sx={{ mb: 1 }}>
									<strong>Start Time:</strong>{' '}
									{formatTimestamp(alarmInfo.startTimestamp)}
								</Typography>
								<Typography variant="body2" sx={{ mb: 1 }}>
									<strong>Duration:</strong> {alarmInfo.durationMinutes} minutes
								</Typography>
								<Typography variant="body2">
									<strong>Devices:</strong> {alarmInfo.deviceCount}
								</Typography>
							</Box>
						)}
						<Button
							variant="contained"
							color="error"
							startIcon={<DeleteIcon />}
							onClick={clearAlarm}
							disabled={loading}
						>
							Clear Alarm
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Configuration Card */}
			<Card>
				<CardContent>
					<Typography variant="h6" sx={{ mb: 2 }}>
						Configuration
					</Typography>

					<Stack spacing={3}>
						{/* Device Selection */}
						<Box>
							<Typography variant="subtitle1" sx={{ mb: 1 }}>
								Devices
							</Typography>
							<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
								Select devices that support ColorControl (lights) for the wakelight
								effect
							</Typography>

							{deviceIds.length > 0 && (
								<Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
									{deviceIds.map((deviceId) => (
										<Chip
											key={deviceId}
											label={deviceId}
											onDelete={() => handleRemoveDevice(deviceId)}
											color="primary"
											variant="outlined"
										/>
									))}
								</Box>
							)}

							<Button variant="outlined" onClick={() => setShowDevicePicker(true)}>
								{deviceIds.length === 0 ? 'Select Devices' : 'Edit Devices'}
							</Button>
						</Box>

						<Divider />

						{/* Duration Setting */}
						<Box>
							<Typography variant="subtitle1" sx={{ mb: 1 }}>
								Duration
							</Typography>
							<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
								How many minutes before the alarm should the lights start to
								gradually increase brightness
							</Typography>

							<TextField
								type="number"
								value={durationMinutes}
								onChange={(e) => setDurationMinutes(Number(e.target.value))}
								inputProps={{ min: 1, max: 60 }}
								label="Duration (minutes)"
								variant="outlined"
								sx={{ width: '200px' }}
							/>
						</Box>

						<Divider />

						{/* Save Button */}
						<Box>
							<Button
								variant="contained"
								color="primary"
								startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
								onClick={saveConfig}
								disabled={loading || deviceIds.length === 0}
							>
								Save Configuration
							</Button>
						</Box>
					</Stack>
				</CardContent>
			</Card>

			{/* Info Card */}
			<Card sx={{ mt: 3 }}>
				<CardContent>
					<Typography variant="h6" sx={{ mb: 2 }}>
						How to Use
					</Typography>
					<Typography variant="body2" paragraph>
						1. Select one or more lights that support color control
					</Typography>
					<Typography variant="body2" paragraph>
						2. Set the duration for the wakelight effect (how many minutes before your
						alarm)
					</Typography>
					<Typography variant="body2" paragraph>
						3. Save your configuration
					</Typography>
					<Typography variant="body2" paragraph>
						4. Use the <code>/wakelight/set</code> API endpoint to schedule an alarm by
						providing <code>minutesToAlarm</code>
					</Typography>
					<Typography variant="body2" paragraph>
						5. The lights will gradually increase in brightness, reaching 100% exactly
						when your alarm goes off
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
						Note: If you manually control any of the selected lights during the
						wakelight effect, the effect will be automatically cancelled.
					</Typography>
				</CardContent>
			</Card>

			{/* Device Picker Dialog */}
			<DevicePicker
				open={showDevicePicker}
				onClose={() => setShowDevicePicker(false)}
				onConfirm={handleDeviceSelection}
				currentSelection={deviceIds}
				title="Select Wakelight Devices"
			/>
		</Box>
	);
};
