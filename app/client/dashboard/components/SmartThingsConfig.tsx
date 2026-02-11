import {
	Box,
	Card,
	CardContent,
	Typography,
	Button,
	Alert,
	Stack,
	TextField,
	CircularProgress,
} from '@mui/material';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

interface ConfigState {
	clientId: string;
	hasClientSecret: boolean;
	webhookPath: string;
}

export const SmartThingsConfig = (): JSX.Element => {
	const [config, setConfig] = useState<ConfigState | null>(null);
	const [clientId, setClientId] = useState('');
	const [clientSecret, setClientSecret] = useState('');
	const [saving, setSaving] = useState(false);
	const [loading, setLoading] = useState(true);
	const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
		null
	);

	useEffect(() => {
		const load = async () => {
			try {
				const response = await apiGet('smartthings', '/config', {});
				if (response.ok) {
					const data = (await response.json()) as ConfigState;
					setConfig(data);
					setClientId(data.clientId ?? '');
				}
			} catch (error) {
				console.error('Failed to load SmartThings config:', error);
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
			const body: { clientId: string; clientSecret?: string } = { clientId };
			if (clientSecret.trim() !== '') {
				body.clientSecret = clientSecret;
			}
			const response = await apiPost('smartthings', '/config', {}, body);
			if (response.ok) {
				setMessage({ type: 'success', text: 'Config saved.' });
				setConfig((prev) =>
					prev
						? {
								...prev,
								clientId,
								hasClientSecret: Boolean(clientSecret) || prev.hasClientSecret,
							}
						: null
				);
			} else {
				const err = (await response.json()) as { error?: string };
				setMessage({ type: 'error', text: err.error ?? 'Save failed' });
			}
		} catch (error) {
			console.error('Failed to save SmartThings config:', error);
			setMessage({ type: 'error', text: 'Failed to save config' });
		} finally {
			setSaving(false);
		}
	};

	const webhookUrl =
		config?.webhookPath !== undefined && config?.webhookPath !== null
			? `${window.location.origin}${config.webhookPath.startsWith('/') ? '' : '/'}${config.webhookPath}`
			: '';

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
					SmartThings integration lets you connect devices from the SmartThings app. Enter
					your app credentials from the SmartThings Developer Workspace and register the
					webhook URL there.
				</Alert>

				<Card>
					<CardContent>
						<Stack spacing={2}>
							<Typography variant="h6" gutterBottom>
								App credentials
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Create a Webhook SmartApp in the SmartThings Developer Workspace and
								paste the Client ID and Client Secret here.
							</Typography>
							<TextField
								label="Client ID"
								value={clientId}
								onChange={(e) => setClientId(e.target.value)}
								fullWidth
								size="small"
								autoComplete="off"
							/>
							<TextField
								label="Client Secret"
								type="password"
								value={clientSecret}
								onChange={(e) => setClientSecret(e.target.value)}
								fullWidth
								size="small"
								autoComplete="off"
								placeholder={config?.hasClientSecret ? '••••••••' : ''}
								helperText={
									config?.hasClientSecret
										? 'Leave blank to keep existing secret'
										: undefined
								}
							/>
							<Box>
								<Button
									variant="contained"
									color="primary"
									onClick={handleSave}
									disabled={saving || !clientId.trim()}
								>
									{saving ? 'Saving…' : 'Save'}
								</Button>
							</Box>
							{message !== null && message !== undefined && (
								<Alert severity={message.type} onClose={() => setMessage(null)}>
									{message.text}
								</Alert>
							)}
						</Stack>
					</CardContent>
				</Card>

				{webhookUrl && (
					<Card>
						<CardContent>
							<Stack spacing={2}>
								<Typography variant="h6" gutterBottom>
									Webhook URL
								</Typography>
								<Typography variant="body2" color="text.secondary">
									Register this URL as the target URL for your Webhook SmartApp in
									the Developer Workspace.
								</Typography>
								<TextField
									value={webhookUrl}
									fullWidth
									size="small"
									InputProps={{ readOnly: true }}
									onFocus={(e) => e.target.select()}
								/>
							</Stack>
						</CardContent>
					</Card>
				)}
			</Stack>
		</Box>
	);
};
