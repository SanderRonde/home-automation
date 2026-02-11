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
	CircularProgress,
} from '@mui/material';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

interface ConfigState {
	hasToken: boolean;
	tokenMasked?: string;
}

interface DeviceInfo {
	id: string;
	name: string;
	type: 'smartlock' | 'opener';
}

const NUKI_WEB_URL = 'https://web.nuki.io';

export const NukiConfig = (): JSX.Element => {
	const [config, setConfig] = useState<ConfigState | null>(null);
	const [apiToken, setApiToken] = useState('');
	const [saving, setSaving] = useState(false);
	const [loading, setLoading] = useState(true);
	const [devices, setDevices] = useState<DeviceInfo[]>([]);
	const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
		null
	);

	useEffect(() => {
		const load = async () => {
			try {
				const [configRes, devicesRes] = await Promise.all([
					apiGet('nuki', '/config', {}),
					apiGet('nuki', '/devices', {}),
				]);
				if (configRes.ok) {
					const data = (await configRes.json()) as ConfigState;
					setConfig(data);
				}
				if (devicesRes.ok) {
					const data = (await devicesRes.json()) as { devices: DeviceInfo[] };
					setDevices(data.devices ?? []);
				}
			} catch (error) {
				console.error('Failed to load Nuki config:', error);
				setMessage({ type: 'error', text: 'Failed to load config' });
			} finally {
				setLoading(false);
			}
		};
		void load();
	}, []);

	const handleSave = async () => {
		setSaving(true);
		setMessage(null);
		try {
			const response = await apiPost('nuki', '/config', {}, { apiToken: apiToken.trim() });
			if (response.ok) {
				setMessage({
					type: 'success',
					text: 'API token saved. Devices will refresh shortly.',
				});
				setApiToken('');
				const configRes = await apiGet('nuki', '/config', {});
				if (configRes.ok) {
					const data = (await configRes.json()) as ConfigState;
					setConfig(data);
				}
				const devicesRes = await apiGet('nuki', '/devices', {});
				if (devicesRes.ok) {
					const data = (await devicesRes.json()) as { devices: DeviceInfo[] };
					setDevices(data.devices ?? []);
				}
			} else {
				const err = (await response.json()) as { error?: string; message?: string };
				setMessage({
					type: 'error',
					text: err.error ?? err.message ?? 'Save failed',
				});
			}
		} catch (error) {
			console.error('Failed to save Nuki config:', error);
			setMessage({ type: 'error', text: 'Failed to save config' });
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: 3, maxWidth: 800 }}>
			<Stack spacing={3}>
				<Alert severity="info">
					Nuki integration controls Nuki smart locks and openers via the Nuki Web API.
					Create an API token in the Nuki Web Portal and paste it below. Tokens can be
					created at{' '}
					<a href={NUKI_WEB_URL} target="_blank" rel="noreferrer">
						{NUKI_WEB_URL}
					</a>
					.
				</Alert>

				<Card>
					<CardContent>
						<Stack spacing={2}>
							<Typography variant="h6" gutterBottom>
								API token
							</Typography>
							{config?.hasToken && (
								<Typography variant="body2" color="text.secondary">
									Current token: {config.tokenMasked ?? '••••••••'}
								</Typography>
							)}
							<TextField
								label="API token"
								type="password"
								value={apiToken}
								onChange={(e) => setApiToken(e.target.value)}
								fullWidth
								size="small"
								autoComplete="off"
								placeholder={config?.hasToken ? 'Enter new token to replace' : ''}
								helperText="Create a token in Nuki Web Portal (Settings → Advanced → API)"
							/>
							<Button
								variant="contained"
								color="primary"
								onClick={handleSave}
								disabled={saving || !apiToken.trim()}
							>
								{saving ? 'Saving…' : 'Save'}
							</Button>
							{message !== null && message !== undefined && (
								<Alert severity={message.type} onClose={() => setMessage(null)}>
									{message.text}
								</Alert>
							)}
						</Stack>
					</CardContent>
				</Card>

				<Card>
					<CardContent>
						<Stack spacing={2}>
							<Typography variant="h6" gutterBottom>
								Devices
							</Typography>
							{devices.length === 0 ? (
								<Typography color="text.secondary">
									No Nuki devices found. Save a valid API token to discover smart
									locks and openers.
								</Typography>
							) : (
								<List dense>
									{devices.map((d) => (
										<ListItem key={d.id}>
											<ListItemText
												primary={d.name}
												secondary={`${d.type} • ${d.id}`}
											/>
										</ListItem>
									))}
								</List>
							)}
						</Stack>
					</CardContent>
				</Card>
			</Stack>
		</Box>
	);
};
