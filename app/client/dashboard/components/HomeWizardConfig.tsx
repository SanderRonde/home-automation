import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	CircularProgress,
	Grid,
	Link,
	List,
	ListItem,
	ListItemText,
	Stack,
	TextField,
	Typography,
} from '@mui/material';
import React from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

interface PollerState {
	nextRunAt: number | null;
	intervalMs: number;
	failureCount: number;
	lastError: string | null;
	active: boolean;
}

interface StatusResponse {
	configured: boolean;
	ip: string;
	hasToken: boolean;
	lastMeasurement: {
		timestamp: number | null;
		powerW: number | null;
		energyImportKwh: number | null;
		source: 'homewizard' | 'aggregated';
	} | null;
	instructions: string[];
	docsUrl: string;
	poller: PollerState;
}

export const HomeWizardConfig = (): JSX.Element => {
	const [status, setStatus] = React.useState<StatusResponse | null>(null);
	const [ip, setIp] = React.useState('');
	const [token, setToken] = React.useState('');
	const [loading, setLoading] = React.useState(true);
	const [saving, setSaving] = React.useState(false);
	const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
	const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

	const loadStatus = React.useCallback(async () => {
		setLoading(true);
		try {
			const response = await apiGet('homewizard', '/status', {});
			if (response.ok) {
				const data = (await response.json()) as StatusResponse;
				setStatus(data);
				setIp(data.ip ?? '');
				setToken('');
			} else {
				setErrorMessage('Failed to load HomeWizard status');
			}
		} catch (error) {
			console.error(error);
			setErrorMessage('Failed to load HomeWizard status');
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		void loadStatus();
	}, [loadStatus]);

	const handleSave = async () => {
		if (!ip || !token) {
			setErrorMessage('Please provide both an IP address and API token');
			return;
		}
		setSaving(true);
		setErrorMessage(null);
		setSuccessMessage(null);
		try {
			const response = await apiPost(
				'homewizard',
				'/config',
				{},
				{
					ip,
					apiToken: token,
				}
			);
			if (response.ok) {
				setSuccessMessage('Configuration updated. Polling will resume automatically.');
				setToken('');
				await loadStatus();
			} else {
				const body = (await response.json()) as { message?: string };
				setErrorMessage(body.message ?? 'Failed to update HomeWizard configuration');
			}
		} catch (error) {
			console.error(error);
			setErrorMessage('Failed to update HomeWizard configuration');
		} finally {
			setSaving(false);
		}
	};

	const lastUpdated =
		status?.lastMeasurement?.timestamp != null
			? new Date(status.lastMeasurement.timestamp).toLocaleString()
			: 'Never';

	const pollerDescription = React.useMemo(() => {
		if (!status) {
			return '---';
		}
		const { poller } = status;
		if (!poller.active) {
			return 'Paused while offline';
		}
		const next =
			poller.nextRunAt != null
				? `${Math.max(0, poller.nextRunAt - Date.now()) / 1000}s`
				: `${poller.intervalMs / 1000}s`;
		return `Next poll in ${next}. Failures: ${poller.failureCount}${
			poller.lastError ? ` (${poller.lastError})` : ''
		}`;
	}, [status]);

	if (loading) {
		return (
			<Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
				<CircularProgress />
			</Box>
		);
	}

	if (!status) {
		return (
			<Box sx={{ p: 4 }}>
				<Alert severity="error">Failed to load HomeWizard status.</Alert>
			</Box>
		);
	}

	return (
		<Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
			<Stack spacing={3}>
				<Typography variant="h4">HomeWizard Energy</Typography>
				{!status.configured && (
					<Alert severity="warning">
						HomeWizard Energy is not configured yet. Provide the local IP and API token to
						start logging measurements.
					</Alert>
				)}
				{successMessage && <Alert severity="success">{successMessage}</Alert>}
				{errorMessage && <Alert severity="error">{errorMessage}</Alert>}

				<Grid container spacing={3}>
					<Grid size={{ xs: 12, lg: 6 }}>
						<Card>
							<CardContent>
								<Stack spacing={2}>
									<Typography variant="h6">Connection</Typography>
									<TextField
										label="Device IP"
										placeholder="192.168.1.25"
										value={ip}
										onChange={(event) => setIp(event.target.value)}
										fullWidth
									/>
									<TextField
										label="API Token"
										placeholder="Copy from the HomeWizard app"
										value={token}
										onChange={(event) => setToken(event.target.value)}
										type="password"
										fullWidth
										helperText="Token stays on your server and is never shared."
									/>
									<Box>
										<Button
											variant="contained"
											onClick={handleSave}
											disabled={saving}
											sx={{ mr: 2 }}
										>
											{saving ? 'Saving…' : 'Save'}
										</Button>
										<Button variant="outlined" onClick={() => void loadStatus()} disabled={saving}>
											Refresh
										</Button>
									</Box>
								</Stack>
							</CardContent>
						</Card>
					</Grid>
					<Grid size={{ xs: 12, lg: 6 }}>
						<Card>
							<CardContent>
								<Stack spacing={1.5}>
									<Typography variant="h6">Status</Typography>
									<Typography color="text.secondary">Last updated: {lastUpdated}</Typography>
									<Typography color="text.secondary">
										Polling: {pollerDescription}
									</Typography>
									{status.lastMeasurement && status.lastMeasurement.powerW !== null && (
										<Typography variant="body1">
											Current usage:{' '}
											<strong>{status.lastMeasurement.powerW.toFixed(1)} W</strong> (
											{status.lastMeasurement.source})
										</Typography>
									)}
									{status.lastMeasurement &&
										status.lastMeasurement.energyImportKwh !== null && (
											<Typography variant="body1">
												Total imported:{' '}
												<strong>
													{status.lastMeasurement.energyImportKwh.toFixed(2)} kWh
												</strong>
											</Typography>
										)}
								</Stack>
							</CardContent>
						</Card>
					</Grid>
				</Grid>

				<Card>
					<CardContent>
						<Stack spacing={2}>
							<Typography variant="h6">How to get the API token</Typography>
							<List dense>
								{status.instructions.map((instruction) => (
									<ListItem key={instruction}>
										<ListItemText primary={instruction} />
									</ListItem>
								))}
							</List>
							<Typography variant="body2" color="text.secondary">
								Need more details?{' '}
								<Link href={status.docsUrl} target="_blank" rel="noreferrer">
									Read the official docs
								</Link>
								.
							</Typography>
						</Stack>
					</CardContent>
				</Card>
			</Stack>
		</Box>
	);
};
