import {
	Box,
	Card,
	CardContent,
	Typography,
	Button,
	Alert,
	TextField,
	InputAdornment,
	IconButton,
} from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { apiGet, apiPost, apiDelete } from '../../lib/fetch';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import React, { useState, useEffect } from 'react';
import SaveIcon from '@mui/icons-material/Save';
import { Chat } from './Chat';

export const AIConfig = (): JSX.Element => {
	const [apiKey, setApiKey] = useState<string>('');
	const [hasKey, setHasKey] = useState<boolean>(false);
	const [showKey, setShowKey] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Load API key status on component mount
	useEffect(() => {
		void loadKeyStatus();
	}, []);

	const loadKeyStatus = async () => {
		try {
			const response = await apiGet('ai', '/api-key', {});
			if (response.ok) {
				const data = await response.json();
				setHasKey(data.hasKey);
			}
		} catch (err) {
			console.error('Failed to load API key status:', err);
			setError('Failed to load API key status');
		}
	};

	const saveApiKey = async () => {
		if (!apiKey.trim()) {
			setError('Please enter an API key');
			return;
		}

		setLoading(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await apiPost('ai', '/api-key/set', {}, { apiKey: apiKey.trim() });

			if (response.ok) {
				setSuccess('API key saved successfully');
				setHasKey(true);
				setApiKey('');
				setTimeout(() => setSuccess(null), 3000);
			} else {
				setError('Failed to save API key');
			}
		} catch {
			setError('Failed to save API key');
		} finally {
			setLoading(false);
		}
	};

	const deleteApiKey = async () => {
		setLoading(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await apiDelete('ai', '/api-key', {});

			if (response.ok) {
				setSuccess('API key deleted successfully');
				setHasKey(false);
				setApiKey('');
				setTimeout(() => setSuccess(null), 3000);
			} else {
				setError('Failed to delete API key');
			}
		} catch {
			setError('Failed to delete API key');
		} finally {
			setLoading(false);
		}
	};

	return (
		<Box sx={{ p: 2 }}>
			<Typography variant="h4" gutterBottom>
				AI Assistant Configuration
			</Typography>

			<Card sx={{ mb: 3 }}>
				<CardContent>
					<Typography variant="h6" gutterBottom>
						About the AI Module
					</Typography>
					<Typography variant="body2" color="text.secondary" paragraph>
						The AI module provides integration with ChatGPT for controlling your home
						automation system through natural conversation. It also includes an MCP
						(Model Context Protocol) server for external AI assistants like Claude
						Desktop.
					</Typography>
					<Typography variant="body2" color="text.secondary">
						To use the ChatGPT chat interface, you need to provide an OpenAI API key.
						Get your API key from{' '}
						<a
							href="https://platform.openai.com/api-keys"
							target="_blank"
							rel="noopener noreferrer"
						>
							platform.openai.com/api-keys
						</a>
					</Typography>
				</CardContent>
			</Card>

			{error && (
				<Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}

			{success && (
				<Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
					{success}
				</Alert>
			)}

			<Card sx={{ mb: 3 }}>
				<CardContent>
					<Typography variant="h6" gutterBottom>
						OpenAI API Key
					</Typography>

					{hasKey && (
						<Alert severity="success" sx={{ mb: 2 }}>
							API key is configured. You can now use the AI chat interface.
						</Alert>
					)}

					<TextField
						fullWidth
						label="OpenAI API Key"
						type={showKey ? 'text' : 'password'}
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						placeholder="sk-..."
						disabled={loading}
						sx={{ mb: 2 }}
						InputProps={{
							endAdornment: (
								<InputAdornment position="end">
									<IconButton
										onClick={() => setShowKey(!showKey)}
										edge="end"
										aria-label="toggle password visibility"
									>
										{showKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
									</IconButton>
								</InputAdornment>
							),
						}}
					/>

					<Box sx={{ display: 'flex', gap: 2 }}>
						<Button
							variant="contained"
							startIcon={<SaveIcon />}
							onClick={() => void saveApiKey()}
							disabled={loading || !apiKey.trim()}
						>
							{hasKey ? 'Update API Key' : 'Save API Key'}
						</Button>

						{hasKey && (
							<Button
								variant="outlined"
								color="error"
								startIcon={<DeleteIcon />}
								onClick={() => void deleteApiKey()}
								disabled={loading}
							>
								Clear API Key
							</Button>
						)}
					</Box>
				</CardContent>
			</Card>

			{/* Chat interface */}
			<Chat hasApiKey={hasKey} />
		</Box>
	);
};
