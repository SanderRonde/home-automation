import {
	DeviceThermostat as DeviceThermostatIcon,
	ExpandMore as ExpandMoreIcon,
	ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { Card, CardContent, Typography, CircularProgress, IconButton } from '@mui/material';
import React, { useState, useEffect } from 'react';
import { apiGet } from '../../lib/fetch';

interface TemperatureDisplayProps {
	expanded: boolean;
	onToggle: () => void;
}

export const TemperatureDisplay = (props: TemperatureDisplayProps): JSX.Element => {
	const [temperature, setTemperature] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);

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

	return (
		<Card
			sx={{
				borderRadius: 4,
				minWidth: 120,
				boxShadow: 3,
				transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
				transform: props.expanded ? 'scale(1.05)' : 'scale(1)',
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
						transform: props.expanded ? 'rotate(180deg)' : 'rotate(0deg)',
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
					onClick={props.onToggle}
					sx={{
						transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
						transform: props.expanded ? 'rotate(180deg)' : 'rotate(0deg)',
					}}
				>
					{props.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
				</IconButton>
			</CardContent>
		</Card>
	);
};
