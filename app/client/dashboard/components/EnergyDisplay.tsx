import {
	BoltRounded as BoltRoundedIcon,
	ExpandMore as ExpandMoreIcon,
	ExpandLess as ExpandLessIcon,
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
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import React, { useState, useEffect } from 'react';
import { apiGet } from '../../lib/fetch';

interface EnergyDisplayProps {}

interface Device {
	uniqueId: string;
	name: string;
	room?: string;
	flatAllClusters?: Array<{
		name: string;
		activePower?: number;
	}>;
}

interface RoomEnergy {
	room: string;
	power: number;
}

export const EnergyDisplay = (_props: EnergyDisplayProps): JSX.Element => {
	const [totalPower, setTotalPower] = useState<number | null>(null);
	const [roomEnergies, setRoomEnergies] = useState<RoomEnergy[]>([]);
	const [loading, setLoading] = useState(true);
	const [expanded, setExpanded] = useState(false);
	const [isHomeWizard, setIsHomeWizard] = useState(false);

	const loadEnergy = async () => {
		try {
			// First try to get HomeWizard data
			const configResponse = await apiGet('homewizard', '/config', {});
			let homeWizardPower: number | null = null;

			if (configResponse.ok) {
				const configData = (await configResponse.json()) as { ip: string | null };
				if (configData.ip) {
					// HomeWizard is configured, get its data
					const devicesResponse = await apiGet('device', '/listWithValues', {});
					if (devicesResponse.ok) {
						const devicesData = (await devicesResponse.json()) as { devices: Device[] };
						const homeWizardDevice = devicesData.devices?.find((d) =>
							d.uniqueId.startsWith('homewizard-')
						);

						if (homeWizardDevice) {
							const powerCluster = homeWizardDevice.flatAllClusters?.find(
								(c) => c.name === DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT
							);
							if (powerCluster?.activePower !== undefined) {
								homeWizardPower = powerCluster.activePower;
								setIsHomeWizard(true);
							}
						}
					}
				}
			}

			// If HomeWizard data is available, use it
			if (homeWizardPower !== null) {
				setTotalPower(homeWizardPower);
				setRoomEnergies([]);
			} else {
				// Otherwise, sum up all other electrical devices
				setIsHomeWizard(false);
				const devicesResponse = await apiGet('device', '/listWithValues', {});
				if (devicesResponse.ok) {
					const devicesData = (await devicesResponse.json()) as { devices: Device[] };
					const roomPowerMap = new Map<string, number>();
					let total = 0;

					for (const device of devicesData.devices ?? []) {
						// Skip HomeWizard device
						if (device.uniqueId.startsWith('homewizard-')) {
							continue;
						}

						const powerCluster = device.flatAllClusters?.find(
							(c) => c.name === DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT
						);
						if (powerCluster?.activePower !== undefined) {
							const power = powerCluster.activePower;
							total += power;

							const room = device.room || 'Unknown';
							roomPowerMap.set(room, (roomPowerMap.get(room) || 0) + power);
						}
					}

					setTotalPower(total);
					setRoomEnergies(
						Array.from(roomPowerMap.entries())
							.map(([room, power]) => ({ room, power }))
							.sort((a, b) => b.power - a.power)
					);
				}
			}
		} catch (error) {
			console.error('Failed to load energy:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadEnergy();
		// Update energy every 15 seconds
		const interval = setInterval(() => {
			void loadEnergy();
		}, 15000);
		return () => clearInterval(interval);
	}, []);

	const handleToggle = () => {
		setExpanded((prev) => !prev);
	};

	// Don't show expand button if there's no room data
	const canExpand = !isHomeWizard && roomEnergies.length > 0;

	return (
		<Box
			sx={{
				position: 'absolute',
				bottom: { xs: 12, sm: 16 },
				right: 0,
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
					<BoltRoundedIcon
						sx={{
							fontSize: { xs: 24, sm: 28 },
							color: '#f59e0b',
							transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
							transform: expanded ? 'rotate(15deg)' : 'rotate(0deg)',
						}}
					/>
					{loading ? (
						<CircularProgress size={20} />
					) : (
						<>
							<Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
								{totalPower !== null ? `${Math.round(totalPower)}W` : '--W'}
							</Typography>
							{canExpand && (
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
							)}
						</>
					)}
				</CardContent>

				{/* Per-room breakdown */}
				{canExpand && (
					<Collapse in={expanded}>
						<Box
							sx={{
								borderTop: 1,
								borderColor: 'divider',
								px: 2,
								py: 1.5,
								maxHeight: 300,
								overflowY: 'auto',
							}}
						>
							{roomEnergies.map((roomEnergy) => (
								<Box
									key={roomEnergy.room}
									sx={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										py: 0.5,
									}}
								>
									<Typography variant="body2" color="text.secondary">
										{roomEnergy.room}
									</Typography>
									<Typography
										variant="body2"
										sx={{ fontWeight: 600, color: '#f59e0b' }}
									>
										{Math.round(roomEnergy.power)}W
									</Typography>
								</Box>
							))}
						</Box>
					</Collapse>
				)}
			</Card>
		</Box>
	);
};
