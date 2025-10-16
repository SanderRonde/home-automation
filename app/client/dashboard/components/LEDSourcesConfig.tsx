import {
	Box,
	Card,
	CardContent,
	Typography,
	Button,
	Alert,
	Stack,
	TextField,
	IconButton,
	List,
	ListItem,
	ListItemText,
	ListItemSecondaryAction,
	Divider,
} from '@mui/material';
import type { ReturnTypeForApi } from '../../lib/fetch';
import DeleteIcon from '@mui/icons-material/Delete';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import AddIcon from '@mui/icons-material/Add';

export const LEDSourcesConfig = (): JSX.Element => {
	// WLED State
	const [wledConfig, setWledConfig] = useState<{ devices: string[] }>({ devices: [] });
	const [newWledIP, setNewWledIP] = useState('');
	const [wledLoading, setWledLoading] = useState(false);
	const [wledError, setWledError] = useState<string | null>(null);
	const [wledSuccess, setWledSuccess] = useState(false);

	// Hex-LED State
	const [hexLedConfig, setHexLedConfig] = useState<{ devices: string[] }>({ devices: [] });
	const [newHexLedUrl, setNewHexLedUrl] = useState('');
	const [hexLedLoading, setHexLedLoading] = useState(false);
	const [hexLedError, setHexLedError] = useState<string | null>(null);
	const [hexLedSuccess, setHexLedSuccess] = useState(false);

	// Load configs on component mount
	useEffect(() => {
		void loadWledConfig();
		void loadHexLedConfig();
	}, []);

	const loadWledConfig = async () => {
		try {
			const response = await apiGet('wled', '/config', {});
			if (response.ok) {
				setWledConfig(await response.json());
			}
		} catch (err) {
			console.error('Failed to load WLED config:', err);
		}
	};

	const loadHexLedConfig = async () => {
		try {
			const response = await apiGet('hex-led', '/config', {});
			if (response.ok) {
				setHexLedConfig(await response.json());
			}
		} catch (err) {
			console.error('Failed to load Hex-LED config:', err);
		}
	};

	const saveWledConfig = async (newConfig: ReturnTypeForApi<'wled', '/config', 'GET'>['ok']) => {
		setWledLoading(true);
		setWledError(null);
		setWledSuccess(false);

		try {
			const response = await apiPost('wled', '/config', {}, newConfig);

			if (response.ok) {
				setWledConfig(newConfig);
				setWledSuccess(true);
				setTimeout(() => setWledSuccess(false), 3000);
			} else {
				const errorData = await response.json();
				setWledError(errorData.error || 'Failed to save configuration');
			}
		} catch (err) {
			setWledError('Failed to save configuration');
		} finally {
			setWledLoading(false);
		}
	};

	const saveHexLedConfig = async (
		newConfig: ReturnTypeForApi<'hex-led', '/config', 'GET'>['ok']
	) => {
		setHexLedLoading(true);
		setHexLedError(null);
		setHexLedSuccess(false);

		try {
			const response = await apiPost('hex-led', '/config', {}, newConfig);

			if (response.ok) {
				setHexLedConfig(newConfig);
				setHexLedSuccess(true);
				setTimeout(() => setHexLedSuccess(false), 3000);
			} else {
				const errorData = await response.json();
				setHexLedError(errorData.error || 'Failed to save configuration');
			}
		} catch (err) {
			setHexLedError('Failed to save configuration');
		} finally {
			setHexLedLoading(false);
		}
	};

	const addWledDevice = async () => {
		if (!newWledIP.trim()) {
			return;
		}

		const updatedDevices = [...wledConfig.devices, newWledIP.trim()];
		await saveWledConfig({ devices: updatedDevices });
		setNewWledIP('');
	};

	const removeWledDevice = async (ip: string) => {
		const updatedDevices = wledConfig.devices.filter((device) => device !== ip);
		await saveWledConfig({ devices: updatedDevices });
	};

	const addHexLedDevice = async () => {
		if (!newHexLedUrl.trim()) {
			return;
		}

		const updatedDevices = [...hexLedConfig.devices, newHexLedUrl.trim()];
		await saveHexLedConfig({ devices: updatedDevices });
		setNewHexLedUrl('');
	};

	const removeHexLedDevice = async (url: string) => {
		const updatedDevices = hexLedConfig.devices.filter((device) => device !== url);
		await saveHexLedConfig({ devices: updatedDevices });
	};

	const handleWledKeyPress = (event: React.KeyboardEvent) => {
		if (event.key === 'Enter') {
			void addWledDevice();
		}
	};

	const handleHexLedKeyPress = (event: React.KeyboardEvent) => {
		if (event.key === 'Enter') {
			void addHexLedDevice();
		}
	};

	return (
		<Box sx={{ p: 3, maxWidth: 800 }}>
			<Stack spacing={4}>
				<Alert severity="info">
					Configure LED devices by adding their addresses. These devices will be
					automatically discovered and made available for control in your home automation
					system.
				</Alert>

				{/* WLED Section */}
				<Box>
					<Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
						WLED Devices
					</Typography>

					{wledError && (
						<Alert severity="error" onClose={() => setWledError(null)} sx={{ mb: 2 }}>
							{wledError}
						</Alert>
					)}

					{wledSuccess && (
						<Alert severity="success" sx={{ mb: 2 }}>
							WLED configuration saved successfully!
						</Alert>
					)}

					<Card>
						<CardContent>
							<Stack spacing={3}>
								<Typography variant="body2" color="text.secondary">
									WLED is an open-source firmware for ESP8266/ESP32 based LED
									strips. Add devices by their IP address.
								</Typography>

								<Box display="flex" gap={2} alignItems="flex-start">
									<TextField
										label="IP Address"
										placeholder="192.168.1.100"
										value={newWledIP}
										onChange={(e) => setNewWledIP(e.target.value)}
										onKeyPress={handleWledKeyPress}
										size="small"
										sx={{ flexGrow: 1 }}
										disabled={wledLoading}
									/>
									<Button
										variant="contained"
										onClick={addWledDevice}
										startIcon={<AddIcon />}
										disabled={wledLoading || !newWledIP.trim()}
									>
										Add Device
									</Button>
								</Box>

								{wledConfig.devices.length === 0 ? (
									<Typography
										variant="body2"
										color="text.secondary"
										sx={{ py: 2 }}
									>
										No WLED devices configured
									</Typography>
								) : (
									<List sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
										{wledConfig.devices.map((ip, index) => (
											<React.Fragment key={ip}>
												{index > 0 && <Divider />}
												<ListItem>
													<ListItemText
														primary={ip}
														secondary={`http://${ip}`}
													/>
													<ListItemSecondaryAction>
														<IconButton
															edge="end"
															aria-label="delete"
															onClick={() =>
																void removeWledDevice(ip)
															}
															disabled={wledLoading}
														>
															<DeleteIcon />
														</IconButton>
													</ListItemSecondaryAction>
												</ListItem>
											</React.Fragment>
										))}
									</List>
								)}
							</Stack>
						</CardContent>
					</Card>
				</Box>

				<Divider />

				{/* Hex-LED Section */}
				<Box>
					<Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
						Hexagon LED Panels
					</Typography>

					{hexLedError && (
						<Alert severity="error" onClose={() => setHexLedError(null)} sx={{ mb: 2 }}>
							{hexLedError}
						</Alert>
					)}

					{hexLedSuccess && (
						<Alert severity="success" sx={{ mb: 2 }}>
							Hex-LED configuration saved successfully!
						</Alert>
					)}

					<Card>
						<CardContent>
							<Stack spacing={3}>
								<Typography variant="body2" color="text.secondary">
									Hexagon LED panels are modular LED light panels. Add devices by
									their full URL (including http:// and port if needed).
								</Typography>

								<Box display="flex" gap={2} alignItems="flex-start">
									<TextField
										label="Device URL"
										placeholder="http://192.168.1.101:8080"
										value={newHexLedUrl}
										onChange={(e) => setNewHexLedUrl(e.target.value)}
										onKeyPress={handleHexLedKeyPress}
										size="small"
										sx={{ flexGrow: 1 }}
										disabled={hexLedLoading}
									/>
									<Button
										variant="contained"
										onClick={addHexLedDevice}
										startIcon={<AddIcon />}
										disabled={hexLedLoading || !newHexLedUrl.trim()}
									>
										Add Device
									</Button>
								</Box>

								{hexLedConfig.devices.length === 0 ? (
									<Typography
										variant="body2"
										color="text.secondary"
										sx={{ py: 2 }}
									>
										No Hex-LED devices configured
									</Typography>
								) : (
									<List sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
										{hexLedConfig.devices.map((url, index) => (
											<React.Fragment key={url}>
												{index > 0 && <Divider />}
												<ListItem>
													<ListItemText primary={url} />
													<ListItemSecondaryAction>
														<IconButton
															edge="end"
															aria-label="delete"
															onClick={() =>
																void removeHexLedDevice(url)
															}
															disabled={hexLedLoading}
														>
															<DeleteIcon />
														</IconButton>
													</ListItemSecondaryAction>
												</ListItem>
											</React.Fragment>
										))}
									</List>
								)}
							</Stack>
						</CardContent>
					</Card>
				</Box>
			</Stack>
		</Box>
	);
};
