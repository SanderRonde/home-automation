import {
	Bolt as BoltIcon,
	ExpandLess as ExpandLessIcon,
	ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import {
	Card,
	CardContent,
	CircularProgress,
	IconButton,
	Stack,
	Typography,
	Chip,
	Box,
} from '@mui/material';
import React from 'react';
import { apiGet } from '../../lib/fetch';

interface LatestMeasurementResponse {
	timestamp: number | null;
	powerW: number | null;
	energyImportKwh: number | null;
	source: 'homewizard' | 'aggregated';
	temperatureC: number | null;
}

interface EnergyUsageDisplayProps {
	expanded: boolean;
	onToggle: () => void;
}

export const EnergyUsageDisplay = (props: EnergyUsageDisplayProps): JSX.Element => {
	const [data, setData] = React.useState<LatestMeasurementResponse | null>(null);
	const [loading, setLoading] = React.useState(true);

	const loadMeasurement = React.useCallback(async () => {
		try {
			const response = await apiGet('homewizard', '/measurement/latest', {});
			if (response.ok) {
				const payload = (await response.json()) as LatestMeasurementResponse;
				setData(payload);
			}
		} catch (error) {
			console.error('Failed to load energy measurement', error);
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		void loadMeasurement();
		const interval = setInterval(() => {
			void loadMeasurement();
		}, 15_000);
		return () => clearInterval(interval);
	}, [loadMeasurement]);

	const powerKw =
		data?.powerW != null ? `${(data.powerW / 1000).toFixed(2)} kW` : '-- kW';
	const energyKwh =
		data?.energyImportKwh != null ? `${data.energyImportKwh.toFixed(2)} kWh` : 'No reading';

	const lastUpdated =
		data?.timestamp != null ? new Date(data.timestamp).toLocaleTimeString() : '—';

	return (
		<Card
			sx={{
				borderRadius: 4,
				minWidth: 180,
				boxShadow: 3,
				background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(249, 115, 22, 0.15))',
				border: '1px solid rgba(251, 191, 36, 0.3)',
				transform: props.expanded ? 'scale(1.02)' : 'scale(1)',
				transition: 'transform 0.25s ease, box-shadow 0.25s ease',
			}}
		>
			<CardContent
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1.5,
					py: { xs: 1.5, sm: 2 },
					px: { xs: 1.8, sm: 2.4 },
					'&:last-child': { pb: { xs: 1.5, sm: 2 } },
				}}
			>
				<BoltIcon
					sx={{
						color: '#f97316',
						fontSize: { xs: 26, sm: 30 },
						transition: 'transform 0.3s ease',
						transform: props.expanded ? 'scale(1.1)' : 'scale(1)',
					}}
				/>
				<Box sx={{ flexGrow: 1 }}>
					<Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
						Energy Usage
					</Typography>
					{loading ? (
						<CircularProgress size={18} />
					) : (
						<Stack spacing={0.2}>
							<Typography variant="h5" sx={{ fontWeight: 700 }}>
								{powerKw}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Total: {energyKwh}
							</Typography>
							<Typography variant="caption" color="text.secondary">
								Updated: {lastUpdated}
							</Typography>
						</Stack>
					)}
				</Box>
				<Stack alignItems="flex-end" spacing={0.5}>
					<Chip
						label={
							data ? (data.source === 'homewizard' ? 'HomeWizard' : 'Summed') : 'Pending'
						}
						size="small"
						color={data?.source === 'homewizard' ? 'primary' : 'default'}
					/>
					<IconButton
						size="small"
						onClick={props.onToggle}
						sx={{
							ml: 'auto',
							transition: 'transform 0.3s ease',
							transform: props.expanded ? 'rotate(180deg)' : 'rotate(0deg)',
						}}
					>
						{props.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
					</IconButton>
				</Stack>
			</CardContent>
		</Card>
	);
};
