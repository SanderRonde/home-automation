import {
	Box,
	Card,
	CardContent,
	Typography,
	Button,
	Alert,
	Stack,
	CircularProgress,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogContentText,
	DialogActions,
	Chip,
	Paper,
} from '@mui/material';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import React, { useState, useEffect, useRef } from 'react';
import CancelIcon from '@mui/icons-material/Cancel';
import { apiGet, apiPost } from '../../lib/fetch';
import { parseAnsiLine } from '../lib/ansi';

interface SystemConfig {
	commands: {
		restartServer: string | null;
		stopServer: string | null;
		killChromium: string | null;
	};
	logFilePath: string | null;
}

type CommandType = 'restart' | 'stop' | 'killChromium' | 'restartMatter';

export const SystemAdmin = (): JSX.Element => {
	const [config, setConfig] = useState<SystemConfig | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [executing, setExecuting] = useState<CommandType | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [confirmDialog, setConfirmDialog] = useState<{
		open: boolean;
		type: CommandType | null;
		title: string;
		message: string;
	}>({
		open: false,
		type: null,
		title: '',
		message: '',
	});
	const [logs, setLogs] = useState<string[]>([]);
	const [logsConnected, setLogsConnected] = useState<boolean>(false);
	const [logsError, setLogsError] = useState<string | null>(null);
	const logsScrollRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		void loadConfig();
	}, []);

	// WebSocket connection for streaming logs
	useEffect(() => {
		if (!config?.logFilePath) {
			setLogs([]);
			setLogsError(null);
			setLogsConnected(false);
			return;
		}

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const ws = new WebSocket(`${protocol}//${window.location.host}/system/ws`);

		ws.onopen = () => {
			setLogsConnected(true);
			setLogsError(null);
		};

		ws.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data) as {
					type?: string;
					lines?: string[];
				};
				if (
					typeof message === 'object' &&
					message !== null &&
					message.type === 'log_lines' &&
					Array.isArray(message.lines)
				) {
					setLogs((prev) => {
						// If this is the first batch (initial tail), replace; otherwise append
						const isInitial = prev.length === 0;
						return isInitial ? message.lines! : [...prev, ...message.lines!];
					});
				}
			} catch (err) {
				console.error('Failed to parse WebSocket log message:', err);
			}
		};

		ws.onerror = () => {
			setLogsError('WebSocket connection error');
			setLogsConnected(false);
		};

		ws.onclose = () => {
			setLogsConnected(false);
			// Attempt to reconnect after a delay
			setTimeout(() => {
				if (config?.logFilePath) {
					// Reconnect by recreating the effect
					setLogsError('Reconnecting...');
				}
			}, 3000);
		};

		return () => {
			ws.close();
		};
	}, [config?.logFilePath]);

	useEffect(() => {
		const el = logsScrollRef.current;
		if (el) {
			el.scrollTop = el.scrollHeight;
		}
	}, [logs]);

	const loadConfig = async () => {
		setLoading(true);
		try {
			const response = await apiGet('system', '/config', {});
			if (response.ok) {
				const data = await response.json();
				setConfig(data);
			} else {
				setError('Failed to load system configuration');
			}
		} catch (err) {
			console.error('Failed to load system config:', err);
			setError('Failed to load system configuration');
		} finally {
			setLoading(false);
		}
	};

	const openConfirmDialog = (type: CommandType) => {
		const dialogConfig: Record<CommandType, { title: string; message: string }> = {
			restart: {
				title: 'Restart Server',
				message:
					'Are you sure you want to restart the server? You will be temporarily disconnected.',
			},
			stop: {
				title: 'Stop Server',
				message:
					'Are you sure you want to stop the server? You will lose access to the dashboard until the server is manually started again.',
			},
			killChromium: {
				title: 'Kill Chromium',
				message:
					'Are you sure you want to kill all Chromium processes? This will close the kiosk display. The kiosk script will automatically restart Chromium.',
			},
			restartMatter: {
				title: 'Restart Matter Server',
				message:
					'Are you sure you want to restart the Matter server? This will restart the Matter server and all commissioned devices.',
			},
		};

		setConfirmDialog({
			open: true,
			type,
			...dialogConfig[type],
		});
	};

	const closeConfirmDialog = () => {
		setConfirmDialog({ open: false, type: null, title: '', message: '' });
	};

	const executeCommand = async (type: CommandType) => {
		closeConfirmDialog();
		setExecuting(type);
		setError(null);
		setSuccess(null);

		const endpoints: Record<
			CommandType,
			'/restart' | '/stop' | '/kill-chromium' | '/restart-matter'
		> = {
			restart: '/restart',
			stop: '/stop',
			killChromium: '/kill-chromium',
			restartMatter: '/restart-matter',
		};

		const successMessages: Record<CommandType, string> = {
			restart: 'Server restart initiated. Please wait...',
			stop: 'Server stop initiated.',
			killChromium: 'Chromium processes killed successfully.',
			restartMatter: 'Matter server restarted successfully.',
		};

		try {
			const response = await apiPost('system', endpoints[type], {});

			if (response.ok) {
				const data = await response.json();
				setSuccess(data.message || successMessages[type]);
				setTimeout(() => setSuccess(null), 5000);
			} else {
				const errorData = await response.json();
				setError(errorData.message || `Failed to execute ${type} command`);
			}
		} catch (err) {
			// For restart/stop, we might lose connection which is expected
			if (type === 'restart' || type === 'stop') {
				setSuccess(successMessages[type]);
				setTimeout(() => setSuccess(null), 5000);
			} else {
				console.error(`Failed to execute ${type}:`, err);
				setError(`Failed to execute ${type} command`);
			}
		} finally {
			setExecuting(null);
		}
	};

	const handleConfirm = () => {
		if (confirmDialog.type) {
			void executeCommand(confirmDialog.type);
		}
	};

	const CommandStatus = ({ label, command }: { label: string; command: string | null }) => (
		<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
			{command ? (
				<CheckCircleIcon color="success" fontSize="small" />
			) : (
				<CancelIcon color="disabled" fontSize="small" />
			)}
			<Typography variant="body2" color={command ? 'text.primary' : 'text.secondary'}>
				{label}:
			</Typography>
			{command ? (
				<Chip
					label={command}
					size="small"
					variant="outlined"
					sx={{
						fontFamily: 'monospace',
						fontSize: '0.75rem',
						maxWidth: '400px',
						'& .MuiChip-label': {
							overflow: 'hidden',
							textOverflow: 'ellipsis',
						},
					}}
				/>
			) : (
				<Typography variant="body2" color="text.secondary" fontStyle="italic">
					Not configured
				</Typography>
			)}
		</Box>
	);

	if (loading) {
		return (
			<Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: 3, maxWidth: 900 }}>
			<Stack spacing={3}>
				<Typography variant="h4">System Administration</Typography>

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

				{/* Configuration Status Card */}
				<Card>
					<CardContent>
						<Typography variant="h6" gutterBottom>
							Command Configuration
						</Typography>
						<Alert severity="info" sx={{ mb: 2 }}>
							Commands can only be configured by editing the{' '}
							<code>database/system.json</code> file directly on the server for
							security reasons.
						</Alert>
						<Paper variant="outlined" sx={{ p: 2 }}>
							<CommandStatus
								label="Restart Server"
								command={config?.commands.restartServer ?? null}
							/>
							<CommandStatus
								label="Stop Server"
								command={config?.commands.stopServer ?? null}
							/>
							<CommandStatus
								label="Kill Chromium"
								command={config?.commands.killChromium ?? null}
							/>
						</Paper>
					</CardContent>
				</Card>

				{/* Server Logs Card */}
				<Card>
					<CardContent>
						<Typography variant="h6" gutterBottom>
							Server Logs
						</Typography>
						{config?.logFilePath ? (
							<>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
									<DescriptionIcon fontSize="small" color="action" />
									<Typography
										variant="body2"
										color="text.secondary"
										fontFamily="monospace"
										component="span"
									>
										{config.logFilePath}
									</Typography>
									<Chip
										label={logsConnected ? 'Streaming' : 'Disconnected'}
										size="small"
										color={logsConnected ? 'success' : 'default'}
										variant="outlined"
									/>
								</Box>
								{logsError && (
									<Alert
										severity="error"
										sx={{ mb: 2 }}
										onClose={() => setLogsError(null)}
									>
										{logsError}
									</Alert>
								)}
								<Paper
									ref={logsScrollRef}
									variant="outlined"
									sx={{
										p: 2,
										backgroundColor: 'grey.900',
										fontFamily: 'monospace',
										fontSize: '0.8rem',
										maxHeight: 400,
										overflow: 'auto',
									}}
								>
									<pre
										style={{
											margin: 0,
											whiteSpace: 'pre-wrap',
											wordBreak: 'break-all',
										}}
									>
										{logs.length > 0
											? logs.map((line, lineIdx) => (
													<div key={lineIdx}>
														{parseAnsiLine(line).map((seg, segIdx) => (
															<span
																key={segIdx}
																style={{
																	color: seg.color,
																	fontWeight: seg.fontWeight,
																}}
															>
																{seg.text}
															</span>
														))}
													</div>
												))
											: logsConnected
												? 'Waiting for logs...'
												: 'No log lines'}
									</pre>
								</Paper>
							</>
						) : (
							<Typography variant="body2" color="text.secondary">
								To view server logs here, set <code>logFilePath</code> in{' '}
								<code>database/system.json</code> on the server (see Configuration
								Help below).
							</Typography>
						)}
					</CardContent>
				</Card>

				{/* Server Controls Card */}
				<Card>
					<CardContent>
						<Typography variant="h6" gutterBottom>
							Server Controls
						</Typography>
						<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
							<Button
								variant="contained"
								color="warning"
								startIcon={
									executing === 'restart' ? (
										<CircularProgress size={20} color="inherit" />
									) : (
										<RestartAltIcon />
									)
								}
								onClick={() => openConfirmDialog('restart')}
								disabled={!config?.commands.restartServer || executing !== null}
							>
								Restart Server
							</Button>
							<Button
								variant="contained"
								color="error"
								startIcon={
									executing === 'stop' ? (
										<CircularProgress size={20} color="inherit" />
									) : (
										<PowerSettingsNewIcon />
									)
								}
								onClick={() => openConfirmDialog('stop')}
								disabled={!config?.commands.stopServer || executing !== null}
							>
								Stop Server
							</Button>
							<Button
								variant="contained"
								color="info"
								startIcon={
									executing === 'restartMatter' ? (
										<CircularProgress size={20} color="inherit" />
									) : (
										<RestartAltIcon />
									)
								}
								onClick={() => openConfirmDialog('restartMatter')}
								disabled={executing !== null}
							>
								Restart Matter Server
							</Button>
						</Stack>
					</CardContent>
				</Card>

				{/* Kiosk Controls Card */}
				<Card>
					<CardContent>
						<Typography variant="h6" gutterBottom>
							Kiosk / Display Controls
						</Typography>
						<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
							Manage the kiosk display and Chromium browser processes. Kill Chromium
							terminates Chromium: if a command is configured in{' '}
							<code>database/system.json</code> (e.g. sudo script), it runs that;
							otherwise it kills only the current user&apos;s Chromium.
						</Typography>
						<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
							<Button
								variant="outlined"
								color="secondary"
								startIcon={
									executing === 'killChromium' ? (
										<CircularProgress size={20} color="inherit" />
									) : (
										<DesktopWindowsIcon />
									)
								}
								onClick={() => openConfirmDialog('killChromium')}
								disabled={executing !== null}
							>
								Kill Chromium
							</Button>
						</Stack>
					</CardContent>
				</Card>

				{/* Help Card */}
				<Card>
					<CardContent>
						<Typography variant="h6" gutterBottom>
							Configuration Help
						</Typography>
						<Typography variant="body2" paragraph>
							To configure system commands, edit the <code>database/system.json</code>{' '}
							file on the server. Example configuration:
						</Typography>
						<Paper
							variant="outlined"
							sx={{
								p: 2,
								backgroundColor: 'grey.900',
								fontFamily: 'monospace',
								fontSize: '0.85rem',
								overflow: 'auto',
							}}
						>
							<pre style={{ margin: 0 }}>
								{JSON.stringify(
									{
										commands: {
											restartServer: 'systemctl restart home-automation',
											stopServer: 'systemctl stop home-automation',
											killChromium: 'sudo /path/to/scripts/kill-chromium.sh',
										},
										logFilePath: '/var/log/home-automation/server.log',
									},
									null,
									2
								)}
							</pre>
						</Paper>
					</CardContent>
				</Card>
			</Stack>

			{/* Confirmation Dialog */}
			<Dialog
				open={confirmDialog.open}
				onClose={closeConfirmDialog}
				aria-labelledby="confirm-dialog-title"
				aria-describedby="confirm-dialog-description"
			>
				<DialogTitle id="confirm-dialog-title">{confirmDialog.title}</DialogTitle>
				<DialogContent>
					<DialogContentText id="confirm-dialog-description">
						{confirmDialog.message}
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={closeConfirmDialog}>Cancel</Button>
					<Button
						onClick={handleConfirm}
						variant="contained"
						color={
							confirmDialog.type === 'killChromium'
								? 'secondary'
								: confirmDialog.type === 'restart'
									? 'warning'
									: 'error'
						}
						autoFocus
					>
						Confirm
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};
