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
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import AddIcon from '@mui/icons-material/Add';
import { useDevices } from './Devices';

export const LEDSourcesConfig = (): JSX.Element => {
	// WLED State
	const [wledConfig, setWledConfig] = useState<{ devices: string[] }>({ devices: [] });
	const [newWledIP, setNewWledIP] = useState('');
	const [wledLoading, setWledLoading] = useState(false);
	const [wledError, setWledError] = useState<string | null>(null);
	const [wledSuccess, setWledSuccess] = useState(false);

	const { devices } = useDevices();

	// LED Art State
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
			const response = await apiGet('led-art', '/config', {});
			if (response.ok) {
				setHexLedConfig(await response.json());
			}
		} catch (err) {
			console.error('Failed to load LED Art config:', err);
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
		} catch {
			setWledError('Failed to save configuration');
		} finally {
			setWledLoading(false);
		}
	};

	const saveHexLedConfig = async (
		newConfig: ReturnTypeForApi<'led-art', '/config', 'GET'>['ok']
	) => {
		setHexLedLoading(true);
		setHexLedError(null);
		setHexLedSuccess(false);

		try {
			const response = await apiPost('led-art', '/config', {}, newConfig);

			if (response.ok) {
				setHexLedConfig(newConfig);
				setHexLedSuccess(true);
				setTimeout(() => setHexLedSuccess(false), 3000);
			} else {
				const errorData = await response.json();
				setHexLedError(errorData.error || 'Failed to save configuration');
			}
		} catch {
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
										{wledConfig.devices.map((ip, index) => {
											const isOnline = devices.some(
												(device) =>
													device.source.name === 'wled' &&
													device.managementUrl === `http://${ip}`
											);
											return (
												<React.Fragment key={ip}>
													{index > 0 && <Divider />}
													<ListItem>
														<ListItemText
															primary={
																<Box
																	display="flex"
																	alignItems="center"
																	gap={1}
																>
																	{ip}
																	{isOnline ? (
																		<Typography
																			component="span"
																			variant="caption"
																			color="success.main"
																			sx={{
																				display: 'flex',
																				alignItems:
																					'center',
																				ml: 1,
																			}}
																		>
																			<Box
																				component="span"
																				sx={{
																					width: 10,
																					height: 10,
																					borderRadius:
																						'50%',
																					backgroundColor:
																						'success.main',
																					display:
																						'inline-block',
																					mr: 0.5,
																				}}
																			/>
																			Online
																		</Typography>
																	) : (
																		<Typography
																			component="span"
																			variant="caption"
																			color="text.secondary"
																			sx={{
																				display: 'flex',
																				alignItems:
																					'center',
																				ml: 1,
																			}}
																		>
																			<Box
																				component="span"
																				sx={{
																					width: 10,
																					height: 10,
																					borderRadius:
																						'50%',
																					backgroundColor:
																						(theme) =>
																							theme
																								.palette
																								.mode ===
																							'dark'
																								? theme
																										.palette
																										.grey[700]
																								: theme
																										.palette
																										.grey[300],
																					display:
																						'inline-block',
																					mr: 0.5,
																				}}
																			/>
																			Offline
																		</Typography>
																	)}
																</Box>
															}
															secondary={`http://${ip}`}
														/>
														<ListItemSecondaryAction>
															{!isOnline && (
																<IconButton
																	edge="end"
																	aria-label="refresh"
																	onClick={() =>
																		void apiPost(
																			'wled',
																			'/refresh',
																			{}
																		)
																	}
																	disabled={wledLoading}
																>
																	<RefreshIcon />
																</IconButton>
															)}
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
											);
										})}
									</List>
								)}
							</Stack>
						</CardContent>
					</Card>
				</Box>

				<Divider />

				{/* LED Art Section */}
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
							LED Art configuration saved successfully!
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
										No LED Art devices configured
									</Typography>
								) : (
									<List sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
										{hexLedConfig.devices.map((url, index) => {
											const isOnline = devices.some(
												(device) =>
													device.source.name === 'led-art' &&
													device.managementUrl === url
											);
											return (
												<React.Fragment key={url}>
													{index > 0 && <Divider />}
													<ListItem>
														<ListItemText
															primary={
																<Box
																	display="flex"
																	alignItems="center"
																	gap={1}
																>
																	{url}
																	{isOnline ? (
																		<Typography
																			component="span"
																			variant="caption"
																			color="success.main"
																			sx={{
																				display: 'flex',
																				alignItems:
																					'center',
																				ml: 1,
																			}}
																		>
																			<Box
																				component="span"
																				sx={{
																					width: 10,
																					height: 10,
																					borderRadius:
																						'50%',
																					backgroundColor:
																						'success.main',
																					display:
																						'inline-block',
																					mr: 0.5,
																				}}
																			/>
																			Online
																		</Typography>
																	) : (
																		<Typography
																			component="span"
																			variant="caption"
																			color="text.secondary"
																			sx={{
																				display: 'flex',
																				alignItems:
																					'center',
																				ml: 1,
																			}}
																		>
																			<Box
																				component="span"
																				sx={{
																					width: 10,
																					height: 10,
																					borderRadius:
																						'50%',
																					backgroundColor:
																						(theme) =>
																							theme
																								.palette
																								.mode ===
																							'dark'
																								? theme
																										.palette
																										.grey[700]
																								: theme
																										.palette
																										.grey[400],
																					display:
																						'inline-block',
																					mr: 0.5,
																				}}
																			/>
																			Offline
																		</Typography>
																	)}
																</Box>
															}
														/>
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
											);
										})}
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
