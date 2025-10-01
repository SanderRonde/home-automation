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
	Chip,
} from '@mui/material';
import type { ReturnTypeForApi } from '../../lib/fetch';
import DeleteIcon from '@mui/icons-material/Delete';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import AddIcon from '@mui/icons-material/Add';

export const WLEDConfig = (): JSX.Element => {
	const [config, setConfig] = useState<
		ReturnTypeForApi<'wled', '/config', 'GET'>['ok']
	>({ devices: [] });
	const [newIP, setNewIP] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	// Load config on component mount
	useEffect(() => {
		void loadConfig();
	}, []);

	const loadConfig = async () => {
		try {
			const response = await apiGet('wled', '/config', {});
			if (response.ok) {
				setConfig(await response.json());
			}
		} catch (err) {
			console.error('Failed to load WLED config:', err);
		}
	};

	const saveConfig = async (
		newConfig: ReturnTypeForApi<'wled', '/config', 'GET'>['ok']
	) => {
		setLoading(true);
		setError(null);
		setSuccess(false);

		try {
			const response = await apiPost('wled', '/config', {}, newConfig);

			if (response.ok) {
				setConfig(newConfig);
				setSuccess(true);
				setTimeout(() => setSuccess(false), 3000);
			} else {
				const errorData = await response.json();
				setError(errorData.error || 'Failed to save configuration');
			}
		} catch (err) {
			setError('Failed to save configuration');
		} finally {
			setLoading(false);
		}
	};

	const addDevice = async () => {
		if (!newIP.trim()) {
			return;
		}

		// Basic IP validation
		const ipRegex =
			/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
		if (!ipRegex.test(newIP.trim())) {
			setError('Please enter a valid IP address');
			return;
		}

		if (config.devices.includes(newIP.trim())) {
			setError('This IP address is already in the list');
			return;
		}

		const newConfig = {
			...config,
			devices: [...config.devices, newIP.trim()],
		};

		await saveConfig(newConfig);
		setNewIP('');
	};

	const removeDevice = async (ip: string) => {
		const newConfig = {
			...config,
			devices: config.devices.filter((device) => device !== ip),
		};
		await saveConfig(newConfig);
	};

	const handleKeyPress = (event: React.KeyboardEvent) => {
		if (event.key === 'Enter') {
			void addDevice();
		}
	};

	return (
		<Box sx={{ p: 3, maxWidth: 800 }}>
			<Stack spacing={3}>
				<Alert severity="info">
					Configure WLED devices by adding their IP addresses. These
					devices will be automatically discovered and made available
					for control in your home automation system.
				</Alert>

				{error && (
					<Alert severity="error" onClose={() => setError(null)}>
						{error}
					</Alert>
				)}

				{success && (
					<Alert severity="success">
						Configuration saved successfully!
					</Alert>
				)}

				<Card>
					<CardContent>
						<Stack spacing={3}>
							<Typography variant="h6" gutterBottom>
								WLED Devices
							</Typography>

							<Box display="flex" gap={2} alignItems="flex-start">
								<TextField
									label="IP Address"
									placeholder="192.168.1.100"
									value={newIP}
									onChange={(e) => setNewIP(e.target.value)}
									onKeyPress={handleKeyPress}
									size="small"
									sx={{ flexGrow: 1 }}
									disabled={loading}
								/>
								<Button
									variant="contained"
									onClick={addDevice}
									startIcon={<AddIcon />}
									disabled={loading || !newIP.trim()}
								>
									Add Device
								</Button>
							</Box>

							{config.devices.length === 0 ? (
								<Alert severity="info">
									No WLED devices configured. Add IP addresses
									above to get started.
								</Alert>
							) : (
								<List>
									{config.devices.map((ip, index) => (
										<ListItem key={index} divider>
											<ListItemText
												primary={ip}
												secondary="WLED Device"
											/>
											<ListItemSecondaryAction>
												<Chip
													label="Configured"
													color="success"
													size="small"
													sx={{ mr: 1 }}
												/>
												<IconButton
													edge="end"
													onClick={() =>
														removeDevice(ip)
													}
													disabled={loading}
													color="error"
												>
													<DeleteIcon />
												</IconButton>
											</ListItemSecondaryAction>
										</ListItem>
									))}
								</List>
							)}

							<Typography variant="body2" color="text.secondary">
								<strong>Note:</strong> Make sure your WLED
								devices are connected to the same network and
								accessible via HTTP. The system will
								automatically detect and configure them when
								they come online.
							</Typography>
						</Stack>
					</CardContent>
				</Card>
			</Stack>
		</Box>
	);
};
