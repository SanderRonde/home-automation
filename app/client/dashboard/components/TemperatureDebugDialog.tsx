import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Typography,
	Box,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Paper,
	Chip,
	CircularProgress,
} from '@mui/material';
import { LocalFireDepartment as FireIcon } from '@mui/icons-material';
import React, { useEffect, useState } from 'react';
import { apiGet } from '../../lib/fetch';

interface RoomStatus {
	name: string;
	currentTemperature: number;
	targetTemperature: number;
	isHeating: boolean;
	overrideActive: boolean;
}

interface DebugInfo {
	history: Array<{
		timestamp: number;
		action: string;
		details: string;
	}>;
	lastDecision: string;
	roomOverrides: Record<string, number>;
	globalOverride: number | null;
	activeScheduleName: string;
}

interface CentralThermostatStatus {
	currentTemperature: number;
	targetTemperature: number;
	isHeating: boolean;
	mode: string;
	hardwareTargetTemperature?: number;
	deviceId: string;
}

interface TemperatureDebugDialogProps {
	open: boolean;
	onClose: () => void;
}

export const TemperatureDebugDialog = (props: TemperatureDebugDialogProps): JSX.Element => {
	const [loading, setLoading] = useState(true);
	const [rooms, setRooms] = useState<RoomStatus[]>([]);
	const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
	const [thermostat, setThermostat] = useState<CentralThermostatStatus | null>(null);

	const loadData = async () => {
		try {
			const [roomsResponse, debugResponse, thermostatResponse] = await Promise.all([
				apiGet('temperature', '/rooms', {}),
				apiGet('temperature', '/debug', {}),
				apiGet('temperature', '/central-thermostat', {}),
			]);

			if (roomsResponse.ok) {
				const data = await roomsResponse.json();
				setRooms(data.rooms || []);
			}

			if (debugResponse.ok) {
				const data = await debugResponse.json();
				setDebugInfo(data.debug);
			}

			if (thermostatResponse.ok) {
				const data = await thermostatResponse.json();
				if (data.configured && 'targetTemperature' in data) {
					setThermostat({
						currentTemperature: data.currentTemperature,
						targetTemperature: data.targetTemperature,
						isHeating: data.isHeating,
						mode: String(data.mode),
						hardwareTargetTemperature: data.hardwareTargetTemperature,
						deviceId: data.deviceId,
					});
				} else {
					setThermostat(null);
				}
			}
		} catch (error) {
			console.error('Failed to load debug data:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (props.open) {
			setLoading(true);
			void loadData();
			const interval = setInterval(() => void loadData(), 5000); // Refresh every 5s
			return () => clearInterval(interval);
		}
		return undefined;
	}, [props.open]);

	return (
		<Dialog open={props.open} onClose={props.onClose} maxWidth="md" fullWidth>
			<DialogTitle>Temperature Debug</DialogTitle>
			<DialogContent>
				{loading && !debugInfo ? (
					<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
						<CircularProgress />
					</Box>
				) : (
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
						{/* System Status */}
						<Paper variant="outlined" sx={{ p: 2 }}>
							<Typography variant="h6" gutterBottom>
								System Status
							</Typography>
							<Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
								<Box>
									<Typography variant="subtitle2" color="text.secondary">
										Active Schedule
									</Typography>
									<Typography variant="body1">
										{debugInfo?.activeScheduleName}
									</Typography>
								</Box>
								<Box>
									<Typography variant="subtitle2" color="text.secondary">
										Central Thermostat Logic
									</Typography>
									<Typography variant="body1">
										{debugInfo?.lastDecision}
									</Typography>
								</Box>
								<Box>
									<Typography variant="subtitle2" color="text.secondary">
										Central Hardware Target
									</Typography>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
										<Typography variant="body1">
											{thermostat?.hardwareTargetTemperature ?? '--'}°C
										</Typography>
										{thermostat?.isHeating && (
											<Chip
												icon={<FireIcon />}
												label="HEATING"
												color="warning"
												size="small"
											/>
										)}
									</Box>
								</Box>
								<Box>
									<Typography variant="subtitle2" color="text.secondary">
										Global Override
									</Typography>
									<Typography variant="body1">
										{debugInfo?.globalOverride
											? `${debugInfo.globalOverride}°C`
											: 'None'}
									</Typography>
								</Box>
							</Box>
						</Paper>

						{/* Rooms Table */}
						<Box>
							<Typography variant="h6" gutterBottom>
								Room Status
							</Typography>
							<TableContainer component={Paper} variant="outlined">
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>Room</TableCell>
											<TableCell align="right">Current</TableCell>
											<TableCell align="right">Target</TableCell>
											<TableCell align="center">Heating</TableCell>
											<TableCell align="right">Status</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{rooms.map((room) => (
											<TableRow key={room.name}>
												<TableCell component="th" scope="row">
													{room.name}
												</TableCell>
												<TableCell align="right">
													{Math.round(room.currentTemperature * 10) / 10}
													°C
												</TableCell>
												<TableCell align="right">
													{room.targetTemperature}°C
												</TableCell>
												<TableCell align="center">
													{room.isHeating ? (
														<FireIcon
															color="warning"
															fontSize="small"
														/>
													) : (
														'-'
													)}
												</TableCell>
												<TableCell align="right">
													{room.overrideActive ? (
														<Chip
															label="Override"
															color="secondary"
															size="small"
														/>
													) : (
														<Chip
															label="Schedule"
															variant="outlined"
															size="small"
														/>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</TableContainer>
						</Box>

						{/* History Log */}
						<Box>
							<Typography variant="h6" gutterBottom>
								Action History
							</Typography>
							<Paper
								variant="outlined"
								sx={{ maxHeight: 300, overflow: 'auto', p: 0 }}
							>
								<Table size="small" stickyHeader>
									<TableHead>
										<TableRow>
											<TableCell sx={{ width: 180 }}>Time</TableCell>
											<TableCell sx={{ width: 150 }}>Action</TableCell>
											<TableCell>Details</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{debugInfo?.history.map((entry, index) => (
											<TableRow key={index}>
												<TableCell
													sx={{
														whiteSpace: 'nowrap',
														color: 'text.secondary',
														fontSize: '0.85rem',
													}}
												>
													{new Date(entry.timestamp).toLocaleString()}
												</TableCell>
												<TableCell sx={{ fontWeight: 500 }}>
													{entry.action}
												</TableCell>
												<TableCell
													sx={{
														color: 'text.secondary',
														fontSize: '0.9rem',
													}}
												>
													{entry.details}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</Paper>
						</Box>
					</Box>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={props.onClose}>Close</Button>
			</DialogActions>
		</Dialog>
	);
};
