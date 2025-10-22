import type {
	DashboardDeviceClusterWithState,
	DeviceListWithValuesResponse,
} from '../../../server/modules/device/routing';
import {
	Box,
	Card,
	CardActionArea,
	Typography,
	CircularProgress,
	IconButton,
	Chip,
} from '@mui/material';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type { DeviceClusterCardBaseProps } from './DeviceClusterCard';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { Palette } from '../../../../types/palette';
import { fadeInUpStaggered } from '../../lib/animations';
import { DeviceClusterCard } from './DeviceClusterCard';
import { ClusterIconButton } from './ClusterIconButton';
import type { Scene } from '../../../../types/scene';
import { PaletteSelector } from './PaletteSelector';
import { apiGet, apiPost } from '../../lib/fetch';
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
	const [scenes, setScenes] = React.useState<Scene[]>([]);
	const [triggeringSceneId, setTriggeringSceneId] = React.useState<string | null>(null);

	// Load scenes with triggers
	React.useEffect(() => {
		const loadScenes = async () => {
			try {
				const response = await apiGet('device', '/scenes/list', {});
				if (response.ok) {
					const data = await response.json();
					// Only show scenes without triggers on home screen. If there is a trigger
					// it will run automatically when the trigger is met.
					setScenes(data.scenes.filter((scene: Scene) => !scene.trigger));
				}
			} catch (error) {
				console.error('Failed to load scenes:', error);
			}
		};
		void loadScenes();
	}, []);

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

	const handleTriggerScene = async (sceneId: string) => {
		setTriggeringSceneId(sceneId);
		try {
			const response = await apiPost('device', '/scenes/:sceneId/trigger', { sceneId });
			if (!response.ok) {
				console.error('Failed to trigger scene');
			}
		} catch (error) {
			console.error('Failed to trigger scene:', error);
		} finally {
			setTriggeringSceneId(null);
		}
	};

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
					clustersName={detailView.clustersName}
					devices={devices
						.filter((d) => d.room === detailView.roomName)
						.filter(
							(d) =>
								!detailView.clustersName ||
								d.mergedAllClusters.some((c) => c.name === detailView.clustersName)
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
				{/* Scene Triggers */}
				{scenes.length > 0 && (
					<Box
						sx={{
							display: 'flex',
							flexWrap: 'wrap',
							gap: 1.5,
						}}
					>
						{scenes.map((scene) => {
							const IconComponent = Icons[scene.icon] as React.ComponentType;
							return (
								<Chip
									key={scene.id}
									icon={<IconComponent />}
									label={scene.title}
									onClick={() => handleTriggerScene(scene.id)}
									disabled={triggeringSceneId === scene.id}
									sx={{
										height: 48,
										px: 2,
										fontSize: '0.95rem',
										fontWeight: 500,
										backgroundColor: 'background.paper',
										border: '1px solid',
										borderColor: 'divider',
										'& .MuiChip-icon': {
											fontSize: '1.4rem',
										},
										'&:hover': {
											backgroundColor: 'action.hover',
										},
									}}
								/>
							);
						})}
					</Box>
				)}

				{roomDevices.map((room, index) => {
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
							animationIndex={index}
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
	clustersName: DeviceClusterName | undefined;
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
			for (const cluster of device.mergedAllClusters) {
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
						{props.room.room}
					</Typography>
				</Box>
			</Box>

			{props.clustersName === DeviceClusterName.COLOR_CONTROL && (
				<ColorControlRoomDetail
					clustersName={props.clustersName}
					pushDetailView={props.pushDetailView}
					room={props.room}
					onExit={props.onExit}
					devices={props.devices}
					invalidate={props.invalidate}
				/>
			)}

			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						gap: 2,
					}}
				>
					{(() => {
						let animationIndex = 0;
						return deviceClusterEntries.map((entry) => {
							const currentAnimationIndex = animationIndex;
							const Component = DeviceClusterCard({
								key: `${entry.device.uniqueId}-${entry.cluster.name}`,
								device: entry.device,
								cluster: entry.cluster,
								invalidate: props.invalidate,
								pushDetailView: props.pushDetailView,
								animationIndex: currentAnimationIndex,
							} as DeviceClusterCardBaseProps<DashboardDeviceClusterWithState>);
							if (Component !== null) {
								animationIndex++;
							}
							return Component;
						});
					})()}
				</Box>
			</Box>
		</Box>
	);
};

const ColorControlRoomDetail = (props: RoomDetailProps): JSX.Element => {
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

	return (
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
		</Box>
	);
};

interface RoomDeviceProps {
	roomDevices: RoomDevices;
	invalidate: () => void;
	setRoom: () => void;
	pushDetailView: (clusterName: DeviceClusterName) => void;
	animationIndex: number;
}

const RoomDevice = (props: RoomDeviceProps) => {
	// Find which clusters are represented in this room
	const representedClusters = new Set<DeviceClusterName>();
	for (const device of props.roomDevices.devices) {
		for (const cluster of device.mergedAllClusters) {
			representedClusters.add(cluster.name);
		}
	}

	return (
		<Card
			key={props.roomDevices.room}
			sx={{
				...fadeInUpStaggered(props.animationIndex),
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
									allClusters={representedClusters}
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
