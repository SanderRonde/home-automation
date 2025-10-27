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
import type { DeviceGroup } from '../../../../types/group';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { Palette } from '../../../../types/palette';
import { fadeInUpStaggered } from '../../lib/animations';
import { DeviceClusterCard } from './DeviceClusterCard';
import { ClusterIconButton } from './ClusterIconButton';
import type { Scene } from '../../../../types/scene';
import { PaletteSelector } from './PaletteSelector';
import { apiGet, apiPost } from '../../lib/fetch';
import type { IncludedIconNames } from './icon';
import { DeviceDetail } from './DeviceDetail';
import { useDevices } from './Devices';
import { IconComponent } from './icon';
import React from 'react';

type DeviceType = DeviceListWithValuesResponse[number];

interface RoomDevices {
	room: string;
	roomColor?: string;
	roomIcon?: IncludedIconNames;
	devices: DeviceType[];
}

interface GroupDevices {
	group: DeviceGroup;
	devices: DeviceType[];
}

export type HomeDetailView =
	| {
			type: 'room';
			roomName: string;
			clustersName?: DeviceClusterName;
	  }
	| {
			type: 'group';
			groupId: string;
			clustersName?: DeviceClusterName;
	  }
	| {
			type: 'device';
			device: DeviceType;
			cluster: DashboardDeviceClusterWithState;
	  }
	| {
			type: 'room-grouped-cluster';
			roomName: string;
			clusterName: DeviceClusterName;
			devices: DeviceType[];
	  };

type HomeDetailViewWithFrom = HomeDetailView & {
	from: HomeDetailViewWithFrom | null;
};

// Helper function to parse detail view from URL hash
function parseDetailViewFromHash(hash: string, devices: DeviceType[]): HomeDetailView | null {
	// Extract query string from hash (e.g., "#home?view=room&name=Living%20Room")
	const hashParts = hash.split('?');
	if (hashParts.length < 2) {
		return null;
	}

	const params = new URLSearchParams(hashParts[1]);
	const viewType = params.get('view');

	if (viewType === 'room') {
		const roomName = params.get('name');
		const clusterName = params.get('cluster') as DeviceClusterName | null;
		if (roomName) {
			return {
				type: 'room',
				roomName: decodeURIComponent(roomName),
				clustersName: clusterName || undefined,
			};
		}
	} else if (viewType === 'group') {
		const groupId = params.get('id');
		const clusterName = params.get('cluster') as DeviceClusterName | null;
		if (groupId) {
			return {
				type: 'group',
				groupId: decodeURIComponent(groupId),
				clustersName: clusterName || undefined,
			};
		}
	} else if (viewType === 'device') {
		const deviceId = params.get('deviceId');
		const clusterName = params.get('cluster') as DeviceClusterName;
		if (deviceId && clusterName) {
			const device = devices.find((d) => d.uniqueId === deviceId);
			const cluster = device?.mergedAllClusters.find((c) => c.name === clusterName);
			if (device && cluster) {
				return {
					type: 'device',
					device,
					cluster,
				};
			}
		}
	} else if (viewType === 'room-grouped-cluster') {
		const roomName = params.get('name');
		const clusterName = params.get('cluster') as DeviceClusterName;
		const deviceIdsParam = params.get('deviceIds');
		if (roomName && clusterName && deviceIdsParam) {
			const deviceIds = deviceIdsParam.split(',');
			const groupedDevices = devices.filter((d) => deviceIds.includes(d.uniqueId));
			if (groupedDevices.length > 0) {
				return {
					type: 'room-grouped-cluster',
					roomName: decodeURIComponent(roomName),
					clusterName,
					devices: groupedDevices,
				};
			}
		}
	}

	return null;
}

// Helper function to serialize detail view to URL hash
function serializeDetailViewToHash(view: HomeDetailView | null): string {
	if (!view) {
		return 'home';
	}

	if (view.type === 'room') {
		const params = new URLSearchParams();
		params.set('view', 'room');
		params.set('name', view.roomName);
		if (view.clustersName) {
			params.set('cluster', view.clustersName);
		}
		return `home?${params.toString()}`;
	} else if (view.type === 'group') {
		const params = new URLSearchParams();
		params.set('view', 'group');
		params.set('id', view.groupId);
		if (view.clustersName) {
			params.set('cluster', view.clustersName);
		}
		return `home?${params.toString()}`;
	} else if (view.type === 'device') {
		const params = new URLSearchParams();
		params.set('view', 'device');
		params.set('deviceId', view.device.uniqueId);
		params.set('cluster', view.cluster.name);
		return `home?${params.toString()}`;
	} else if (view.type === 'room-grouped-cluster') {
		const params = new URLSearchParams();
		params.set('view', 'room-grouped-cluster');
		params.set('name', view.roomName);
		params.set('cluster', view.clusterName);
		params.set('deviceIds', view.devices.map((d) => d.uniqueId).join(','));
		return `home?${params.toString()}`;
	}

	return 'home';
}

export const Home = (): JSX.Element => {
	const { loading, devices, refresh } = useDevices();
	const [scenes, setScenes] = React.useState<Scene[]>([]);
	const [groups, setGroups] = React.useState<DeviceGroup[]>([]);
	const [triggeringSceneId, setTriggeringSceneId] = React.useState<string | null>(null);

	// Load scenes marked as favorites
	React.useEffect(() => {
		const loadScenes = async () => {
			try {
				const response = await apiGet('device', '/scenes/list', {});
				if (response.ok) {
					const data = await response.json();
					// Only show scenes marked to show on home screen
					setScenes(data.scenes.filter((scene: Scene) => scene.showOnHome === true));
				}
			} catch (error) {
				console.error('Failed to load scenes:', error);
			}
		};
		void loadScenes();
	}, []);

	// Load all groups (for navigation purposes)
	React.useEffect(() => {
		const loadGroups = async () => {
			try {
				const response = await apiGet('device', '/groups/list', {});
				if (response.ok) {
					const data = await response.json();
					setGroups(data.groups);
				}
			} catch (error) {
				console.error('Failed to load groups:', error);
			}
		};
		void loadGroups();
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

	// Create group devices array (all groups for navigation)
	const groupDevices: GroupDevices[] = React.useMemo(() => {
		return groups.map((group) => ({
			group,
			devices: devices.filter((device) => group.deviceIds.includes(device.uniqueId)),
		}));
	}, [groups, devices]);

	// Filter groups to show on home page
	const homePageGroups: GroupDevices[] = React.useMemo(() => {
		return groupDevices.filter((groupData) => groupData.group.showOnHome === true);
	}, [groupDevices]);

	const [detailView, setDetailView] = React.useState<HomeDetailViewWithFrom | null>(null);

	// Initialize detail view from URL on mount
	React.useEffect(() => {
		if (!loading && devices.length > 0) {
			const parsedView = parseDetailViewFromHash(window.location.hash, devices);
			if (parsedView) {
				setDetailView({ ...parsedView, from: null });
			}
		}
	}, [loading, devices]);

	const pushDetailView = React.useCallback((newDetailView: HomeDetailView) => {
		setDetailView((oldDetailView) => {
			const newView = {
				...newDetailView,
				from: oldDetailView,
			};
			// Update URL to reflect the new view
			const newHash = serializeDetailViewToHash(newDetailView);
			const currentHash = window.location.hash.slice(1); // Remove # for comparison
			if (currentHash !== newHash) {
				window.location.hash = newHash;
			}
			return newView;
		});
	}, []);

	const popDetailView = React.useCallback(() => {
		// Use browser back instead of directly manipulating state
		window.history.back();
	}, []);

	// Listen for browser navigation (back/forward buttons)
	React.useEffect(() => {
		const handleHashChange = () => {
			const hash = window.location.hash;

			// Check if we're at the main home view
			if (hash === '#home' || !hash.includes('?')) {
				setDetailView(null);
			} else {
				// Parse the URL and update state
				const parsedView = parseDetailViewFromHash(hash, devices);
				if (parsedView) {
					// Try to preserve the "from" chain if possible
					setDetailView((currentView) => {
						// If we have a current view and it matches what the "from" should be,
						// we can preserve the chain
						if (currentView?.from) {
							return {
								...parsedView,
								from: currentView.from,
							};
						}
						return { ...parsedView, from: null };
					});
				} else {
					setDetailView(null);
				}
			}
		};

		window.addEventListener('hashchange', handleHashChange);
		return () => window.removeEventListener('hashchange', handleHashChange);
	}, [devices]);

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
			<Box sx={{ p: { xs: 2, sm: 3 } }}>
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
					{/* Skeleton for room cards */}
					{[1, 2, 3].map((index) => (
						<Card
							key={index}
							sx={{
								backgroundColor: '#555',
								borderRadius: 2,
								overflow: 'hidden',
							}}
						>
							<Box sx={{ p: 2 }}>
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
										gap: 2,
									}}
								>
									<CircularProgress
										size={24}
										sx={{ color: 'rgba(0, 0, 0, 0.3)' }}
									/>
									<Box
										sx={{
											flexGrow: 1,
											height: 24,
											bgcolor: 'rgba(0, 0, 0, 0.1)',
											borderRadius: 1,
										}}
									/>
									<Box
										sx={{
											width: 40,
											height: 40,
											bgcolor: 'rgba(0, 0, 0, 0.1)',
											borderRadius: '50%',
										}}
									/>
									<Box
										sx={{
											width: 40,
											height: 40,
											bgcolor: 'rgba(0, 0, 0, 0.1)',
											borderRadius: '50%',
										}}
									/>
								</Box>
							</Box>
						</Card>
					))}
				</Box>
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
	if (detailView && detailView.type === 'group') {
		const groupData = groupDevices.find((g) => g.group.id === detailView.groupId);
		if (groupData) {
			return (
				<GroupDetail
					groupData={groupData}
					onExit={popDetailView}
					clustersName={detailView.clustersName}
					devices={groupData.devices.filter(
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
	if (detailView && detailView.type === 'room-grouped-cluster') {
		const room = roomDevices.find((r) => r.room === detailView.roomName);
		return (
			<RoomGroupedClusterDetail
				roomName={detailView.roomName}
				roomColor={room?.roomColor}
				clusterName={detailView.clusterName}
				devices={detailView.devices}
				onExit={popDetailView}
				invalidate={() => refresh(false)}
				pushDetailView={pushDetailView}
			/>
		);
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
							return (
								<Chip
									key={scene.id}
									icon={<IconComponent iconName={scene.icon} />}
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

				{/* Group Cards */}
				{homePageGroups.map((groupData, index) => {
					return (
						<GroupCard
							groupData={groupData}
							key={groupData.group.id}
							setGroup={() =>
								pushDetailView({
									type: 'group',
									groupId: groupData.group.id,
								})
							}
							pushDetailView={(clusterName) =>
								pushDetailView({
									type: 'group',
									groupId: groupData.group.id,
									clustersName: clusterName,
								})
							}
							invalidate={() => refresh(false)}
							animationIndex={index}
						/>
					);
				})}

				{/* Room Cards */}
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
	// Load all groups
	const [groups, setGroups] = React.useState<DeviceGroup[]>([]);

	React.useEffect(() => {
		const loadGroups = async () => {
			try {
				const response = await apiGet('device', '/groups/list', {});
				if (response.ok) {
					const data = await response.json();
					setGroups(data.groups);
				}
			} catch (error) {
				console.error('Failed to load groups:', error);
			}
		};
		void loadGroups();
	}, []);

	// Calculate valid groups - groups where ALL devices are in this room
	const validGroups = React.useMemo(() => {
		const roomDeviceIds = new Set(props.devices.map((d) => d.uniqueId));
		return groups.filter((group) =>
			group.deviceIds.every((deviceId) => roomDeviceIds.has(deviceId))
		);
	}, [groups, props.devices]);

	// Get device IDs covered by valid groups
	const coveredDeviceIds = React.useMemo(() => {
		return new Set(validGroups.flatMap((g) => g.deviceIds));
	}, [validGroups]);

	// Create entries for each device-cluster combination (excluding covered devices)
	const deviceClusterEntries = React.useMemo(() => {
		const entries = [];
		const switchDevicesProcessed = new Set<string>();

		// Collect all devices with WindowCovering clusters (excluding those in groups)
		const windowCoveringDevices = props.devices.filter(
			(device) =>
				!coveredDeviceIds.has(device.uniqueId) &&
				device.mergedAllClusters.some((c) => c.name === DeviceClusterName.WINDOW_COVERING)
		);

		// If there are multiple WindowCovering devices, group them
		if (windowCoveringDevices.length > 1) {
			// Add a grouped entry for window coverings
			const firstWindowCoveringCluster = windowCoveringDevices[0].mergedAllClusters.find(
				(c) => c.name === DeviceClusterName.WINDOW_COVERING
			);
			if (firstWindowCoveringCluster) {
				entries.push({
					devices: windowCoveringDevices,
					cluster: firstWindowCoveringCluster,
					isGrouped: true,
				});
			}
		}

		for (const device of props.devices) {
			// Skip devices that are covered by valid groups
			if (coveredDeviceIds.has(device.uniqueId)) {
				continue;
			}

			// Group SWITCH clusters by device - only add one entry per device
			const switchClusters = device.mergedAllClusters.filter(
				(c) => c.name === DeviceClusterName.SWITCH
			);

			if (switchClusters.length > 0 && !switchDevicesProcessed.has(device.uniqueId)) {
				// Use the first switch cluster as representative
				entries.push({
					device,
					cluster: switchClusters[0],
				});
				switchDevicesProcessed.add(device.uniqueId);
			}

			// Add all non-SWITCH and non-WINDOW_COVERING clusters normally
			// Skip WINDOW_COVERING if there are multiple (already grouped)
			for (const cluster of device.mergedAllClusters) {
				if (cluster.name !== DeviceClusterName.SWITCH) {
					if (
						cluster.name === DeviceClusterName.WINDOW_COVERING &&
						windowCoveringDevices.length > 1
					) {
						// Skip individual window coverings if grouped
						continue;
					}
					entries.push({
						device,
						cluster,
					});
				}
			}
		}

		// Sort by cluster name first, then by device name
		return entries.sort((a, b) => {
			const clusterCompare = a.cluster.name.localeCompare(b.cluster.name);
			if (clusterCompare !== 0) {
				return clusterCompare;
			}
			if ('devices' in a && 'devices' in b) {
				return 0;
			}
			if ('devices' in a) {
				return -1;
			}
			if ('devices' in b) {
				return 1;
			}
			return a.device.name.localeCompare(b.device.name);
		});
	}, [props.devices, coveredDeviceIds]);

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
						const components = [];

						// Render group cards first
						for (const group of validGroups) {
							const groupDevices = props.devices.filter((device) =>
								group.deviceIds.includes(device.uniqueId)
							);
							components.push(
								<GroupCard
									key={group.id}
									groupData={{ group, devices: groupDevices }}
									setGroup={() =>
										props.pushDetailView({
											type: 'group',
											groupId: group.id,
										})
									}
									pushDetailView={(clusterName) =>
										props.pushDetailView({
											type: 'group',
											groupId: group.id,
											clustersName: clusterName,
										})
									}
									invalidate={props.invalidate}
									animationIndex={animationIndex}
								/>
							);
							animationIndex++;
						}

						// Render device cluster cards for non-grouped devices
						for (const entry of deviceClusterEntries) {
							const currentAnimationIndex = animationIndex;
							let Component;

							if ('isGrouped' in entry && entry.isGrouped && 'devices' in entry) {
								// Render grouped cluster card
								Component = DeviceClusterCard({
									key: `grouped-${entry.cluster.name}`,
									devices: entry.devices,
									cluster: entry.cluster,
									invalidate: props.invalidate,
									pushDetailView: props.pushDetailView,
									animationIndex: currentAnimationIndex,
									roomName: props.room.room,
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
								} as any);
							} else if ('device' in entry) {
								// Render regular device cluster card
								Component = DeviceClusterCard({
									key: `${entry.device?.uniqueId}-${entry.cluster.name}`,
									device: entry.device,
									cluster: entry.cluster,
									invalidate: props.invalidate,
									pushDetailView: props.pushDetailView,
									animationIndex: currentAnimationIndex,
								} as DeviceClusterCardBaseProps<DashboardDeviceClusterWithState>);
							}

							if (Component !== null) {
								components.push(Component);
								animationIndex++;
							}
						}

						return components;
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

interface RoomGroupedClusterDetailProps {
	roomName: string;
	roomColor?: string;
	clusterName: DeviceClusterName;
	devices: DeviceType[];
	onExit: () => void;
	invalidate: () => void;
	pushDetailView: (detailView: HomeDetailView) => void;
}

const RoomGroupedClusterDetail = (props: RoomGroupedClusterDetailProps): JSX.Element => {
	// Get cluster display name
	const getClusterDisplayName = (clusterName: DeviceClusterName): string => {
		switch (clusterName) {
			case DeviceClusterName.WINDOW_COVERING:
				return 'Window Coverings';
			default:
				return clusterName;
		}
	};

	return (
		<Box>
			<Box
				sx={{
					backgroundColor: props.roomColor,
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
						{props.roomName} - {getClusterDisplayName(props.clusterName)}
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
					{props.devices.map((device, index) => {
						// Find the specific cluster for this device
						const cluster = device.mergedAllClusters.find(
							(c) => c.name === props.clusterName
						);
						if (!cluster) {
							return null;
						}

						return DeviceClusterCard({
							key: `${device.uniqueId}-${cluster.name}`,
							device,
							cluster,
							invalidate: props.invalidate,
							pushDetailView: props.pushDetailView,
							animationIndex: index,
						} as DeviceClusterCardBaseProps<DashboardDeviceClusterWithState>);
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
							<IconComponent iconName={props.roomDevices.roomIcon} />
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

interface GroupCardProps {
	groupData: GroupDevices;
	invalidate: () => void;
	setGroup: () => void;
	pushDetailView: (clusterName: DeviceClusterName) => void;
	animationIndex: number;
}

const GroupCard = (props: GroupCardProps) => {
	// Find which clusters are represented in this group
	const representedClusters = new Set<DeviceClusterName>();
	for (const device of props.groupData.devices) {
		for (const cluster of device.mergedAllClusters) {
			representedClusters.add(cluster.name);
		}
	}

	return (
		<Card
			key={props.groupData.group.id}
			sx={{
				...fadeInUpStaggered(props.animationIndex),
				backgroundColor: props.groupData.group.color || '#888',
				borderRadius: 2,
				overflow: 'hidden',
				border: '2px dashed rgba(0, 0, 0, 0.3)',
			}}
		>
			<CardActionArea
				onClick={() => {
					// Wait for animation
					setTimeout(() => {
						props.setGroup();
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
					{/* Group icon */}
					{props.groupData.group.icon && (
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								color: 'rgba(0, 0, 0, 0.6)',
								fontSize: '2rem',
							}}
						>
							<IconComponent iconName={props.groupData.group.icon} />
						</Box>
					)}

					{/* Group name */}
					<Typography
						variant="h6"
						sx={{
							color: '#2f2f2f',
							fontWeight: 500,
							flexGrow: 1,
						}}
					>
						{props.groupData.group.name}
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
									devices={props.groupData.devices}
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

interface GroupDetailProps {
	groupData: GroupDevices;
	onExit: () => void;
	clustersName?: DeviceClusterName;
	devices: DeviceType[];
	invalidate: () => void;
	pushDetailView: (newDetailView: HomeDetailView) => void;
}

const GroupDetail = (props: GroupDetailProps): JSX.Element => {
	// Create entries for each device-cluster combination
	const deviceClusterEntries = React.useMemo(() => {
		const entries: Array<{ device: DeviceType; cluster: DashboardDeviceClusterWithState }> = [];

		for (const device of props.devices) {
			for (const cluster of device.mergedAllClusters) {
				entries.push({ device, cluster });
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
					backgroundColor: props.groupData.group.color,
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
						{props.groupData.group.name}
					</Typography>
				</Box>
			</Box>

			{props.clustersName === DeviceClusterName.COLOR_CONTROL && (
				<ColorControlGroupDetail
					clustersName={props.clustersName}
					pushDetailView={props.pushDetailView}
					groupData={props.groupData}
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

const ColorControlGroupDetail = (props: GroupDetailProps): JSX.Element => {
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
