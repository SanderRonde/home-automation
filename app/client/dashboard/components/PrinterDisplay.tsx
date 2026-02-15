import type { DashboardDeviceClusterThreeDPrinter } from '../../../server/modules/device/routing';
import { Box, Card, CardActionArea, CardContent, Typography } from '@mui/material';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { Print as PrintIcon } from '@mui/icons-material';
import type { HomeDetailView } from './Home';
import { useDevices } from './Devices';
import React from 'react';

interface PrinterDisplayProps {
	pushDetailView: (view: HomeDetailView) => void;
}

export const PrinterDisplay = (props: PrinterDisplayProps): JSX.Element | null => {
	const { devices } = useDevices();

	const printerData = React.useMemo(() => {
		for (const device of devices ?? []) {
			const cluster = device.mergedAllClusters?.find(
				(c): c is DashboardDeviceClusterThreeDPrinter =>
					c.name === DeviceClusterName.THREE_D_PRINTER
			);
			if (cluster) {
				return {
					deviceId: device.uniqueId,
					deviceName: device.name,
					printState: cluster.printState,
					progress: cluster.progress,
				};
			}
		}
		return null;
	}, [devices]);

	const handleClick = React.useCallback(() => {
		if (!printerData) {
			return;
		}
		props.pushDetailView({
			type: 'device',
			deviceId: printerData.deviceId,
			clusterName: DeviceClusterName.THREE_D_PRINTER,
		});
	}, [props, printerData]);

	if (!printerData) {
		return null;
	}

	const isPrinting = printerData.printState === 'printing' || printerData.printState === 'paused';
	const progressPercent =
		isPrinting && typeof printerData.progress === 'number'
			? Math.round(printerData.progress * 100)
			: null;

	const hasProgress = progressPercent !== null;

	return (
		<Box sx={{ width: 'fit-content' }}>
			<Card
				sx={{
					pointerEvents: 'auto',
					borderRadius: 4,
					width: 'fit-content',
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
							gap: hasProgress ? 1 : 0,
							py: { xs: 1, sm: 1.5 },
							px: hasProgress ? { xs: 1.5, sm: 2 } : { xs: 1, sm: 1.5 },
							minHeight: { xs: '40px', sm: '58px' },
							'&:last-child': {
								pb: { xs: 1, sm: 1.5 },
							},
						}}
					>
						<PrintIcon
							sx={{
								fontSize: { xs: 24, sm: 28 },
								color: 'text.secondary',
							}}
						/>
						{progressPercent !== null ? (
							<Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
								{progressPercent}%
							</Typography>
						) : null}
					</CardContent>
				</CardActionArea>
			</Card>
		</Box>
	);
};
