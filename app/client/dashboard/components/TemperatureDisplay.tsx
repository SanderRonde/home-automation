import {
	DeviceThermostat as DeviceThermostatIcon,
	ExpandMore as ExpandMoreIcon,
	LocalFireDepartment as FireIcon,
} from '@mui/icons-material';
import {
	Box,
	Card,
	CardContent,
	Typography,
	CircularProgress,
	IconButton,
	Collapse,
} from '@mui/material';
import type { TemperatureWebsocketServerMessage } from '../../../server/modules/temperature/routing';
import React, { useState, useCallback } from 'react';
import useWebsocket from '../../shared/resilient-socket';

interface ThermostatData {
	configured: boolean;
	deviceId?: string;
	currentTemperature?: number;
	targetTemperature?: number;
	hardwareTargetTemperature?: number;
	isHeating?: boolean;
	mode?: string;
}

interface TemperatureDisplayProps {
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
	kiosk?: boolean;
}

export const TemperatureDisplay = (props: TemperatureDisplayProps): JSX.Element => {
	const [temperature, setTemperature] = useState<number | null>(null);
	const [thermostatData, setThermostatData] = useState<ThermostatData | null>(null);
	const [loading, setLoading] = useState(true);
	const [averageTarget, setAverageTarget] = useState<number | null>(null);

	// Helper function to update all state from WebSocket message
	const updateFromWebSocketMessage = useCallback((message: TemperatureWebsocketServerMessage) => {
		// Update inside temperature
		setTemperature(message.insideTemperature);

		// Update thermostat data
		if (message.centralThermostat) {
			setThermostatData({
				configured: true,
				...message.centralThermostat,
			});
		} else {
			setThermostatData({ configured: false });
		}

		// Update average target from rooms
		if (message.rooms && message.rooms.length > 0) {
			const avg =
				message.rooms.reduce((acc: number, r) => acc + r.targetTemperature, 0) /
				message.rooms.length;
			setAverageTarget(avg);
		} else if (message.centralThermostat) {
			// Fallback to global target if no rooms
			setAverageTarget(message.globalTarget);
		}

		// Mark as loaded once we receive first message
		setLoading(false);
	}, []);

	// Subscribe to temperature WebSocket updates
	useWebsocket<TemperatureWebsocketServerMessage, never>('/temperature/ws', {
		onMessage: (message) => {
			if (message.type === 'update') {
				updateFromWebSocketMessage(message);
			}
		},
	});

	const handleToggle = () => {
		props.onExpandedChange(!props.expanded);
	};

	const formatTemp = (temp: number | null | undefined): string => {
		if (temp === null || temp === undefined) {
			return '--';
		}
		return `${Math.round(temp * 10) / 10}`;
	};

	const hasThermostat = thermostatData?.configured && !!thermostatData.deviceId;

	return (
		<Box>
			<Card
				sx={{
					pointerEvents: 'auto',
					borderRadius: 4,
					boxShadow: 3,
					transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
					transform: props.expanded ? 'scale(1.02)' : 'scale(1)',
				}}
			>
				<CardContent
					sx={{
						display: 'flex',
						flexDirection: 'column',
						py: { xs: 1, sm: 1.5 },
						px: { xs: 1.5, sm: 2 },
						'&:last-child': {
							pb: { xs: 1, sm: 1.5 },
						},
					}}
				>
					{/* Main row */}
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						<DeviceThermostatIcon
							color="primary"
							sx={{
								fontSize: { xs: 24, sm: 28 },
							}}
						/>
						{loading ? (
							<CircularProgress size={20} />
						) : (
							<Box
								sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}
							>
								{/* Average temperature */}
								<Typography
									variant="h6"
									sx={{ fontWeight: 600 }}
									title="Average temperature"
								>
									{formatTemp(temperature)}°
								</Typography>

								{/* Thermostat info */}
								{hasThermostat && (
									<>
										<Typography
											variant="body2"
											sx={{ color: 'text.secondary', mx: 0.5 }}
										>
											|
										</Typography>
										<Typography
											variant="body2"
											sx={{ color: 'text.secondary' }}
											title="Thermostat current"
										>
											{formatTemp(thermostatData.currentTemperature)}°
										</Typography>
										<Typography
											variant="body2"
											sx={{ color: 'text.secondary' }}
										>
											→
										</Typography>
										<Typography
											variant="body2"
											sx={{
												fontWeight: 600,
												color: 'primary.main',
											}}
											title="Target temperature"
										>
											{formatTemp(
												averageTarget ?? thermostatData.targetTemperature
											)}
											°
										</Typography>
										{thermostatData.isHeating && (
											<FireIcon
												sx={{
													fontSize: 18,
													color: '#f97316',
													animation: 'pulse 1.5s infinite',
													'@keyframes pulse': {
														'0%, 100%': { opacity: 1 },
														'50%': { opacity: 0.5 },
													},
												}}
												titleAccess="Heating"
											/>
										)}
									</>
								)}
							</Box>
						)}
						<IconButton
							size="small"
							onClick={handleToggle}
							sx={{
								transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
								transform: props.expanded ? 'rotate(180deg)' : 'rotate(0deg)',
							}}
						>
							<ExpandMoreIcon />
						</IconButton>
					</Box>

					{/* Expanded controls */}
					<Collapse in={props.expanded && hasThermostat}>
						{props.expanded && (
							<Box
								sx={{
									mt: 2,
									pt: 2,
									borderTop: '1px solid',
									borderColor: 'divider',
								}}
							>
								<Typography
									variant="body2"
									color="text.secondary"
									sx={{ textAlign: 'center', fontStyle: 'italic' }}
								>
									Tap the house bubble on the map to control temperature
								</Typography>
							</Box>
						)}
					</Collapse>
				</CardContent>
			</Card>
		</Box>
	);
};
