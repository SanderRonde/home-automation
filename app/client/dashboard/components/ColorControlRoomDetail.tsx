import type {
	DashboardDeviceClusterWithState,
	DeviceListWithValuesResponse,
} from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { Box, IconButton, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { Palette } from '../../../../types/palette';
import { DeviceClusterCard } from './DeviceClusterCard';
import { PaletteSelector } from './PaletteSelector';
import { apiGet, apiPost } from '../../lib/fetch';
import React from 'react';

type DeviceType = DeviceListWithValuesResponse[number];

interface RoomDevices {
	room: string;
	roomColor?: string;
	roomIcon?: string;
	devices: DeviceType[];
}

interface ColorControlRoomDetailProps {
	room: RoomDevices;
	onExit: () => void;
	devices: DeviceType[];
	invalidate: () => void;
}

export const ColorControlRoomDetail = (props: ColorControlRoomDetailProps): JSX.Element => {
	const [palettes, setPalettes] = React.useState<Palette[]>([]);
	const [applyingPalette, setApplyingPalette] = React.useState<string | null>(null);

	React.useEffect(() => {
		const loadPalettes = async () => {
			try {
				const response = await apiGet('device', '/palettes/list', {});
				if (response.ok) {
					const data = await response.json();
					setPalettes(data.palettes);
				}
			} catch (error) {
				console.error('Failed to load palettes:', error);
			}
		};
		void loadPalettes();
	}, []);

	const handleApplyPalette = async (paletteId: string) => {
		setApplyingPalette(paletteId);
		try {
			const deviceIds = props.devices.map((d) => d.uniqueId);
			const response = await apiPost(
				'device',
				'/palettes/:paletteId/apply',
				{ paletteId },
				{ deviceIds }
			);
			if (response.ok) {
				// Refresh devices to show new colors
				props.invalidate();
			}
		} catch (error) {
			console.error('Failed to apply palette:', error);
		} finally {
			setApplyingPalette(null);
		}
	};

	// Create entries for each device-cluster combination (ColorControl only)
	const deviceClusterEntries = React.useMemo(() => {
		const entries: Array<{
			device: DeviceType;
			cluster: DashboardDeviceClusterWithState;
		}> = [];

		for (const device of props.devices) {
			for (const cluster of device.mergedAllClusters) {
				if (cluster.name === DeviceClusterName.COLOR_CONTROL) {
					entries.push({
						device,
						cluster,
					});
				}
			}
		}

		return entries.sort((a, b) => a.device.name.localeCompare(b.device.name));
	}, [props.devices]);

	return (
		<Box>
			<Box
				sx={{
					backgroundColor: props.room.roomColor,
					py: 1,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
				}}
			>
				<IconButton sx={{ position: 'absolute', left: 0 }} onClick={() => props.onExit()}>
					<ArrowBackIcon sx={{ fill: 'black' }} />
				</IconButton>
				<Box
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						width: '100%',
					}}
				>
					<Typography style={{ color: 'black', fontWeight: 'bold' }} variant="h6">
						{props.room.room} - Colors
					</Typography>
				</Box>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				{/* Palette Selector */}
				{palettes.length > 0 && (
					<Box sx={{ mb: 3 }}>
						<Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
							Color Palettes:
						</Typography>
						<PaletteSelector
							palettes={palettes}
							onSelect={handleApplyPalette}
							selectedPaletteId={applyingPalette}
						/>
					</Box>
				)}

				{/* Device List */}
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						gap: 2,
					}}
				>
					{deviceClusterEntries.map((entry, index) => {
						return (
							<DeviceClusterCard
								key={`${entry.device.uniqueId}-${entry.cluster.name}-${index}`}
								device={entry.device}
								cluster={entry.cluster}
								invalidate={props.invalidate}
								pushDetailView={() => {}}
							/>
						);
					})}
				</Box>

				{deviceClusterEntries.length === 0 && (
					<Typography
						variant="body1"
						sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}
					>
						No ColorControl devices found in this room.
					</Typography>
				)}
			</Box>
		</Box>
	);
};
