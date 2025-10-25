import {
	Box,
	Card,
	CardContent,
	Typography,
	Button,
	Alert,
	Stack,
	IconButton,
	List,
	ListItem,
	ListItemText,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Paper,
	Tooltip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { apiGet, apiPost, apiDelete } from '../../lib/fetch';
import DeleteIcon from '@mui/icons-material/Delete';
import React, { useState, useEffect } from 'react';
import AddIcon from '@mui/icons-material/Add';

export const MCPConfig = (): JSX.Element => {
	const [keys, setKeys] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [newKey, setNewKey] = useState<string | null>(null);
	const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);

	// Load keys on component mount
	useEffect(() => {
		void loadKeys();
	}, []);

	const loadKeys = async () => {
		try {
			const response = await apiGet('mcp', '/keys', {});
			if (response.ok) {
				const data = await response.json();
				setKeys(data.keys);
			}
		} catch (err) {
			console.error('Failed to load MCP keys:', err);
			setError('Failed to load MCP keys');
		}
	};

	const generateKey = async () => {
		setLoading(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await apiPost('mcp', '/keys', {});

			if (response.ok) {
				const data = await response.json();
				setNewKey(data.key);
				setShowNewKeyDialog(true);
				await loadKeys();
			}
		} catch {
			setError('Failed to generate key');
		} finally {
			setLoading(false);
		}
	};

	const deleteKey = async (key: string) => {
		setLoading(true);
		setError(null);
		setSuccess(null);

		try {
			const response = await apiDelete('mcp', '/keys/:key', { key });

			if (response.ok) {
				setSuccess('Key deleted successfully');
				await loadKeys();
				setTimeout(() => setSuccess(null), 3000);
			}
		} catch {
			setError('Failed to delete key');
		} finally {
			setLoading(false);
		}
	};

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setSuccess('Copied to clipboard!');
			setTimeout(() => setSuccess(null), 2000);
		} catch {
			setError('Failed to copy to clipboard');
		}
	};

	const handleCloseNewKeyDialog = () => {
		setShowNewKeyDialog(false);
		setNewKey(null);
	};

	const maskKey = (key: string): string => {
		if (key.length <= 8) {
			return key;
		}
		return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
	};

	return (
		<Box sx={{ p: 2 }}>
			<Typography variant="h4" gutterBottom>
				MCP Key Management
			</Typography>

			<Card sx={{ mb: 3 }}>
				<CardContent>
					<Typography variant="h6" gutterBottom>
						About MCP Keys
					</Typography>
					<Typography variant="body2" color="text.secondary" paragraph>
						Model Context Protocol (MCP) keys are used to authenticate AI assistants
						that interact with your home automation system. Each key provides full
						access to control devices and query status.
					</Typography>
					<Typography variant="body2" color="text.secondary">
						<strong>Usage:</strong> Include the key in the Authorization header:{' '}
						<code>Authorization: Bearer &lt;key&gt;</code>
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

			<Card>
				<CardContent>
					<Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
						<Typography variant="h6">Authorization Keys</Typography>
						<Button
							variant="contained"
							startIcon={<AddIcon />}
							onClick={() => void generateKey()}
							disabled={loading}
						>
							Generate New Key
						</Button>
					</Box>

					{keys.length === 0 ? (
						<Alert severity="info">
							No MCP authorization keys found. Generate a new key to get started.
						</Alert>
					) : (
						<List>
							{keys.map((key, index) => (
								<Paper key={key} variant="outlined" sx={{ mb: 1 }}>
									<ListItem
										secondaryAction={
											<Stack direction="row" spacing={1}>
												<Tooltip title="Copy full key">
													<IconButton
														edge="end"
														aria-label="copy"
														onClick={() => void copyToClipboard(key)}
													>
														<ContentCopyIcon />
													</IconButton>
												</Tooltip>
												<Tooltip title="Delete key">
													<IconButton
														edge="end"
														aria-label="delete"
														onClick={() => void deleteKey(key)}
														disabled={loading}
													>
														<DeleteIcon />
													</IconButton>
												</Tooltip>
											</Stack>
										}
									>
										<ListItemText
											primary={`Key ${index + 1}`}
											secondary={
												<Box
													component="span"
													sx={{
														fontFamily: 'monospace',
														fontSize: '0.85em',
													}}
												>
													{maskKey(key)}
												</Box>
											}
										/>
									</ListItem>
								</Paper>
							))}
						</List>
					)}
				</CardContent>
			</Card>

			{/* New Key Dialog */}
			<Dialog
				open={showNewKeyDialog}
				onClose={handleCloseNewKeyDialog}
				maxWidth="md"
				fullWidth
			>
				<DialogTitle>New MCP Authorization Key Generated</DialogTitle>
				<DialogContent>
					<Alert severity="warning" sx={{ mb: 2 }}>
						<strong>Important:</strong> Save this key now! For security reasons, you
						won't be able to see the full key again. You can only delete it and generate
						a new one.
					</Alert>

					<Typography variant="body2" gutterBottom>
						Your new authorization key:
					</Typography>

					<Paper
						sx={{
							p: 2,
							fontFamily: 'monospace',
							wordBreak: 'break-all',
							position: 'relative',
						}}
					>
						<Box display="flex" alignItems="center" justifyContent="space-between">
							<Typography component="code" sx={{ flex: 1, pr: 2 }}>
								{newKey}
							</Typography>
							<Tooltip title="Copy to clipboard">
								<IconButton onClick={() => void copyToClipboard(newKey || '')}>
									<ContentCopyIcon />
								</IconButton>
							</Tooltip>
						</Box>
					</Paper>

					<Typography variant="body2" sx={{ mt: 2 }}>
						<strong>Usage:</strong>
					</Typography>
					<Paper
						sx={{
							p: 2,
							fontFamily: 'monospace',
							fontSize: '0.85em',
							mt: 1,
						}}
					>
						Authorization: Bearer {newKey}
					</Paper>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCloseNewKeyDialog} variant="contained">
						I've Saved the Key
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};
