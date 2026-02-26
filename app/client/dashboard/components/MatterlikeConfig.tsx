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
import DeleteIcon from '@mui/icons-material/Delete';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import AddIcon from '@mui/icons-material/Add';

export const MatterlikeConfig = (): JSX.Element => {
	const [devices, setDevices] = useState<string[]>([]);
	const [newUrl, setNewUrl] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	useEffect(() => {
		void loadConfig();
	}, []);

	const loadConfig = async () => {
		try {
			const response = await apiGet('matterlike', '/config', {});
			if (response.ok) {
				const data = await response.json();
				setDevices(data.devices ?? []);
			}
		} catch (err) {
			console.error('Failed to load Matter-like config:', err);
		}
	};

	const saveConfig = async () => {
		setLoading(true);
		setError(null);
		setSuccess(false);
		try {
			const response = await apiPost('matterlike', '/config', {}, { devices });
			if (response.ok) {
				setSuccess(true);
				setTimeout(() => setSuccess(false), 3000);
			} else {
				const errorData = await response.json();
				setError(errorData.error ?? 'Failed to save configuration');
			}
		} catch {
			setError('Failed to save configuration');
		} finally {
			setLoading(false);
		}
	};

	const addUrl = () => {
		const trimmed = newUrl.trim();
		if (!trimmed) {
			return;
		}
		if (devices.includes(trimmed)) {
			return;
		}
		setDevices([...devices, trimmed]);
		setNewUrl('');
	};

	const removeUrl = (url: string) => {
		setDevices(devices.filter((d) => d !== url));
	};

	const handleKeyPress = (event: React.KeyboardEvent) => {
		if (event.key === 'Enter') {
			void addUrl();
		}
	};

	return (
		<Box sx={{ p: 3, maxWidth: 800 }}>
			<Stack spacing={3}>
				<Alert severity="info">
					Add Matter-like device URLs. Each URL should point to a device that exposes a
					/clusters endpoint. Devices are initialized when you save.
				</Alert>

				{error && (
					<Alert severity="error" onClose={() => setError(null)}>
						{error}
					</Alert>
				)}

				{success && (
					<Alert severity="success">Matter-like configuration saved successfully.</Alert>
				)}

				<Card>
					<CardContent>
						<Stack spacing={3}>
							<Typography variant="body2" color="text.secondary">
								Enter the full URL (e.g. http://192.168.1.101:8080) and add it to
								the list. Click Save to apply.
							</Typography>

							<Box display="flex" gap={2} alignItems="flex-start">
								<TextField
									label="Device URL"
									placeholder="http://192.168.1.101:8080"
									value={newUrl}
									onChange={(e) => setNewUrl(e.target.value)}
									onKeyPress={handleKeyPress}
									size="small"
									sx={{ flexGrow: 1 }}
									disabled={loading}
								/>
								<Button
									variant="contained"
									onClick={addUrl}
									startIcon={<AddIcon />}
									disabled={loading || !newUrl.trim()}
								>
									Add
								</Button>
							</Box>

							{devices.length === 0 ? (
								<Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
									No URLs configured. Add one above and click Save.
								</Typography>
							) : (
								<List sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
									{devices.map((url, index) => (
										<React.Fragment key={url}>
											{index > 0 && <Divider />}
											<ListItem>
												<ListItemText primary={url} />
												<ListItemSecondaryAction>
													<IconButton
														edge="end"
														aria-label="delete"
														onClick={() => removeUrl(url)}
														disabled={loading}
													>
														<DeleteIcon />
													</IconButton>
												</ListItemSecondaryAction>
											</ListItem>
										</React.Fragment>
									))}
								</List>
							)}

							<Button
								variant="contained"
								onClick={() => void saveConfig()}
								disabled={loading}
							>
								{loading ? 'Saving…' : 'Save'}
							</Button>
						</Stack>
					</CardContent>
				</Card>
			</Stack>
		</Box>
	);
};
