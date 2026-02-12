import {
	Box,
	Card,
	CardContent,
	Typography,
	Button,
	Alert,
	Stack,
	TextField,
	InputAdornment,
	IconButton,
	Switch,
	FormControlLabel,
	Chip,
} from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import SaveIcon from '@mui/icons-material/Save';

interface ConfigState {
	hasConfig: boolean;
	ip?: string;
	serial?: string;
	accessCodeMasked?: string;
	enabled?: boolean;
}

interface StatusState {
	status: {
		timestamp: number;
		state: string;
		temperature?: {
			bed?: number;
			nozzle?: number;
		};
		progress?: number;
		currentFile?: string;
	} | null;
	connected: boolean;
}

export const BambuLabConfig = (): JSX.Element => {
	const [config, setConfig] = useState<ConfigState | null>(null);
	const [status, setStatus] = useState<StatusState | null>(null);
	const [ip, setIp] = useState<string>('');
	const [serial, setSerial] = useState<string>('');
	const [accessCode, setAccessCode] = useState<string>('');
	const [enabled, setEnabled] = useState<boolean>(true);
	const [showAccessCode, setShowAccessCode] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Load config and status on mount
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
			const response = await apiGet('bambulab', '/config', {});
			if (response.ok) {
				const data = (await response.json()) as ConfigState;
				setConfig(data);
				if (data.hasConfig) {
					setIp(data.ip ?? '');
					setSerial(data.serial ?? '');
					setEnabled(data.enabled ?? true);
				}
			}
		} catch (err) {
			console.error('Failed to load Bambu Lab config:', err);
		}
	};

	const loadStatus = async () => {
		try {
			const response = await apiGet('bambulab', '/status', {});
			if (response.ok) {
				const data = (await response.json()) as StatusState;
				setStatus(data);
			}
		} catch (err) {
			console.error('Failed to load Bambu Lab status:', err);
		}
	};

	const saveConfig = async () => {
		if (!ip.trim() || !serial.trim() || (!accessCode.trim() && !config?.hasConfig)) {
			setError('Please fill in all required fields');
			return;
		}

		setLoading(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await apiPost(
				'bambulab',
				'/config-save',
				{},
				{
					ip: ip.trim(),
					serial: serial.trim(),
					accessCode: accessCode.trim(),
					enabled,
				}
			);

			if (response.ok) {
				setSuccess('Configuration saved successfully');
				setAccessCode(''); // Clear access code field
				await loadConfig();
				setTimeout(() => setSuccess(null), 3000);
			} else {
				const errorData = (await response.json()) as { error?: string };
				setError(errorData.error ?? 'Failed to save configuration');
			}
		} catch {
			setError('Failed to save configuration');
		} finally {
			setLoading(false);
		}
	};

	return (
		<Box sx={{ p: 3, maxWidth: 800 }}>
			<Stack spacing={3}>
				<Alert severity="info">
					Bambu Lab integration monitors your P1P/P1S 3D printer via MQTT. Configure
					the printer's IP address, serial number, and access code below.
				</Alert>

				{error && (
					<Alert severity="error" onClose={() => setError(null)}>
						{error}
					</Alert>
				)}

				{success && (
					<Alert severity="success" onClose={() => setSuccess(null)}>
						{success}
					</Alert>
				)}

				{/* Configuration Card */}
				<Card>
					<CardContent>
						<Stack spacing={2}>
							<Typography variant="h6" gutterBottom>
								Printer Configuration
							</Typography>

							<TextField
								fullWidth
								label="IP Address"
								value={ip}
								onChange={(e) => setIp(e.target.value)}
								placeholder="192.168.1.100"
								disabled={loading}
								helperText="Local IP address of your Bambu Lab printer"
							/>

							<TextField
								fullWidth
								label="Serial Number"
								value={serial}
								onChange={(e) => setSerial(e.target.value)}
								placeholder="01P00A123456789"
								disabled={loading}
								helperText="Serial number from printer settings"
							/>

							<TextField
								fullWidth
								label="Access Code"
								type={showAccessCode ? 'text' : 'password'}
								value={accessCode}
								onChange={(e) => setAccessCode(e.target.value)}
								placeholder={
									config?.hasConfig
										? 'Leave blank to keep current'
										: 'Enter access code'
								}
								disabled={loading}
								helperText="Access code from printer settings (LAN mode)"
								InputProps={{
									endAdornment: (
										<InputAdornment position="end">
											<IconButton
												onClick={() => setShowAccessCode(!showAccessCode)}
												edge="end"
												aria-label="toggle access code visibility"
											>
												{showAccessCode ? (
													<VisibilityOffIcon />
												) : (
													<VisibilityIcon />
												)}
											</IconButton>
										</InputAdornment>
									),
								}}
							/>

							<FormControlLabel
								control={
									<Switch
										checked={enabled}
										onChange={(e) => setEnabled(e.target.checked)}
										disabled={loading}
									/>
								}
								label="Enable monitoring"
							/>

							<Box>
								<Button
									variant="contained"
									color="primary"
									onClick={() => void saveConfig()}
									startIcon={<SaveIcon />}
									size="large"
									disabled={loading || !ip.trim() || !serial.trim()}
								>
									Save Configuration
								</Button>
							</Box>
						</Stack>
					</CardContent>
				</Card>

				{/* Status Card */}
				{status && (
					<Card>
						<CardContent>
							<Stack spacing={2}>
								<Box display="flex" justifyContent="space-between" alignItems="center">
									<Typography variant="h6">Printer Status</Typography>
									<Chip
										label={status.connected ? 'Connected' : 'Disconnected'}
										color={status.connected ? 'success' : 'default'}
										size="small"
									/>
								</Box>

								{status.status ? (
									<Stack spacing={1}>
										<Typography variant="body2">
											<strong>State:</strong> {status.status.state}
										</Typography>
										{status.status.progress !== undefined && (
											<Typography variant="body2">
												<strong>Progress:</strong> {status.status.progress}%
											</Typography>
										)}
										{status.status.currentFile && (
											<Typography variant="body2">
												<strong>File:</strong> {status.status.currentFile}
											</Typography>
										)}
										{status.status.temperature && (
											<>
												{status.status.temperature.bed !== undefined && (
													<Typography variant="body2">
														<strong>Bed Temp:</strong>{' '}
														{status.status.temperature.bed}°C
													</Typography>
												)}
												{status.status.temperature.nozzle !== undefined && (
													<Typography variant="body2">
														<strong>Nozzle Temp:</strong>{' '}
														{status.status.temperature.nozzle}°C
													</Typography>
												)}
											</>
										)}
										<Typography variant="caption" color="text.secondary">
											Last update:{' '}
											{new Date(status.status.timestamp).toLocaleString()}
										</Typography>
									</Stack>
								) : (
									<Typography color="text.secondary">
										No status data available. Ensure the printer is configured and
										online.
									</Typography>
								)}
							</Stack>
						</CardContent>
					</Card>
				)}

				{/* Help Card */}
				<Card>
					<CardContent>
						<Stack spacing={2}>
							<Typography variant="h6">Setup Instructions</Typography>
							<Typography variant="body2" component="div">
								<ol>
									<li>Enable LAN mode on your Bambu Lab printer</li>
									<li>
										Find the printer's IP address, serial number, and access code in
										printer settings
									</li>
									<li>Enter the configuration details above</li>
									<li>Click "Save Configuration" to start monitoring</li>
								</ol>
							</Typography>
						</Stack>
					</CardContent>
				</Card>
			</Stack>
		</Box>
	);
};
