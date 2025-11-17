import {
	Box,
	Card,
	CardContent,
	Typography,
	ToggleButtonGroup,
	ToggleButton,
	Grid,
	CircularProgress,
	Alert,
} from '@mui/material';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - react-chartjs-2 ESM interop handled at runtime
import { Line } from 'react-chartjs-2';
import React from 'react';
import { apiGet } from '../../lib/fetch';

type Timeframe = '1h' | '6h' | '24h' | '1week';

const TIMEFRAME_MS: Record<Timeframe, number> = {
	'1h': 60 * 60 * 1000,
	'6h': 6 * 60 * 60 * 1000,
	'24h': 24 * 60 * 60 * 1000,
	'1week': 7 * 24 * 60 * 60 * 1000,
};

interface HistoryEntry {
	timestamp: number;
	powerW: number | null;
	energyImportKwh: number | null;
}

interface HistoryResponse {
	mode: 'homewizard' | 'aggregated';
	history: HistoryEntry[];
	latest: {
		powerW: number | null;
		energyImportKwh: number | null;
		timestamp: number | null;
		source: 'homewizard' | 'aggregated';
	};
}

export const EnergyUsage = (): JSX.Element => {
	const [timeframe, setTimeframe] = React.useState<Timeframe>('24h');
	const [loading, setLoading] = React.useState(true);
	const [data, setData] = React.useState<HistoryResponse | null>(null);

	const loadData = React.useCallback(async () => {
		try {
			setLoading(true);
			const response = await apiGet(
				'homewizard',
				'/measurement/history/:timeframe',
				{
					timeframe: TIMEFRAME_MS[timeframe].toString(),
				}
			);
			if (response.ok) {
				const payload = (await response.json()) as HistoryResponse;
				setData(payload);
			}
		} catch (error) {
			console.error('Failed to load energy usage history', error);
		} finally {
			setLoading(false);
		}
	}, [timeframe]);

	React.useEffect(() => {
		void loadData();
	}, [loadData]);

	const chartData = React.useMemo(() => {
		if (!data) {
			return null;
		}
		const orderedHistory = [...data.history].sort((a, b) => a.timestamp - b.timestamp);
		const formatLabel = (timestamp: number) => {
			const date = new Date(timestamp);
			if (timeframe === '1week') {
				return date.toLocaleDateString(undefined, {
					month: 'short',
					day: 'numeric',
				});
			}
			return date.toLocaleTimeString(undefined, {
				hour: '2-digit',
				minute: '2-digit',
			});
		};
		return {
			labels: orderedHistory.map((entry) => formatLabel(entry.timestamp)),
			datasets: [
				{
					label: 'Power (W)',
					data: orderedHistory.map((entry) => entry.powerW ?? 0),
					borderColor: 'rgb(249, 115, 22)',
					backgroundColor: 'rgba(249, 115, 22, 0.1)',
					tension: 0.3,
					fill: true,
				},
			],
		};
	}, [data, timeframe]);

	const energyDelta = React.useMemo(() => {
		if (!data || data.history.length < 2) {
			return null;
		}
		const sorted = [...data.history].sort((a, b) => a.timestamp - b.timestamp);
		const first = sorted[0].energyImportKwh;
		const last = sorted[sorted.length - 1].energyImportKwh;
		if (first == null || last == null) {
			return null;
		}
		return Math.max(0, last - first);
	}, [data]);

	if (loading) {
		return (
			<Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
				<Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
					<Typography variant="h5">Energy Usage</Typography>
					<ToggleButtonGroup
						value={timeframe}
						exclusive
						size="small"
						onChange={(_, value) => value && setTimeframe(value)}
					>
						<ToggleButton value="1h">1h</ToggleButton>
						<ToggleButton value="6h">6h</ToggleButton>
						<ToggleButton value="24h">24h</ToggleButton>
						<ToggleButton value="1week">1 week</ToggleButton>
					</ToggleButtonGroup>
				</Box>
				<Typography variant="body2" color="text.secondary">
					Monitor live power draw and cumulative consumption based on HomeWizard Energy
					measurements. When HomeWizard is not configured, data is estimated by summing all
					known electrical devices.
				</Typography>

				{data && data.mode === 'aggregated' && (
					<Alert severity="info">
						HomeWizard is not configured. Showing aggregated power usage from all known devices.
					</Alert>
				)}

				<Grid container spacing={3}>
					<Grid item xs={12} md={4}>
						<Card>
							<CardContent>
								<Typography variant="subtitle2" color="text.secondary">
									Current Usage
								</Typography>
								<Typography variant="h4" sx={{ fontWeight: 700 }}>
									{data?.latest.powerW != null ? `${data.latest.powerW.toFixed(1)} W` : '-- W'}
								</Typography>
								<Typography variant="body2" color="text.secondary">
									Source: {data?.latest.source === 'homewizard' ? 'HomeWizard' : 'Summed devices'}
								</Typography>
							</CardContent>
						</Card>
					</Grid>
					<Grid item xs={12} md={4}>
						<Card>
							<CardContent>
								<Typography variant="subtitle2" color="text.secondary">
									Energy This Period
								</Typography>
								<Typography variant="h4" sx={{ fontWeight: 700 }}>
									{energyDelta != null ? `${energyDelta.toFixed(2)} kWh` : 'N/A'}
								</Typography>
								<Typography variant="body2" color="text.secondary">
									Based on total import delta
								</Typography>
							</CardContent>
						</Card>
					</Grid>
					<Grid item xs={12} md={4}>
						<Card>
							<CardContent>
								<Typography variant="subtitle2" color="text.secondary">
									Last Update
								</Typography>
								<Typography variant="h4" sx={{ fontWeight: 700 }}>
									{data?.latest.timestamp
										? new Date(data.latest.timestamp).toLocaleTimeString()
										: '—'}
								</Typography>
								<Typography variant="body2" color="text.secondary">
									Data refreshes every 15 seconds
								</Typography>
							</CardContent>
						</Card>
					</Grid>
				</Grid>

				<Card>
					<CardContent>
						{chartData ? (
							<Box sx={{ height: 320 }}>
								<Line
									data={chartData}
									options={{
										responsive: true,
										maintainAspectRatio: false,
										plugins: {
											legend: { display: false },
										},
										scales: {
											y: {
												beginAtZero: true,
												title: { display: true, text: 'Watts' },
											},
										},
									}}
								/>
							</Box>
						) : (
							<Typography color="text.secondary">No data available</Typography>
						)}
					</CardContent>
				</Card>
			</Box>
		</Box>
	);
};
