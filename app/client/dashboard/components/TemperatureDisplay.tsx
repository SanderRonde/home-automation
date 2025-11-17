import {
	DeviceThermostat as DeviceThermostatIcon,
	ExpandMore as ExpandMoreIcon,
	ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { Box, Card, CardContent, Typography, CircularProgress, IconButton } from '@mui/material';
import React, { useState, useEffect } from 'react';
import { apiGet } from '../../lib/fetch';

interface TemperatureDisplayProps {
	onExpandedChange?: (expanded: boolean) => void;
}

export const TemperatureDisplay = (props: TemperatureDisplayProps): JSX.Element => {
	const [temperature, setTemperature] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [expanded, setExpanded] = useState(false);

	const loadTemperature = async () => {
		try {
			const response = await apiGet('temperature', '/inside-temperature', {});
			if (response.ok) {
				const data = await response.json();
				setTemperature(data.temperature);
			}
		} catch (error) {
			console.error('Failed to load temperature:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadTemperature();
		// Update temperature every 60 seconds
		const interval = setInterval(() => {
			void loadTemperature();
		}, 60000);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		props.onExpandedChange?.(expanded);
	}, [expanded, props]);

	const handleToggle = () => {
		setExpanded((prev) => !prev);
	};

	return (
		<Box
			sx={{
				position: 'absolute',
				bottom: { xs: 12, sm: 16 },
				left: 0,
				pointerEvents: 'none',
				zIndex: 2,
				px: { xs: 2, sm: 3 },
			}}
		>
			<Card
				sx={{
					pointerEvents: 'auto',
					borderRadius: 4,
					minWidth: 120,
					boxShadow: 3,
					transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
					transform: expanded ? 'scale(1.05)' : 'scale(1)',
				}}
			>
				<CardContent
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: 1,
						py: { xs: 1, sm: 1.5 },
						px: { xs: 1.5, sm: 2 },
						'&:last-child': {
							pb: { xs: 1, sm: 1.5 },
						},
					}}
				>
					<DeviceThermostatIcon
						color="primary"
						sx={{
							fontSize: { xs: 24, sm: 28 },
							transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
							transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
						}}
					/>
					{loading ? (
						<CircularProgress size={20} />
					) : (
						<Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
							{temperature !== null ? `${Math.round(temperature * 10) / 10}°` : '--°'}
						</Typography>
					)}
					<IconButton
						size="small"
						onClick={handleToggle}
						sx={{
							transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
							transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
						}}
					>
						{expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
					</IconButton>
				</CardContent>
			</Card>
		</Box>
	);
};
