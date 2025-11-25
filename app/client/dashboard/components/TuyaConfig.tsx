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
} from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import SaveIcon from '@mui/icons-material/Save';

export const TuyaConfig = (): JSX.Element => {
	const [apiKey, setApiKey] = useState<string>('');
	const [apiSecret, setApiSecret] = useState<string>('');
	const [apiRegion, setApiRegion] = useState<string>('');
	const [virtualDeviceId, setVirtualDeviceId] = useState<string>('');
	const [showSecret, setShowSecret] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Load config on component mount
	useEffect(() => {
		void loadConfig();
	}, []);

	const loadConfig = async () => {
		try {
			const response = await apiGet('tuya', '/config', {});
			if (response.ok) {
				const data = await response.json();
				setApiKey(data.apiKey ?? '');
				setApiRegion(data.apiRegion ?? '');
				setVirtualDeviceId(data.virtualDeviceId ?? '');
				// Don't load the secret, just indicate if it exists
				if (!data.hasApiSecret) {
					setApiSecret('');
				}
			}
		} catch (err) {
			console.error('Failed to load Tuya config:', err);
			setError('Failed to load configuration');
		}
	};

	const saveConfig = async () => {
		if (!apiKey.trim() || !apiSecret.trim() || !apiRegion.trim() || !virtualDeviceId.trim()) {
			setError('Please fill in all fields');
			return;
		}

		setLoading(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await apiPost(
				'tuya',
				'/config',
				{},
				{
					apiKey: apiKey.trim(),
					apiSecret: apiSecret.trim(),
					apiRegion: apiRegion.trim(),
					virtualDeviceId: virtualDeviceId.trim(),
				}
			);

			if (response.ok) {
				setSuccess('Configuration saved successfully');
				setTimeout(() => setSuccess(null), 3000);
			} else {
				const errorData = await response.json();
				setError(errorData.error || 'Failed to save configuration');
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
					Tuya integration allows you to connect and control your Tuya smart devices
					through this home automation system. You need to provide your Tuya API
					credentials to get started.
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

				<Card>
					<CardContent>
						<Stack spacing={2}>
							<Typography variant="h6" gutterBottom>
								Credentials Management
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Enter your Tuya API credentials below. You can obtain these from the
								Tuya IoT Platform.
							</Typography>

							<TextField
								fullWidth
								label="API Key"
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
								placeholder="Enter your Tuya API Key"
								disabled={loading}
							/>

							<TextField
								fullWidth
								label="API Secret"
								type={showSecret ? 'text' : 'password'}
								value={apiSecret}
								onChange={(e) => setApiSecret(e.target.value)}
								placeholder="Enter your Tuya API Secret"
								disabled={loading}
								InputProps={{
									endAdornment: (
										<InputAdornment position="end">
											<IconButton
												onClick={() => setShowSecret(!showSecret)}
												edge="end"
												aria-label="toggle password visibility"
											>
												{showSecret ? (
													<VisibilityOffIcon />
												) : (
													<VisibilityIcon />
												)}
											</IconButton>
										</InputAdornment>
									),
								}}
							/>

							<TextField
								fullWidth
								label="API Region"
								value={apiRegion}
								onChange={(e) => setApiRegion(e.target.value)}
								placeholder="e.g., eu, us, cn"
								disabled={loading}
								helperText="Enter the region code for your Tuya API (e.g., eu, us, cn)"
							/>

							<TextField
								fullWidth
								label="Virtual Device ID"
								value={virtualDeviceId}
								onChange={(e) => setVirtualDeviceId(e.target.value)}
								placeholder="Enter your Virtual Device ID"
								disabled={loading}
								helperText="The virtual device ID from your Tuya IoT Platform"
							/>

							<Box>
								<Button
									variant="contained"
									color="primary"
									onClick={() => void saveConfig()}
									startIcon={<SaveIcon />}
									size="large"
									disabled={
										loading ||
										!apiKey.trim() ||
										!apiSecret.trim() ||
										!apiRegion.trim() ||
										!virtualDeviceId.trim()
									}
								>
									Save Configuration
								</Button>
							</Box>
						</Stack>
					</CardContent>
				</Card>
			</Stack>
		</Box>
	);
};

