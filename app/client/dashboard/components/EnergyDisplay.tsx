import { BoltRounded as BoltRoundedIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { Box, Card, CardContent, Typography, IconButton } from '@mui/material';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { DeviceSource } from '../../../server/modules/device/device';
import { useDevices } from './Devices';
import React from 'react';

interface EnergyDisplayProps {
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
}

export const EnergyDisplay = (props: EnergyDisplayProps): JSX.Element => {
	const { devices } = useDevices();

	const energies = React.useMemo(() => {
		try {
			const homeWizardDevice = devices.find(
				(d) => d.source.name === DeviceSource.HOMEWIZARD.value
			);
			if (homeWizardDevice) {
				let homeWizardPower: number = 0;
				let homeWizardEnergy: number = 0;
				for (const cluster of homeWizardDevice.flatAllClusters ?? []) {
					if (cluster.name === DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT) {
						homeWizardPower = cluster.activePower;
					}
					if (cluster.name === DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT) {
						homeWizardEnergy = Number(cluster.totalEnergy);
					}
				}
				return [
					{
						name: 'P1 meter',
						energy: homeWizardEnergy,
						power: homeWizardPower,
					},
				];
			}

			const energies = [];
			for (const device of devices ?? []) {
				for (const cluster of device.flatAllClusters ?? []) {
					let totalPower = 0;
					let totalEnergy = 0;
					if (cluster.name === DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT) {
						totalPower += cluster.activePower;
					}
					if (cluster.name === DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT) {
						totalEnergy += Number(cluster.totalEnergy);
					}
					if (totalPower > 0 || totalEnergy > 0) {
						energies.push({
							name: device.name,
							energy: totalEnergy,
							power: totalPower,
						});
					}
				}
			}
			return energies;
		} catch (error) {
			console.error('Failed to load energy:', error);
			return [];
		}
	}, [devices]);

	const onExpandedChange = props.onExpandedChange;
	const handleToggle = () => {
		onExpandedChange(!props.expanded);
	};

	// Don't show expand button if there's no room data
	const canExpand = energies.length > 0;

	return (
		<Box>
			<Card
				sx={{
					pointerEvents: 'auto',
					borderRadius: 4,
					minWidth: 120,
					boxShadow: 3,
					transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
							transform: props.expanded ? 'rotate(15deg)' : 'rotate(0deg)',
						}}
					/>
					<Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
						{energies.reduce((acc, energy) => acc + energy.power, 0)}W
					</Typography>
					{canExpand && (
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
					)}
				</CardContent>
			</Card>
		</Box>
	);
};
