import {
	Box,
	Card,
	CardContent,
	Typography,
	IconButton,
	Button,
	CircularProgress,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
	Alert,
	Tooltip,
	Snackbar,
	Accordion,
	AccordionSummary,
	AccordionDetails,
	Chip,
} from '@mui/material';
import {
	Add as AddIcon,
	Delete as DeleteIcon,
	ContentCopy as CopyIcon,
	History as HistoryIcon,
	ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { Webhook, WebhookTrigger } from '../../../server/modules/webhook/types';
import { apiGet, apiPost, apiDelete } from '../../lib/fetch';
import React, { useState, useEffect } from 'react';

export function Webhooks(): JSX.Element {
	const [webhooks, setWebhooks] = useState<Webhook[]>([]);
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [newWebhookName, setNewWebhookName] = useState('');
	const [newWebhookDescription, setNewWebhookDescription] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [snackbarOpen, setSnackbarOpen] = useState(false);
	const [snackbarMessage, setSnackbarMessage] = useState('');
	const [triggersDialogOpen, setTriggersDialogOpen] = useState(false);
	const [selectedWebhookName, setSelectedWebhookName] = useState<string>('');
	const [triggers, setTriggers] = useState<WebhookTrigger[]>([]);
	const [triggersLoading, setTriggersLoading] = useState(false);

	const loadWebhooks = async () => {
		try {
			const response = await apiGet('webhook', '/list', {});
			if (response.ok) {
				const data = await response.json();
				setWebhooks(data.webhooks);
			}
		} catch (error) {
			console.error('Failed to load webhooks:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadWebhooks();
	}, []);

	const handleCreateWebhook = async () => {
		if (!newWebhookName.trim()) {
			setError('Webhook name is required');
			return;
		}

		// Validate name format
		if (!/^[a-zA-Z0-9_-]+$/.test(newWebhookName)) {
			setError('Name must be alphanumeric with hyphens or underscores only');
			return;
		}

		try {
			const response = await apiPost(
				'webhook',
				'/create',
				{},
				{
					name: newWebhookName.trim(),
					description: newWebhookDescription.trim() || undefined,
				}
			);

			if (response.ok) {
				await loadWebhooks();
				setModalOpen(false);
				setNewWebhookName('');
				setNewWebhookDescription('');
				setError(null);
				setSnackbarMessage('Webhook created successfully');
				setSnackbarOpen(true);
			}
		} catch (error) {
			console.error('Failed to create webhook:', error);
			setError('Network error');
		}
	};

	const handleDeleteWebhook = async (name: string) => {
		if (!confirm(`Are you sure you want to delete webhook "${name}"?`)) {
			return;
		}

		try {
			const response = await apiDelete('webhook', '/:name/delete', { name });

			if (response.ok) {
				await loadWebhooks();
				setSnackbarMessage('Webhook deleted successfully');
				setSnackbarOpen(true);
			}
		} catch (error) {
			console.error('Failed to delete webhook:', error);
			alert('Network error');
		}
	};

	const handleCopyUrl = (name: string) => {
		const url = `${window.location.protocol}//${window.location.host}/webhook/${name}`;
		void navigator.clipboard.writeText(url);
		setSnackbarMessage('URL copied to clipboard');
		setSnackbarOpen(true);
	};

	const handleOpenModal = () => {
		setModalOpen(true);
		setError(null);
		setNewWebhookName('');
		setNewWebhookDescription('');
	};

	const handleOpenTriggersDialog = async (name: string) => {
		setSelectedWebhookName(name);
		setTriggersDialogOpen(true);
		setTriggersLoading(true);

		try {
			const response = await apiGet('webhook', '/:name/triggers', { name });
			if (response.ok) {
				const data = await response.json();
				setTriggers(data.triggers);
			}
		} catch (error) {
			console.error('Failed to load triggers:', error);
		} finally {
			setTriggersLoading(false);
		}
	};

	const handleCloseTriggersDialog = () => {
		setTriggersDialogOpen(false);
		setTriggers([]);
		setSelectedWebhookName('');
	};

	const formatTimestamp = (timestamp: number): string => {
		const date = new Date(timestamp);
		return date.toLocaleString();
	};

	if (loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: 3 }}>
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					mb: 3,
				}}
			>
				<Typography variant="h4">Webhooks</Typography>
				<Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenModal}>
					Create Webhook
				</Button>
			</Box>

			{webhooks.length === 0 ? (
				<Card>
					<CardContent>
						<Typography variant="body1" color="text.secondary" align="center">
							No webhooks configured. Create one to get started.
						</Typography>
					</CardContent>
				</Card>
			) : (
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
					{webhooks.map((webhook) => (
						<Card key={webhook.name}>
							<CardContent>
								<Box
									sx={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'flex-start',
									}}
								>
									<Box sx={{ flex: 1 }}>
										<Typography variant="h6" gutterBottom>
											{webhook.name}
										</Typography>
										{webhook.description && (
											<Typography
												variant="body2"
												color="text.secondary"
												sx={{ mb: 2 }}
											>
												{webhook.description}
											</Typography>
										)}
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 1,
												p: 1,
												bgcolor: 'action.hover',
												borderRadius: 1,
												fontFamily: 'monospace',
											}}
										>
											<Typography
												variant="body2"
												sx={{ flex: 1, wordBreak: 'break-all' }}
											>
												POST {window.location.host}/webhook/{webhook.name}
											</Typography>
											<Tooltip title="Copy URL">
												<IconButton
													size="small"
													onClick={() => handleCopyUrl(webhook.name)}
												>
													<CopyIcon fontSize="small" />
												</IconButton>
											</Tooltip>
										</Box>
										<Box
											sx={{
												display: 'flex',
												gap: 2,
												mt: 1,
												alignItems: 'center',
											}}
										>
											<Typography variant="caption" color="text.secondary">
												Created:{' '}
												{new Date(webhook.createdAt).toLocaleDateString()}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												Last triggered:{' '}
												{webhook.lastTriggeredAt
													? formatTimestamp(webhook.lastTriggeredAt)
													: 'Never'}
											</Typography>
										</Box>
										<Button
											size="small"
											startIcon={<HistoryIcon />}
											onClick={() => handleOpenTriggersDialog(webhook.name)}
											sx={{ mt: 1 }}
										>
											View History
										</Button>
									</Box>
									<IconButton
										color="error"
										onClick={() => handleDeleteWebhook(webhook.name)}
									>
										<DeleteIcon />
									</IconButton>
								</Box>
							</CardContent>
						</Card>
					))}
				</Box>
			)}

			{/* Create Webhook Dialog */}
			<Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
				<DialogTitle>Create Webhook</DialogTitle>
				<DialogContent>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
						{error && <Alert severity="error">{error}</Alert>}

						<TextField
							label="Webhook Name"
							value={newWebhookName}
							onChange={(e) => setNewWebhookName(e.target.value)}
							placeholder="my-webhook"
							helperText="Alphanumeric characters, hyphens, and underscores only"
							fullWidth
							required
							autoFocus
						/>

						<TextField
							label="Description (Optional)"
							value={newWebhookDescription}
							onChange={(e) => setNewWebhookDescription(e.target.value)}
							placeholder="What does this webhook do?"
							fullWidth
							multiline
							rows={2}
						/>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setModalOpen(false)}>Cancel</Button>
					<Button variant="contained" onClick={handleCreateWebhook}>
						Create
					</Button>
				</DialogActions>
			</Dialog>

			{/* Snackbar for notifications */}
			<Snackbar
				open={snackbarOpen}
				autoHideDuration={3000}
				onClose={() => setSnackbarOpen(false)}
				message={snackbarMessage}
			/>

			{/* Triggers History Dialog */}
			<Dialog
				open={triggersDialogOpen}
				onClose={handleCloseTriggersDialog}
				maxWidth="md"
				fullWidth
			>
				<DialogTitle>Webhook Trigger History: {selectedWebhookName}</DialogTitle>
				<DialogContent>
					{triggersLoading ? (
						<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
							<CircularProgress />
						</Box>
					) : triggers.length === 0 ? (
						<Typography variant="body1" color="text.secondary" sx={{ py: 2 }}>
							No triggers recorded yet.
						</Typography>
					) : (
						<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
							{triggers.map((trigger) => (
								<Accordion key={trigger.id}>
									<AccordionSummary expandIcon={<ExpandMoreIcon />}>
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 2,
												width: '100%',
											}}
										>
											<Chip
												label={trigger.method}
												size="small"
												color="primary"
											/>
											<Typography variant="body2" sx={{ flex: 1 }}>
												{formatTimestamp(trigger.timestamp)}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												{trigger.ip}
											</Typography>
										</Box>
									</AccordionSummary>
									<AccordionDetails>
										<Box
											sx={{
												display: 'flex',
												flexDirection: 'column',
												gap: 2,
											}}
										>
											{/* Request Body */}
											<Box>
												<Typography
													variant="subtitle2"
													gutterBottom
													sx={{ fontWeight: 'bold' }}
												>
													Request Body
												</Typography>
												<Box
													sx={{
														bgcolor: 'action.hover',
														p: 1.5,
														borderRadius: 1,
														fontFamily: 'monospace',
														fontSize: '0.875rem',
														overflow: 'auto',
														maxHeight: 200,
													}}
												>
													<pre style={{ margin: 0 }}>
														{JSON.stringify(trigger.body, null, 2)}
													</pre>
												</Box>
											</Box>

											{/* Request Headers */}
											<Box>
												<Typography
													variant="subtitle2"
													gutterBottom
													sx={{ fontWeight: 'bold' }}
												>
													Request Headers
												</Typography>
												<Box
													sx={{
														bgcolor: 'action.hover',
														p: 1.5,
														borderRadius: 1,
														fontFamily: 'monospace',
														fontSize: '0.875rem',
														overflow: 'auto',
														maxHeight: 200,
													}}
												>
													<pre style={{ margin: 0 }}>
														{JSON.stringify(trigger.headers, null, 2)}
													</pre>
												</Box>
											</Box>
										</Box>
									</AccordionDetails>
								</Accordion>
							))}
						</Box>
					)}
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCloseTriggersDialog}>Close</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}
