import type {
	DashboardDeviceClusterAirQualityGroup,
	CO2LevelValue,
} from '../../../server/modules/device/routing';
import { Box, Card, CardActionArea, CardContent, Typography } from '@mui/material';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { Air as AirIcon } from '@mui/icons-material';
import type { HomeDetailView } from './Home';
import { useDevices } from './Devices';
import React from 'react';

/**
 * Get air quality level info based on CO2 level
 * CO2 level: Unknown=0, Low=1, Medium=2, High=3, Critical=4
 */
const getAirQualityInfo = (
	co2Level: CO2LevelValue
): { label: string; color: string; iconColor: string } => {
	switch (co2Level) {
		case 1:
			return { label: 'Good', color: '#10b981', iconColor: '#34d399' };
		case 2:
			return { label: 'Moderate', color: '#f59e0b', iconColor: '#fbbf24' };
		case 3:
			return { label: 'Poor', color: '#ef4444', iconColor: '#f87171' };
		case 4:
			return { label: 'Critical', color: '#dc2626', iconColor: '#f87171' };
		default:
			return { label: 'Unknown', color: '#6b7280', iconColor: '#9ca3af' };
	}
};

interface AirQualityDisplayProps {
	pushDetailView: (view: HomeDetailView) => void;
}

export const AirQualityDisplay = (props: AirQualityDisplayProps): JSX.Element | null => {
	const { devices } = useDevices();

	// Find the air quality data from devices
	const airQualityData = React.useMemo(() => {
		for (const device of devices ?? []) {
			for (const cluster of device.mergedAllClusters ?? []) {
				if (cluster.name === DeviceClusterName.AIR_QUALITY && 'mergedClusters' in cluster) {
					const airQualityGroup = cluster as DashboardDeviceClusterAirQualityGroup;
					const co2Cluster =
						airQualityGroup.mergedClusters[
							DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT
						];
					if (co2Cluster?.concentration !== undefined) {
						return {
							concentration: co2Cluster.concentration,
							level: co2Cluster.level,
							deviceName: device.name,
							deviceId: device.uniqueId,
							clusterName: cluster.name,
						};
					}
				}
			}
		}
		return null;
	}, [devices]);

	const handleClick = React.useCallback(() => {
		if (!airQualityData) {
			return;
		}
		props.pushDetailView({
			type: 'device',
			deviceId: airQualityData.deviceId,
			clusterName: airQualityData.clusterName,
		});
	}, [props, airQualityData]);

	// Don't render if no air quality data
	if (!airQualityData) {
		return null;
	}

	const { label, iconColor } = getAirQualityInfo(airQualityData.level);

	return (
		<Box>
			<Card
				sx={{
					pointerEvents: 'auto',
					borderRadius: 4,
					minWidth: 120,
					boxShadow: 3,
					transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
					'&:hover': {
						boxShadow: 6,
						transform: 'translateY(-2px)',
					},
				}}
			>
				<CardActionArea onClick={handleClick}>
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
						<AirIcon
							sx={{
								fontSize: { xs: 24, sm: 28 },
								color: iconColor,
							}}
						/>
						<Box sx={{ display: 'flex', flexDirection: 'column' }}>
							<Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
								{Math.round(airQualityData.concentration)} ppm
							</Typography>
							<Typography
								variant="caption"
								sx={{
									color: iconColor,
									fontWeight: 500,
									lineHeight: 1,
								}}
							>
								{label}
							</Typography>
						</Box>
					</CardContent>
				</CardActionArea>
			</Card>
		</Box>
	);
};
