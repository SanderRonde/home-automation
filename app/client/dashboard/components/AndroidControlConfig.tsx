import {
	Box,
	Card,
	CardContent,
	Typography,
	Button,
	Alert,
	Stack,
	TextField,
	List,
	ListItem,
	ListItemText,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
} from '@mui/material';
import { AndroidControlProfile } from '../../../server/modules/android-control/types';
import RefreshIcon from '@mui/icons-material/Refresh';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

interface Config {
	profiles: AndroidControlProfile[];
	androidDevices: Array<{ profile: AndroidControlProfile; deviceId: string }>;
}

export const AndroidControlConfig = (): JSX.Element => {
	const [config, setConfig] = useState<Config | null>(null);
	const [configLoading, setConfigLoading] = useState(true);
	const [configError, setConfigError] = useState<string | null>(null);
	const [saveLoading, setSaveLoading] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState(false);

	const [selectedProfile, setSelectedProfile] = useState<AndroidControlProfile>(
		AndroidControlProfile.CREATE_HOME_FAN
	);
	const [deviceId, setDeviceId] = useState('');

	const [adbDevices, setAdbDevices] = useState<string[]>([]);
	const [adbError, setAdbError] = useState<string | null>(null);
	const [adbLoading, setAdbLoading] = useState(false);

	const loadConfig = async () => {
		setConfigLoading(true);
		setConfigError(null);
		try {
			const response = await apiGet('android-control', '/config', {});
			if (response.ok) {
				const data = await response.json();
				setConfig(data as Config);
				if (data.profiles?.length && !selectedProfile) {
					setSelectedProfile(data.profiles[0]);
				}
			}
		} catch (err) {
			setConfigError(err instanceof Error ? err.message : 'Failed to load config');
		} finally {
			setConfigLoading(false);
		}
	};

	const loadAdbDevices = async () => {
		setAdbLoading(true);
		setAdbError(null);
		try {
			const response = await apiGet('android-control', '/adb-devices', {});
			if (response.ok) {
				const data = await response.json();
				setAdbDevices(data.devices ?? []);
			} else {
				setAdbError('Failed to list ADB devices');
			}
		} catch (err) {
			setAdbError(err instanceof Error ? err.message : 'Failed to list ADB devices');
		} finally {
			setAdbLoading(false);
		}
	};

	useEffect(() => {
		void loadConfig();
	}, []);

	useEffect(() => {
		void loadAdbDevices();
	}, []);

	// Sync deviceId from config when selectedProfile or config changes
	useEffect(() => {
		if (config?.androidDevices && selectedProfile) {
			const entry = config.androidDevices.find((e) => e.profile === selectedProfile);
			setDeviceId(entry?.deviceId ?? '');
		}
	}, [config, selectedProfile]);

	const handleSave = async () => {
		if (!config) {
			return;
		}
		setSaveLoading(true);
		setSaveSuccess(false);
		setConfigError(null);
		try {
			const rest = (config.androidDevices ?? []).filter((e) => e.profile !== selectedProfile);
			const nextAndroidDevices =
				deviceId.trim() === ''
					? rest
					: [...rest, { profile: selectedProfile, deviceId: deviceId.trim() }];
			const response = await apiPost(
				'android-control',
				'/config',
				{},
				{
					androidDevices: nextAndroidDevices,
				}
			);
			if (response.ok) {
				setConfig({ ...config, androidDevices: nextAndroidDevices });
				setSaveSuccess(true);
				setTimeout(() => setSaveSuccess(false), 3000);
			} else {
				const err = await response.json();
				setConfigError(err.error ?? 'Failed to save');
			}
		} catch (err) {
			setConfigError(err instanceof Error ? err.message : 'Failed to save');
		} finally {
			setSaveLoading(false);
		}
	};

	if (configLoading || !config) {
		return (
			<Box sx={{ p: 3 }}>
				<Typography color="text.secondary">
					{configLoading ? 'Loading…' : 'No config'}
				</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ p: 3, maxWidth: 800 }}>
			<Stack spacing={3}>
				<Alert severity="info">
					Select a profile and set the matching Android device ID (ADB device id). The
					backend can use this to launch or control the device.
				</Alert>

				<Card>
					<CardContent>
						<Stack spacing={2}>
							<Typography variant="h6" gutterBottom>
								Profile and device
							</Typography>
							<FormControl fullWidth size="small">
								<InputLabel id="android-control-profile-label">Profile</InputLabel>
								<Select
									labelId="android-control-profile-label"
									label="Profile"
									value={selectedProfile}
									onChange={(e) => setSelectedProfile(e.target.value)}
								>
									{(config.profiles ?? []).map((p) => (
										<MenuItem key={p} value={p}>
											{p}
										</MenuItem>
									))}
								</Select>
							</FormControl>
							<TextField
								fullWidth
								size="small"
								label="Device ID (ADB)"
								value={deviceId}
								onChange={(e) => setDeviceId(e.target.value)}
								placeholder="e.g. emulator-5554"
							/>
							{configError !== null && (
								<Alert severity="error" onClose={() => setConfigError(null)}>
									{configError}
								</Alert>
							)}
							{saveSuccess && <Alert severity="success">Saved.</Alert>}
							<Button variant="contained" onClick={handleSave} disabled={saveLoading}>
								{saveLoading ? 'Saving…' : 'Save'}
							</Button>
						</Stack>
					</CardContent>
				</Card>

				<Card>
					<CardContent>
						<Stack spacing={2}>
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
								<Typography variant="h6">Connected ADB devices</Typography>
								<Button
									size="small"
									startIcon={<RefreshIcon />}
									onClick={() => void loadAdbDevices()}
									disabled={adbLoading}
								>
									Refresh
								</Button>
							</Box>
							{adbError !== null && <Alert severity="warning">{adbError}</Alert>}
							{adbDevices.length === 0 && !adbLoading && (
								<Typography color="text.secondary">
									No devices listed. Run <code>adb devices</code> or start an
									emulator.
								</Typography>
							)}
							<List dense>
								{adbDevices.map((d: string) => (
									<ListItem key={d}>
										<ListItemText primary={d} />
									</ListItem>
								))}
							</List>
						</Stack>
					</CardContent>
				</Card>
			</Stack>
		</Box>
	);
};
