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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ReplayIcon from '@mui/icons-material/Replay';
import CancelIcon from '@mui/icons-material/Cancel';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

interface SystemConfig {
	commands: {
		restartServer: string | null;
		stopServer: string | null;
		rebootSystem: string | null;
		killChromium: string | null;
	};
}

type CommandType = 'restart' | 'stop' | 'reboot' | 'killChromium';

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

	useEffect(() => {
		void loadConfig();
	}, []);

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
			reboot: {
				title: 'Reboot System',
				message:
					'Are you sure you want to reboot the entire system? All services will be temporarily unavailable.',
			},
			killChromium: {
				title: 'Kill Chromium',
				message:
					'Are you sure you want to kill all Chromium processes? This will close the kiosk display.',
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

		const endpoints: Record<CommandType, '/restart' | '/stop' | '/reboot' | '/kill-chromium'> =
			{
				restart: '/restart',
				stop: '/stop',
				reboot: '/reboot',
				killChromium: '/kill-chromium',
			};

		const successMessages: Record<CommandType, string> = {
			restart: 'Server restart initiated. Please wait...',
			stop: 'Server stop initiated.',
			reboot: 'System reboot initiated. Please wait...',
			killChromium: 'Chromium processes killed successfully.',
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
			// For restart/stop/reboot, we might lose connection which is expected
			if (type === 'restart' || type === 'stop' || type === 'reboot') {
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
								label="Reboot System"
								command={config?.commands.rebootSystem ?? null}
							/>
							<CommandStatus
								label="Kill Chromium"
								command={config?.commands.killChromium ?? null}
							/>
						</Paper>
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
						</Stack>
					</CardContent>
				</Card>

				{/* System Controls Card */}
				<Card>
					<CardContent>
						<Typography variant="h6" gutterBottom>
							System Controls
						</Typography>
						<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
							<Button
								variant="contained"
								color="error"
								startIcon={
									executing === 'reboot' ? (
										<CircularProgress size={20} color="inherit" />
									) : (
										<ReplayIcon />
									)
								}
								onClick={() => openConfirmDialog('reboot')}
								disabled={!config?.commands.rebootSystem || executing !== null}
							>
								Reboot System
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
							Manage the kiosk display and Chromium browser processes.
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
								disabled={!config?.commands.killChromium || executing !== null}
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
											rebootSystem: 'sudo reboot',
											killChromium: 'killall chromium || true',
										},
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
