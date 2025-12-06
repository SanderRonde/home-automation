import {
	DeviceThermostat as DeviceThermostatIcon,
	ExpandMore as ExpandMoreIcon,
	LocalFireDepartment as FireIcon,
	Add as AddIcon,
	Remove as RemoveIcon,
} from '@mui/icons-material';
import {
	Box,
	Card,
	CardContent,
	Typography,
	CircularProgress,
	IconButton,
	Collapse,
	Slider,
} from '@mui/material';
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

interface ThermostatData {
	configured: boolean;
	deviceId?: string;
	currentTemperature?: number;
	targetTemperature?: number;
	isHeating?: boolean;
	mode?: string;
}

interface TemperatureDisplayProps {
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
}

export const TemperatureDisplay = (props: TemperatureDisplayProps): JSX.Element => {
	const [temperature, setTemperature] = useState<number | null>(null);
	const [thermostatData, setThermostatData] = useState<ThermostatData | null>(null);
	const [loading, setLoading] = useState(true);
	const [newTarget, setNewTarget] = useState<number | null>(null);
	const [updating, setUpdating] = useState(false);

	const loadData = useCallback(async () => {
		try {
			const [tempResponse, thermostatResponse] = await Promise.all([
				apiGet('temperature', '/inside-temperature', {}),
				apiGet('temperature', '/central-thermostat', {}),
			]);

			if (tempResponse.ok) {
				const data = await tempResponse.json();
				setTemperature(data.temperature);
			}

			if (thermostatResponse.ok) {
				const data = await thermostatResponse.json();
				setThermostatData(data);
				if (data.configured && data.targetTemperature !== undefined) {
					setNewTarget(data.targetTemperature);
				}
			}
		} catch (error) {
			console.error('Failed to load temperature data:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadData();
		// Update temperature every 60 seconds
		const interval = setInterval(() => {
			void loadData();
		}, 60000);
		return () => clearInterval(interval);
	}, [loadData]);

	const handleToggle = () => {
		props.onExpandedChange(!props.expanded);
	};

	const handleTargetChange = async (delta: number) => {
		if (newTarget === null || updating) {
			return;
		}

		const updatedTarget = Math.round((newTarget + delta) * 2) / 2; // Round to 0.5
		const clampedTarget = Math.max(5, Math.min(30, updatedTarget));
		setNewTarget(clampedTarget);

		setUpdating(true);
		try {
			const response = await apiPost(
				'temperature',
				'/central-thermostat',
				{},
				{ targetTemperature: clampedTarget }
			);
			if (response.ok) {
				const data = await response.json();
				if (data.success) {
					setThermostatData({
						...data,
						configured: true,
					});
				}
			}
		} catch (error) {
			console.error('Failed to update target temperature:', error);
		} finally {
			setUpdating(false);
		}
	};

	const handleSliderChange = (_event: Event, value: number | number[]) => {
		setNewTarget(value as number);
	};

	const handleSliderCommit = async (
		_event: React.SyntheticEvent | Event,
		value: number | number[]
	) => {
		const targetValue = value as number;
		setUpdating(true);
		try {
			const response = await apiPost(
				'temperature',
				'/central-thermostat',
				{},
				{ targetTemperature: targetValue }
			);
			if (response.ok) {
				const data = await response.json();
				setThermostatData({
					...data,
					configured: true,
				});
			}
		} catch (error) {
			console.error('Failed to update target temperature:', error);
		} finally {
			setUpdating(false);
		}
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
					minWidth: hasThermostat ? 200 : 120,
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
											{formatTemp(thermostatData.targetTemperature)}°
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
						<Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
							<Typography
								variant="caption"
								sx={{ color: 'text.secondary', mb: 1, display: 'block' }}
							>
								Set target temperature
							</Typography>
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
								<IconButton
									size="small"
									onClick={() => void handleTargetChange(-0.5)}
									disabled={updating || newTarget === null || newTarget <= 5}
								>
									<RemoveIcon />
								</IconButton>
								<Box sx={{ flexGrow: 1, px: 1 }}>
									<Slider
										value={newTarget ?? 20}
										min={5}
										max={30}
										step={0.5}
										onChange={handleSliderChange}
										onChangeCommitted={handleSliderCommit}
										disabled={updating}
										valueLabelDisplay="auto"
										valueLabelFormat={(v) => `${v}°`}
										sx={{
											'& .MuiSlider-thumb': {
												width: 20,
												height: 20,
											},
										}}
									/>
								</Box>
								<IconButton
									size="small"
									onClick={() => void handleTargetChange(0.5)}
									disabled={updating || newTarget === null || newTarget >= 30}
								>
									<AddIcon />
								</IconButton>
								<Typography
									variant="body1"
									sx={{
										fontWeight: 600,
										minWidth: 45,
										textAlign: 'right',
									}}
								>
									{newTarget !== null ? `${newTarget}°` : '--°'}
								</Typography>
							</Box>
							{updating && (
								<Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
									<CircularProgress size={16} />
								</Box>
							)}
						</Box>
					</Collapse>
				</CardContent>
			</Card>
		</Box>
	);
};
