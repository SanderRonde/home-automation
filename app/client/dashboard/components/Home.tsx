import type {
	DashboardDeviceClusterWithState,
	DashboardDeviceClusterOnOff,
	DashboardDeviceClusterColorControlXY,
	DeviceListWithValuesResponse,
} from '../../../server/modules/device/routing';
import {
	Box,
	Button,
	Card,
	CardActionArea,
	Typography,
	CircularProgress,
	IconButton,
	Chip,
	Fab,
	Portal,
} from '@mui/material';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import {
	Map as MapIcon,
	ViewList as ListIcon,
	PowerSettingsNew as PowerIcon,
} from '@mui/icons-material';
import type { DeviceClusterCardBaseProps } from './DeviceClusterCard';
import type { DeviceGroup } from '../../../../types/group';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { TemperatureDisplay } from './TemperatureDisplay';
import type { Palette } from '../../../../types/palette';
import { fadeInUpStaggered } from '../../lib/animations';
import { DeviceClusterCard } from './DeviceClusterCard';
import { ClusterIconButton } from './ClusterIconButton';
import type { Scene } from '../../../../types/scene';
import { PaletteSelector } from './PaletteSelector';
import { HomeLayoutView } from './HomeLayoutView';
import { apiGet, apiPost } from '../../lib/fetch';
import { EnergyDisplay } from './EnergyDisplay';
import type { IncludedIconNames } from './icon';
import { DeviceDetail } from './DeviceDetail';
import { useDevices } from './Devices';
import { IconComponent } from './icon';
import { Wheel } from '@uiw/react-color';
import React from 'react';

type DeviceType = DeviceListWithValuesResponse[number];

const COLOR_CONTROL_SWATCH_STORAGE_KEY = 'colorControlSavedSwatches';
const DEFAULT_COLOR_SWATCHES = [
	'#ff3b30',
	'#ff9500',
	'#ffcc00',
	'#34c759',
	'#00c7be',
	'#32ade6',
	'#0a84ff',
	'#5856d6',
	'#af52de',
	'#ff2d55',
	'#ffd7a8',
	'#ffffff',
];
const DEFAULT_COLOR_SWATCH_SET = new Set(DEFAULT_COLOR_SWATCHES);

const normalizeHexColor = (color: string): string | null => {
	const trimmed = color.trim().toLowerCase();
	if (!trimmed) {
		return null;
	}
	const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
	let hex = withoutHash;
	if (hex.length === 3) {
		hex = hex
			.split('')
			.map((char) => `${char}${char}`)
			.join('');
	}
	if (!/^[0-9a-f]{6}$/.test(hex)) {
		return null;
	}
	return `#${hex}`;
};

const hexToRgb = (color: string): { r: number; g: number; b: number } | null => {
	const normalized = normalizeHexColor(color);
	if (!normalized) {
		return null;
	}
	const hex = normalized.slice(1);
	return {
		r: parseInt(hex.slice(0, 2), 16),
		g: parseInt(hex.slice(2, 4), 16),
		b: parseInt(hex.slice(4, 6), 16),
	};
};

const hexToHsv = (color: string): { h: number; s: number; v: number } | null => {
	const rgb = hexToRgb(color);
	if (!rgb) {
		return null;
	}
	return rgbToHsv(rgb.r, rgb.g, rgb.b);
};

const rgbToHsv = (
	r: number,
	g: number,
	b: number
): { h: number; s: number; v: number } => {
	const rNorm = r / 255;
	const gNorm = g / 255;
	const bNorm = b / 255;
	const max = Math.max(rNorm, gNorm, bNorm);
	const min = Math.min(rNorm, gNorm, bNorm);
	const delta = max - min;
	let hue = 0;
	if (delta !== 0) {
		switch (max) {
			case rNorm:
				hue = ((gNorm - bNorm) / delta) % 6;
				break;
			case gNorm:
				hue = (bNorm - rNorm) / delta + 2;
				break;
			default:
				hue = (rNorm - gNorm) / delta + 4;
				break;
		}
		hue *= 60;
		if (hue < 0) {
			hue += 360;
		}
	}
	const saturation = max === 0 ? 0 : delta / max;
	return {
		h: Math.round(hue),
		s: Math.round(saturation * 100),
		v: Math.round(max * 100),
	};
};

const hsvToHex = (h: number, s: number, v: number): string => {
	const hNorm = h / 360;
	const sNorm = s / 100;
	const vNorm = v / 100;

	const i = Math.floor(hNorm * 6);
	const f = hNorm * 6 - i;
	const p = vNorm * (1 - sNorm);
	const q = vNorm * (1 - f * sNorm);
	const t = vNorm * (1 - (1 - f) * sNorm);

	let r: number, g: number, b: number;
	switch (i % 6) {
		case 0:
			r = vNorm;
			g = t;
			b = p;
			break;
		case 1:
			r = q;
			g = vNorm;
			b = p;
			break;
		case 2:
			r = p;
			g = vNorm;
			b = t;
			break;
		case 3:
			r = p;
			g = q;
			b = vNorm;
			break;
		case 4:
			r = t;
			g = p;
			b = vNorm;
			break;
		default:
			r = vNorm;
			g = p;
			b = q;
			break;
	}

	const toHex = (n: number) => {
		const hex = Math.round(n * 255).toString(16);
		return hex.length === 1 ? `0${hex}` : hex;
	};

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const getColorSortKey = (color: string) => {
	const rgb = hexToRgb(color);
	if (!rgb) {
		return { h: 0, s: 0, v: 0 };
	}
	return rgbToHsv(rgb.r, rgb.g, rgb.b);
};

const sortColorsByHue = (colors: string[]): string[] => {
	const normalized = colors
		.map((color) => normalizeHexColor(color))
		.filter((color): color is string => !!color);
	const unique = Array.from(new Set(normalized));
	return unique.sort((a, b) => {
		const aKey = getColorSortKey(a);
		const bKey = getColorSortKey(b);
		if (aKey.h !== bKey.h) {
			return aKey.h - bKey.h;
		}
		if (aKey.s !== bKey.s) {
			return bKey.s - aKey.s;
		}
		if (aKey.v !== bKey.v) {
			return bKey.v - aKey.v;
		}
		return a.localeCompare(b);
	});
};

const isColorControlXYCluster = (
	cluster: DashboardDeviceClusterWithState
): cluster is DashboardDeviceClusterColorControlXY =>
	cluster.name === DeviceClusterName.COLOR_CONTROL && 'color' in cluster;

const getInitialColorFromDevices = (
	devices: DeviceType[]
): { hue: number; saturation: number } => {
	for (const device of devices) {
		const cluster = device.mergedAllClusters.find(isColorControlXYCluster);
		if (cluster) {
			return {
				hue: cluster.color.hue,
				saturation: cluster.color.saturation,
			};
		}
	}
	return { hue: 0, saturation: 100 };
};

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
			deviceId: string;
			clusterName: DeviceClusterName;
	  }
	| {
			type: 'room-grouped-cluster';
			roomName: string;
			clusterName: DeviceClusterName;
			deviceIds: string[];
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
					deviceId: device.uniqueId,
					clusterName: cluster.name,
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
					deviceIds: groupedDevices.map((d) => d.uniqueId),
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
		params.set('deviceId', view.deviceId);
		params.set('cluster', view.clusterName);
		return `home?${params.toString()}`;
	} else if (view.type === 'room-grouped-cluster') {
		const params = new URLSearchParams();
		params.set('view', 'room-grouped-cluster');
		params.set('name', view.roomName);
		params.set('cluster', view.clusterName);
		params.set('deviceIds', view.deviceIds.join(','));
		return `home?${params.toString()}`;
	}

	return 'home';
}

interface SceneQuickActionsProps {
	scenes: Scene[];
	triggeringSceneId: string | null;
	onTrigger: (sceneId: string) => void;
	short?: boolean;
	vertical?: boolean;
}

const SceneQuickActions = (props: SceneQuickActionsProps): JSX.Element | null => {
	if (props.scenes.length === 0) {
		return null;
	}

	return (
		<Box
			sx={{
				display: 'flex',
				flexWrap: 'wrap',
				gap: 1.5,
				pointerEvents: 'none',
				flexDirection: props.vertical ? 'column' : 'row',
			}}
		>
			{props.scenes.map((scene) => (
				<Chip
					key={scene.id}
					icon={<IconComponent iconName={scene.icon} />}
					label={props.short ? undefined : scene.title}
					onClick={() => props.onTrigger(scene.id)}
					disabled={props.triggeringSceneId === scene.id}
					sx={{
						height: 48,
						px: 2,
						fontSize: '0.95rem',
						fontWeight: 500,
						backgroundColor: 'background.paper',
						border: '1px solid',
						borderColor: 'divider',
						pointerEvents: 'all',
						'& .MuiChip-icon': {
							fontSize: '1.4rem',
						},
						'& .MuiChip-label': {
							paddingLeft: props.short ? 0 : undefined,
							paddingRight: props.short ? 0 : undefined,
						},
						'&:hover': {
							backgroundColor: 'action.hover',
						},
					}}
				/>
			))}
		</Box>
	);
};

interface HomeProps {
	kiosk?: boolean;
	layoutViewVerticalSpacing: number;
}

export const Home = React.memo((props: HomeProps): React.ReactNode => {
	const { loading, devices, refresh } = useDevices();
	const [scenes, setScenes] = React.useState<Scene[]>([]);
	const [groups, setGroups] = React.useState<DeviceGroup[]>([]);
	const [triggeringSceneId, setTriggeringSceneId] = React.useState<string | null>(null);
	const [viewMode, setViewMode] = React.useState<'list' | 'layout'>(() => {
		if (props.kiosk) {
			return 'layout';
		}
		const saved = localStorage.getItem('homeViewMode');
		return saved === 'layout' || saved === 'list' ? saved : 'list';
	});
	const [hasLayout, setHasLayout] = React.useState(false);
	const [temperatureExpanded, setTemperatureExpanded] = React.useState(!!props.kiosk);
	const [energyExpanded, setEnergyExpanded] = React.useState(false);

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

	// Check if layout exists
	React.useEffect(() => {
		const checkLayout = async () => {
			try {
				const response = await apiGet('device', '/layout', {});
				if (response.ok) {
					const data = await response.json();
					if (data.layout?.walls && data.layout.walls.length > 0) {
						setHasLayout(true);
					}
				}
			} catch (error) {
				console.error('Failed to check layout:', error);
			}
		};
		void checkLayout();
	}, []);

	// Save view mode to localStorage
	React.useEffect(() => {
		localStorage.setItem('homeViewMode', viewMode);
	}, [viewMode]);

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
				devices={devices.filter((d) => detailView.deviceIds.includes(d.uniqueId))}
				onExit={popDetailView}
				invalidate={() => refresh(false)}
				pushDetailView={pushDetailView}
			/>
		);
	}
	if (detailView && detailView.type === 'device') {
		const device = devices.find((d) => d.uniqueId === detailView.deviceId);
		if (!device) {
			return null;
		}
		return (
			<DeviceDetail
				device={device}
				cluster={device.mergedAllClusters.find((c) => c.name === detailView.clusterName)!}
				onExit={popDetailView}
			/>
		);
	}

	// Render layout view if in layout mode
	if (viewMode === 'layout' && hasLayout) {
		return (
			<Box sx={{ position: 'relative', height: '100%' }}>
				{!props.kiosk && scenes.length > 0 && (
					<Box
						sx={{
							position: 'absolute',
							top: { xs: 12, sm: 16 },
							left: 0,
							right: 0,
							display: 'flex',
							justifyContent: 'flex-start',
							pointerEvents: 'none',
							zIndex: 2,
							px: { xs: 2, sm: 3 },
						}}
					>
						<Box
							sx={{
								pointerEvents: 'none',
								borderRadius: 4,
								px: { xs: 1.5, sm: 2 },
								py: { xs: 1, sm: 1.5 },
								maxWidth: { xs: 'calc(100% - 32px)', sm: 640 },
								display: 'inline-block',
							}}
						>
							<SceneQuickActions
								scenes={scenes}
								triggeringSceneId={triggeringSceneId}
								onTrigger={handleTriggerScene}
								short
								vertical
							/>
						</Box>
					</Box>
				)}
				<Box
					sx={{
						position: 'absolute',
						bottom: { xs: 12, sm: 16 },
						left: 0,
						pointerEvents: 'none',
						zIndex: 2,
						px: { xs: 2, sm: 3 },
						gap: 1.5,
						display: 'flex',
						flexDirection: props.kiosk ? 'row' : 'column',
						alignItems: 'flex-start',
						justifyContent: props.kiosk ? 'space-between' : 'flex-start',
						width: props.kiosk ? '100%' : 'auto',
					}}
				>
					<TemperatureDisplay
						expanded={temperatureExpanded}
						onExpandedChange={(expanded) => {
							setTemperatureExpanded(expanded);
							setEnergyExpanded(false);
						}}
						kiosk={props.kiosk}
					/>
					<EnergyDisplay
						expanded={energyExpanded}
						onExpandedChange={(expanded) => {
							setEnergyExpanded(expanded);
							setTemperatureExpanded(false);
						}}
					/>
				</Box>
				<HomeLayoutView
					devices={devices}
					pushDetailView={pushDetailView}
					invalidate={() => refresh(false)}
					temperatureExpanded={temperatureExpanded}
					energyExpanded={energyExpanded}
					kiosk={!!props.kiosk}
					verticalSpacing={props.layoutViewVerticalSpacing}
				/>
				{/* Floating Action Button to toggle back to list view */}
				{!props.kiosk && (
					<Portal>
						<Fab
							color="primary"
							aria-label="toggle view"
							sx={{
								position: 'fixed',
								bottom: 24,
								right: 24,
								zIndex: 1000,
							}}
							onClick={() => setViewMode('list')}
						>
							<ListIcon />
						</Fab>
					</Portal>
				)}
			</Box>
		);
	}

	// Render list view (default)
	return (
		<Box sx={{ p: { xs: 2, sm: 3 }, position: 'relative' }}>
			<Box
				sx={{
					display: 'flex',
					flexDirection: 'column',
					gap: 2,
				}}
			>
				{/* Scene Triggers */}
				<SceneQuickActions
					scenes={scenes}
					triggeringSceneId={triggeringSceneId}
					onTrigger={handleTriggerScene}
				/>

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

			{/* Floating Action Button to toggle to layout view */}
			{hasLayout && (
				<Portal>
					<Fab
						color="primary"
						aria-label="toggle view"
						sx={{
							position: 'fixed',
							bottom: 24,
							right: 24,
							zIndex: 1000,
						}}
						onClick={() => setViewMode('layout')}
					>
						<MapIcon />
					</Fab>
				</Portal>
			)}
		</Box>
	);
});

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

		// Add offline devices with no clusters as a fallback
		for (const device of props.devices) {
			if (
				device.status === 'offline' &&
				device.mergedAllClusters.length === 0 &&
				!coveredDeviceIds.has(device.uniqueId)
			) {
				// Create a minimal cluster entry for offline devices with no clusters
				entries.push({
					device,
					cluster: {
						name: DeviceClusterName.ON_OFF,
						icon: 'CloudOff' as IncludedIconNames,
						isOn: false,
					} as DashboardDeviceClusterOnOff,
				});
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

interface ColorControlSharedDetailProps {
	devices: DeviceType[];
	invalidate: () => void;
}

const ColorControlSharedDetail = (props: ColorControlSharedDetailProps): JSX.Element => {
	const colorControlEntries = React.useMemo(
		() =>
			props.devices
				.map((device) => {
					const cluster = device.mergedAllClusters.find(isColorControlXYCluster);
					if (!cluster) {
						return null;
					}
					return { device, cluster };
				})
				.filter(
					(entry): entry is { device: DeviceType; cluster: DashboardDeviceClusterColorControlXY } =>
						entry !== null
				),
		[props.devices]
	);
	const colorControlDeviceIds = React.useMemo(
		() => colorControlEntries.map((entry) => entry.device.uniqueId),
		[colorControlEntries]
	);
	const onOffEntries = React.useMemo(
		() =>
			colorControlEntries
				.map((entry) => {
					const onOffCluster = entry.cluster.mergedClusters[DeviceClusterName.ON_OFF];
					if (!onOffCluster) {
						return null;
					}
					return {
						deviceId: entry.device.uniqueId,
						isOn: onOffCluster.isOn,
					};
				})
				.filter(
					(entry): entry is { deviceId: string; isOn: boolean } => entry !== null
				),
		[colorControlEntries]
	);
	const onOffState = React.useMemo(() => {
		if (onOffEntries.length === 0) {
			return 'unavailable';
		}
		const onCount = onOffEntries.filter((entry) => entry.isOn).length;
		if (onCount === 0) {
			return 'all-off';
		}
		if (onCount === onOffEntries.length) {
			return 'all-on';
		}
		return 'mixed';
	}, [onOffEntries]);

	const [palettes, setPalettes] = React.useState<Palette[]>([]);
	const [applyingPalette, setApplyingPalette] = React.useState<string | null>(null);
	const [savedSwatches, setSavedSwatches] = React.useState<string[]>([]);
	const [isTogglingAll, setIsTogglingAll] = React.useState(false);
	const [isUpdatingColor, setIsUpdatingColor] = React.useState(false);
	const initialColor = getInitialColorFromDevices(props.devices);
	const [hue, setHue] = React.useState(initialColor.hue);
	const [saturation, setSaturation] = React.useState(initialColor.saturation);
	const colorCommitTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

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

	React.useEffect(() => {
		if (typeof localStorage === 'undefined') {
			return;
		}
		const stored = localStorage.getItem(COLOR_CONTROL_SWATCH_STORAGE_KEY);
		if (!stored) {
			return;
		}
		try {
			const parsed = JSON.parse(stored);
			if (Array.isArray(parsed)) {
				const normalized = sortColorsByHue(
					parsed.filter((color) => typeof color === 'string')
				).filter((color) => !DEFAULT_COLOR_SWATCH_SET.has(color));
				setSavedSwatches(normalized);
			}
		} catch (error) {
			console.error('Failed to load saved colors:', error);
		}
	}, []);

	React.useEffect(() => {
		return () => {
			if (colorCommitTimeoutRef.current) {
				clearTimeout(colorCommitTimeoutRef.current);
			}
		};
	}, []);

	const rememberColor = React.useCallback((color: string) => {
		const normalized = normalizeHexColor(color);
		if (!normalized || DEFAULT_COLOR_SWATCH_SET.has(normalized)) {
			return;
		}
		setSavedSwatches((prev) => {
			if (prev.includes(normalized)) {
				return prev;
			}
			const next = sortColorsByHue([...prev, normalized]);
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(COLOR_CONTROL_SWATCH_STORAGE_KEY, JSON.stringify(next));
			}
			return next;
		});
	}, []);

	const swatchColors = React.useMemo(
		() => sortColorsByHue([...DEFAULT_COLOR_SWATCHES, ...savedSwatches]),
		[savedSwatches]
	);
	const currentColor = React.useMemo(() => hsvToHex(hue, saturation, 100), [hue, saturation]);

	const handleApplyPalette = async (paletteId: string) => {
		if (colorControlDeviceIds.length === 0) {
			return;
		}
		setApplyingPalette(paletteId);
		try {
			const response = await apiPost(
				'device',
				'/palettes/:paletteId/apply',
				{ paletteId },
				{ deviceIds: colorControlDeviceIds }
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

	const handleToggleAll = async () => {
		if (onOffEntries.length === 0) {
			return;
		}
		const targetIsOn = onOffState !== 'all-on';
		setIsTogglingAll(true);
		try {
			const response = await apiPost(
				'device',
				'/cluster/OnOff',
				{},
				{
					deviceIds: onOffEntries.map((entry) => entry.deviceId),
					isOn: targetIsOn,
				}
			);
			if (response.ok) {
				props.invalidate();
			}
		} catch (error) {
			console.error('Failed to toggle devices:', error);
		} finally {
			setIsTogglingAll(false);
		}
	};

	const handleApplyColor = React.useCallback(
		async (nextHue: number, nextSaturation: number) => {
			if (colorControlDeviceIds.length === 0) {
				return;
			}
			setIsUpdatingColor(true);
			try {
				const response = await apiPost(
					'device',
					`/cluster/${DeviceClusterName.COLOR_CONTROL}`,
					{},
					{
						deviceIds: colorControlDeviceIds,
						hue: nextHue,
						saturation: nextSaturation,
						value: 100,
					}
				);
				if (response.ok) {
					rememberColor(hsvToHex(nextHue, nextSaturation, 100));
					props.invalidate();
				}
			} catch (error) {
				console.error('Failed to set color:', error);
			} finally {
				setIsUpdatingColor(false);
			}
		},
		[colorControlDeviceIds, props.invalidate, rememberColor]
	);

	const handleColorChange = (newColor: { h: number; s: number; v: number }) => {
		setHue(newColor.h);
		setSaturation(newColor.s);
		if (colorCommitTimeoutRef.current) {
			clearTimeout(colorCommitTimeoutRef.current);
		}
		colorCommitTimeoutRef.current = setTimeout(() => {
			void handleApplyColor(newColor.h, newColor.s);
		}, 150);
	};

	const handleSwatchSelect = async (colorHex: string) => {
		const hsv = hexToHsv(colorHex);
		if (!hsv) {
			return;
		}
		if (colorCommitTimeoutRef.current) {
			clearTimeout(colorCommitTimeoutRef.current);
			colorCommitTimeoutRef.current = null;
		}
		setHue(hsv.h);
		setSaturation(hsv.s);
		await handleApplyColor(hsv.h, hsv.s);
	};

	const onOffLabel =
		onOffState === 'all-on' ? 'On' : onOffState === 'all-off' ? 'Off' : 'Mixed';
	const onOffChipColor =
		onOffState === 'all-on'
			? 'success'
			: onOffState === 'all-off'
				? 'default'
				: 'warning';
	const powerActionLabel = onOffState === 'all-on' ? 'Turn Off All' : 'Turn On All';
	const isPowerControlAvailable = onOffState !== 'unavailable';

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
			{isPowerControlAvailable && (
				<Box sx={{ mb: 3 }}>
					<Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
						Power
					</Typography>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
						<Button
							variant="contained"
							startIcon={<PowerIcon />}
							onClick={() => void handleToggleAll()}
							disabled={isTogglingAll}
						>
							{powerActionLabel}
						</Button>
						<Chip
							label={onOffLabel}
							color={onOffChipColor}
							variant="outlined"
							sx={{ fontWeight: 600 }}
						/>
					</Box>
				</Box>
			)}

			<Box sx={{ mb: 3 }}>
				<Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
					Pick a Color
				</Typography>
				<Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
					<Box
						sx={{
							borderRadius: '50%',
							p: 1.5,
							background: 'rgba(0,0,0,0.04)',
							boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
						}}
					>
						<Wheel
							color={{ h: hue, s: saturation, v: 100, a: 1 }}
							onChange={(color) =>
								handleColorChange({
									h: color.hsv.h,
									s: color.hsv.s,
									v: color.hsv.v,
								})
							}
							width={200}
							height={200}
						/>
					</Box>
					<Box
						sx={{
							display: 'flex',
							flexWrap: 'wrap',
							gap: 1,
							maxWidth: 320,
						}}
					>
						{swatchColors.map((color) => {
							const normalized = normalizeHexColor(color) ?? color;
							const isSelected =
								normalizeHexColor(currentColor) === normalized;
							return (
								<IconButton
									key={color}
									aria-label={`Select color ${color}`}
									onClick={() => void handleSwatchSelect(color)}
									disabled={isUpdatingColor}
									sx={{
										width: 36,
										height: 36,
										borderRadius: '50%',
										backgroundColor: color,
										border: '2px solid',
										borderColor: isSelected ? 'primary.main' : 'divider',
										boxShadow: isSelected ? '0 0 0 2px rgba(0,0,0,0.1)' : 'none',
										'&:hover': {
											backgroundColor: color,
										},
									}}
								/>
							);
						})}
					</Box>
				</Box>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
					<Box
						sx={{
							width: 16,
							height: 16,
							borderRadius: '50%',
							backgroundColor: currentColor,
							border: '1px solid',
							borderColor: 'divider',
						}}
					/>
					<Typography
						variant="caption"
						sx={{
							fontWeight: 600,
							letterSpacing: '0.06em',
						}}
					>
						{currentColor.toUpperCase()}
					</Typography>
					{isUpdatingColor && <CircularProgress size={14} />}
				</Box>
			</Box>

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

const ColorControlRoomDetail = (props: RoomDetailProps): JSX.Element => {
	return <ColorControlSharedDetail devices={props.devices} invalidate={props.invalidate} />;
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
	return <ColorControlSharedDetail devices={props.devices} invalidate={props.invalidate} />;
};
