import type {
	DashboardDeviceClusterWithState,
	DeviceListWithValuesResponse,
} from '../../../server/modules/device/routing';
import { Box, Card, CardActionArea, Typography, CircularProgress, IconButton } from '@mui/material';
import type { DeviceClusterName } from '../../../server/modules/device/cluster';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DeviceClusterCard } from './DeviceClusterCard';
import { ClusterIconButton } from './ClusterIconButton';
import { DeviceDetail } from './DeviceDetail';
import * as Icons from '@mui/icons-material';
import type { SxProps } from '@mui/material';
import { useDevices } from './Devices';
import React from 'react';

type DeviceType = DeviceListWithValuesResponse[number];

interface RoomDevices {
	room: string;
	roomColor?: string;
	roomIcon?: string;
	devices: DeviceType[];
}

const getIconComponent = (iconName: string) => {
	const IconComponent = (Icons as Record<string, React.ComponentType<{ sx?: SxProps }>>)[
		iconName
	];
	return IconComponent ? <IconComponent /> : null;
};

export type HomeDetailView =
	| {
			type: 'room';
			roomName: string;
			clustersName?: DeviceClusterName;
	  }
	| {
			type: 'device';
			device: DeviceType;
			cluster: DashboardDeviceClusterWithState;
	  };

type HomeDetailViewWithFrom = HomeDetailView & {
	from: HomeDetailViewWithFrom | null;
};

export const Home = (): JSX.Element => {
	const { loading, devices, refresh } = useDevices();

	// Group devices by room
	const roomDevices: RoomDevices[] = React.useMemo(() => {
		const roomMap = new Map<string, RoomDevices>();

		for (const device of devices) {
			if (!device.room) {
				continue;
			}

			if (!roomMap.has(device.room)) {
				roomMap.set(device.room, {
					room: device.room,
					roomColor: device.roomColor,
					roomIcon: device.roomIcon,
					devices: [],
				});
			}

			roomMap.get(device.room)!.devices.push(device);
		}

		return Array.from(roomMap.values()).sort((a, b) => a.room.localeCompare(b.room));
	}, [devices]);

	const [detailView, setDetailView] = React.useState<HomeDetailViewWithFrom | null>(null);
	const pushDetailView = React.useCallback((newDetailView: HomeDetailView) => {
		setDetailView((oldDetailView) => ({
			...newDetailView,
			from: oldDetailView,
		}));
	}, []);
	const popDetailView = React.useCallback(() => {
		setDetailView((oldDetailView) => oldDetailView?.from ?? null);
	}, []);

	if (loading) {
		return (
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '50vh',
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	if (detailView && detailView.type === 'room') {
		const room = roomDevices.find((r) => r.room === detailView.roomName);
		if (room) {
			return (
				<RoomDetail
					room={room}
					onExit={popDetailView}
					devices={devices
						.filter((d) => d.room === detailView.roomName)
						.filter(
							(d) =>
								!detailView.clustersName ||
								d.allClusters.some((c) => c.name === detailView.clustersName)
						)}
					invalidate={() => refresh(false)}
					pushDetailView={pushDetailView}
				/>
			);
		}
	}
	if (detailView && detailView.type === 'device') {
		return (
			<DeviceDetail
				device={detailView.device}
				cluster={detailView.cluster}
				onExit={popDetailView}
			/>
		);
	}

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
			<Box
				sx={{
					display: 'flex',
					flexDirection: 'column',
					gap: 2,
				}}
			>
				{roomDevices.map((room) => {
					return (
						<RoomDevice
							roomDevices={room}
							key={room.room}
							setRoom={() =>
								pushDetailView({
									type: 'room',
									roomName: room.room,
								})
							}
							pushDetailView={(clusterName) =>
								pushDetailView({
									type: 'room',
									roomName: room.room,
									clustersName: clusterName,
								})
							}
							invalidate={() => refresh(false)}
						/>
					);
				})}
			</Box>

			{roomDevices.length === 0 && (
				<Typography
					variant="body1"
					sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}
				>
					No devices assigned to rooms yet. Go to the Devices tab to assign devices to
					rooms.
				</Typography>
			)}
		</Box>
	);
};

interface RoomDetailProps {
	room: RoomDevices;
	onExit: () => void;
	devices: DeviceType[];
	invalidate: () => void;
	pushDetailView: (detailView: HomeDetailView) => void;
}

const RoomDetail = (props: RoomDetailProps) => {
	// Create entries for each device-cluster combination
	const deviceClusterEntries = React.useMemo(() => {
		const entries = [];

		for (const device of props.devices) {
			for (const cluster of device.allClusters) {
				entries.push({
					device,
					cluster,
				});
			}
		}

		// Sort by cluster name first, then by device name
		return entries.sort((a, b) => {
			const clusterCompare = a.cluster.name.localeCompare(b.cluster.name);
			if (clusterCompare !== 0) {
				return clusterCompare;
			}
			return a.device.name.localeCompare(b.device.name);
		});
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
				}}
			>
				<IconButton
					style={{ position: 'absolute', left: 0 }}
					onClick={() => props.onExit()}
				>
					<ArrowBackIcon style={{ fill: 'black' }} />
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
						{props.room.room}
					</Typography>
				</Box>
			</Box>

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
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
								pushDetailView={props.pushDetailView}
							/>
						);
					})}
				</Box>
			</Box>
		</Box>
	);
};

interface RoomDeviceProps {
	roomDevices: RoomDevices;
	invalidate: () => void;
	setRoom: () => void;
	pushDetailView: (clusterName: DeviceClusterName) => void;
}

const RoomDevice = (props: RoomDeviceProps) => {
	// Find which clusters are represented in this room
	const representedClusters = new Set<DeviceClusterName>();
	for (const device of props.roomDevices.devices) {
		for (const cluster of device.allClusters) {
			representedClusters.add(cluster.name);
		}
	}

	return (
		<Card
			key={props.roomDevices.room}
			sx={{
				backgroundColor: props.roomDevices.roomColor || '#555',
				borderRadius: 2,
				overflow: 'hidden',
			}}
		>
			<CardActionArea
				onClick={() => {
					// Wait for animation
					setTimeout(() => {
						props.setRoom();
					}, 300);
				}}
				component="div"
				sx={{ p: 2 }}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: 2,
					}}
				>
					{/* Room icon */}
					{props.roomDevices.roomIcon && (
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								color: 'rgba(0, 0, 0, 0.6)',
								fontSize: '2rem',
							}}
						>
							{getIconComponent(props.roomDevices.roomIcon)}
						</Box>
					)}

					{/* Room name */}
					<Typography
						variant="h6"
						sx={{
							color: '#2f2f2f',
							fontWeight: 500,
							flexGrow: 1,
						}}
					>
						{props.roomDevices.room}
					</Typography>

					{/* Device cluster icons */}
					<Box
						sx={{
							display: 'flex',
							gap: 1,
							alignItems: 'center',
						}}
					>
						{Array.from(representedClusters)
							.sort()
							.map((clusterName) => (
								<ClusterIconButton
									clusterName={clusterName}
									key={clusterName}
									devices={props.roomDevices.devices}
									invalidate={props.invalidate}
									onLongPress={() => {
										props.pushDetailView(clusterName);
									}}
								/>
							))}
					</Box>
				</Box>
			</CardActionArea>
		</Card>
	);
};
