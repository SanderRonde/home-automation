import {
	Box,
	Card,
	CardContent,
	Typography,
	Button,
	Alert,
	Stack,
	TextField,
	MenuItem,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	CircularProgress,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
	Chip,
} from '@mui/material';
import {
	Edit as EditIcon,
	Delete as DeleteIcon,
	CheckCircle as CheckCircleIcon,
	Error as ErrorIcon,
} from '@mui/icons-material';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

interface TuyaDeviceConfig {
	id: string;
	key: string;
	name: string;
	type: 'thermostat';
}

interface TuyaCredentials {
	apiKey?: string;
	apiSecret?: string;
	apiRegion?: string;
}

interface TuyaConfig {
	credentials: TuyaCredentials;
	devices: TuyaDeviceConfig[];
}

export const TuyaConfig = (): JSX.Element => {
	const [config, setConfig] = useState<TuyaConfig | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	// Credentials form
	const [apiKey, setApiKey] = useState('');
	const [apiSecret, setApiSecret] = useState('');
	const [apiRegion, setApiRegion] = useState('us');

	// Device dialog
	const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
	const [editingDevice, setEditingDevice] = useState<TuyaDeviceConfig | null>(null);
	const [deviceId, setDeviceId] = useState('');
	const [deviceKey, setDeviceKey] = useState('');
	const [deviceName, setDeviceName] = useState('');
	const [deviceType, setDeviceType] = useState<'thermostat'>('thermostat');

	// Testing
	const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);
	const [testResults, setTestResults] = useState<Record<string, boolean>>({});

	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void loadConfig();
	}, []);

	const loadConfig = async () => {
		try {
			setLoading(true);
			const response = await apiGet('tuya', '/config', {});
			if (response.ok) {
				const data = await response.json();
				setConfig(data);
				setApiKey(data.credentials.apiKey || '');
				setApiSecret(data.credentials.apiSecret || '');
				setApiRegion(data.credentials.apiRegion || 'us');
			} else {
				setError('Failed to load Tuya configuration');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load configuration');
		} finally {
			setLoading(false);
		}
	};

	const handleSaveCredentials = async () => {
		try {
			setSaving(true);
			setError(null);
			const response = await apiPost(
				'tuya',
				'/credentials',
				{},
				{
					apiKey,
					apiSecret,
					apiRegion,
				}
			);

			if (response.ok) {
				await loadConfig();
			} else {
				setError('Failed to save credentials');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save credentials');
		} finally {
			setSaving(false);
		}
	};

	const handleOpenDeviceDialog = (device?: TuyaDeviceConfig) => {
		if (device) {
			setEditingDevice(device);
			setDeviceId(device.id);
			setDeviceKey(device.key);
			setDeviceName(device.name);
			setDeviceType(device.type);
		} else {
			setEditingDevice(null);
			setDeviceId('');
			setDeviceKey('');
			setDeviceName('');
			setDeviceType('thermostat');
		}
		setDeviceDialogOpen(true);
	};

	const handleCloseDeviceDialog = () => {
		setDeviceDialogOpen(false);
		setEditingDevice(null);
	};

	const handleSaveDevice = async () => {
		try {
			setSaving(true);
			setError(null);

			const deviceConfig: TuyaDeviceConfig = {
				id: deviceId,
				key: deviceKey,
				name: deviceName,
				type: deviceType,
			};

			const response = editingDevice
				? await apiPost(
						'tuya',
						'/devices/update',
						{},
						{
							oldId: editingDevice.id,
							...deviceConfig,
						}
					)
				: await apiPost('tuya', '/devices/add', {}, deviceConfig);

			if (response.ok) {
				await loadConfig();
				handleCloseDeviceDialog();
			} else {
				const errorData = await response.text();
				setError(errorData);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save device');
		} finally {
			setSaving(false);
		}
	};

	const handleDeleteDevice = async (deviceId: string) => {
		if (!confirm('Are you sure you want to delete this device?')) {
			return;
		}

		try {
			setSaving(true);
			setError(null);
			const response = await apiPost('tuya', '/devices/remove', {}, { deviceId });

			if (response.ok) {
				await loadConfig();
			} else {
				setError('Failed to delete device');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to delete device');
		} finally {
			setSaving(false);
		}
	};

	const handleTestDevice = async (device: TuyaDeviceConfig) => {
		try {
			setTestingDeviceId(device.id);
			const response = await apiPost('tuya', '/devices/test', {}, device);

			if (response.ok) {
				const result = await response.json();
				setTestResults((prev) => ({
					...prev,
					[device.id]: result.success,
				}));
			} else {
				setTestResults((prev) => ({
					...prev,
					[device.id]: false,
				}));
			}
		} catch {
			setTestResults((prev) => ({
				...prev,
				[device.id]: false,
			}));
		} finally {
			setTestingDeviceId(null);
		}
	};

	if (loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: 3, maxWidth: 1200 }}>
			<Stack spacing={3}>
				<Alert severity="info">
					Tuya integration allows you to connect and control your Tuya smart home devices
					(thermostats, lights, plugs, etc.) through this home automation system.
				</Alert>

				{error && <Alert severity="error">{error}</Alert>}

				{/* Credentials Section */}
				<Card>
					<CardContent>
						<Stack spacing={2}>
							<Typography variant="h6" gutterBottom>
								API Credentials
							</Typography>
							<Typography variant="body2" color="text.secondary">
								These credentials are optional and used for device discovery and
								cloud features. For local-only control, you only need device ID and
								key.
							</Typography>
							<TextField
								label="API Key"
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
								fullWidth
								size="small"
							/>
							<TextField
								label="API Secret"
								value={apiSecret}
								onChange={(e) => setApiSecret(e.target.value)}
								type="password"
								fullWidth
								size="small"
							/>
							<TextField
								label="Region"
								value={apiRegion}
								onChange={(e) => setApiRegion(e.target.value)}
								select
								fullWidth
								size="small"
							>
								<MenuItem value="us">United States</MenuItem>
								<MenuItem value="eu">Europe</MenuItem>
								<MenuItem value="cn">China</MenuItem>
								<MenuItem value="in">India</MenuItem>
							</TextField>
							<Box>
								<Button
									variant="contained"
									onClick={handleSaveCredentials}
									disabled={saving}
								>
									{saving ? <CircularProgress size={24} /> : 'Save Credentials'}
								</Button>
							</Box>
						</Stack>
					</CardContent>
				</Card>

				{/* Devices Section */}
				<Card>
					<CardContent>
						<Stack spacing={2}>
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
								}}
							>
								<Typography variant="h6">Devices</Typography>
								<Button
									variant="contained"
									onClick={() => handleOpenDeviceDialog()}
									disabled={saving}
								>
									Add Device
								</Button>
							</Box>

							{config && config.devices.length > 0 ? (
								<Table>
									<TableHead>
										<TableRow>
											<TableCell>Name</TableCell>
											<TableCell>Type</TableCell>
											<TableCell>Device ID</TableCell>
											<TableCell>Status</TableCell>
											<TableCell>Actions</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{config.devices.map((device) => (
											<TableRow key={device.id}>
												<TableCell>{device.name}</TableCell>
												<TableCell>
													<Chip label={device.type} size="small" />
												</TableCell>
												<TableCell>
													<Typography
														variant="body2"
														sx={{ fontFamily: 'monospace' }}
													>
														{device.id.slice(0, 12)}...
													</Typography>
												</TableCell>
												<TableCell>
													{testingDeviceId === device.id ? (
														<CircularProgress size={20} />
													) : testResults[device.id] !== undefined ? (
														testResults[device.id] ? (
															<CheckCircleIcon color="success" />
														) : (
															<ErrorIcon color="error" />
														)
													) : null}
												</TableCell>
												<TableCell>
													<IconButton
														size="small"
														onClick={() => handleTestDevice(device)}
														disabled={testingDeviceId !== null}
													>
														<CheckCircleIcon />
													</IconButton>
													<IconButton
														size="small"
														onClick={() =>
															handleOpenDeviceDialog(device)
														}
													>
														<EditIcon />
													</IconButton>
													<IconButton
														size="small"
														onClick={() =>
															void handleDeleteDevice(device.id)
														}
														disabled={saving}
													>
														<DeleteIcon />
													</IconButton>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							) : (
								<Typography
									color="text.secondary"
									sx={{ textAlign: 'center', py: 2 }}
								>
									No devices configured. Click "Add Device" to get started.
								</Typography>
							)}
						</Stack>
					</CardContent>
				</Card>
			</Stack>

			{/* Device Dialog */}
			<Dialog
				open={deviceDialogOpen}
				onClose={handleCloseDeviceDialog}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>{editingDevice ? 'Edit Device' : 'Add Device'}</DialogTitle>
				<DialogContent>
					<Stack spacing={2} sx={{ mt: 1 }}>
						<TextField
							label="Device Name"
							value={deviceName}
							onChange={(e) => setDeviceName(e.target.value)}
							fullWidth
							size="small"
						/>
						<TextField
							label="Device ID"
							value={deviceId}
							onChange={(e) => setDeviceId(e.target.value)}
							fullWidth
							size="small"
							helperText="Found in Tuya app or device documentation"
						/>
						<TextField
							label="Device Key"
							value={deviceKey}
							onChange={(e) => setDeviceKey(e.target.value)}
							fullWidth
							size="small"
							type="password"
							helperText="Local key from Tuya app"
						/>
						<TextField
							label="Device Type"
							value={deviceType}
							onChange={(e) => setDeviceType(e.target.value as 'thermostat')}
							select
							fullWidth
							size="small"
						>
							<MenuItem value="thermostat">Thermostat</MenuItem>
						</TextField>
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCloseDeviceDialog}>Cancel</Button>
					<Button
						onClick={handleSaveDevice}
						variant="contained"
						disabled={saving || !deviceId || !deviceKey || !deviceName || !deviceType}
					>
						{saving ? <CircularProgress size={24} /> : 'Save'}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};
