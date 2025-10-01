import { Box, Card, CardActionArea, Typography, CircularProgress, IconButton } from '@mui/material';
import type { DeviceClusterName } from '../../../server/modules/device/cluster';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DeviceClusterCard } from './DeviceClusterCard';
import { ClusterIconButton } from './ClusterIconButton';
import type { ReturnTypeForApi } from '../../lib/fetch';
import React, { useState, useEffect } from 'react';
import * as Icons from '@mui/icons-material';
import type { SxProps } from '@mui/material';
import { apiGet } from '../../lib/fetch';

type DeviceType = ReturnTypeForApi<'device', '/listWithValues', 'GET'>['ok']['devices'][number];

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

export const Home = (): JSX.Element => {
	const [devices, setDevices] = useState<DeviceType[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [detailView, setDetailView] = useState<{
		roomName: string;
		clusterName?: DeviceClusterName;
	} | null>(null);

	useEffect(() => {
		void fetchDevices(true);
	}, []);

	const fetchDevices = async (clear: boolean) => {
		try {
			if (clear) {
				setLoading(true);
			}
			const response = await apiGet('device', '/listWithValues', {});
			if (response.ok) {
				const data = await response.json();
				setDevices(data.devices);
			} else {
				setError('Failed to fetch devices');
			}
		} catch (err) {
			setError('Error loading devices');
			console.error('Failed to fetch devices:', err);
		} finally {
			setLoading(false);
		}
	};

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

	if (error) {
		return (
			<Box sx={{ p: 3 }}>
				<Typography color="error">{error}</Typography>
			</Box>
		);
	}

	if (detailView) {
		return (
			<RoomDetail
				room={roomDevices.find((r) => r.room === detailView.roomName)!}
				onExit={() => setDetailView(null)}
				devices={devices
					.filter((d) => d.room === detailView.roomName)
					.filter(
						(d) =>
							!detailView.clusterName ||
							d.allClusters.some((c) => c.name === detailView.clusterName)
					)}
				invalidate={() => fetchDevices(false)}
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
							setRoom={() => setDetailView({ roomName: room.room })}
							setDetailView={(clusterName) =>
								setDetailView({
									roomName: room.room,
									clusterName,
								})
							}
							invalidate={() => fetchDevices(false)}
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
	setDetailView: (clusterName: DeviceClusterName) => void;
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
										props.setDetailView(clusterName);
									}}
								/>
							))}
					</Box>
				</Box>
			</CardActionArea>
		</Card>
	);
};
