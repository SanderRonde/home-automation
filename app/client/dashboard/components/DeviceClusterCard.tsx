import type {
	DashboardDeviceClusterOnOff,
	DashboardDeviceClusterWindowCovering,
	DashboardDeviceClusterWithState,
	DashboardDeviceClusterOccupancySensing,
	DashboardDeviceClusterTemperatureMeasurement,
	DashboardDeviceClusterRelativeHumidityMeasurement,
	DashboardDeviceClusterIlluminanceMeasurement,
	DashboardDeviceClusterBooleanState,
	DashboardDeviceClusterColorControlXY,
	DashboardDeviceClusterActions,
	DashboardDeviceClusterOccupancySensorGroup,
	DashboardDeviceClusterThermostat,
	DashboardDeviceClusterSwitch,
	DashboardDeviceClusterDoorLock,
	DashboardDeviceClusterAirQualityGroup,
	DashboardDeviceClusterFridge,
	DashboardDeviceClusterWasher,
	DeviceListWithValuesResponse,
} from '../../../server/modules/device/routing';
import {
	MyLocation as MyLocationIcon,
	Thermostat as ThermostatIcon,
	PowerSettingsNew as PowerIcon,
	CloudOff as CloudOffIcon,
	Refresh as RefreshIcon,
	Kitchen as KitchenIcon,
	LocalLaundryService as LocalLaundryServiceIcon,
} from '@mui/icons-material';
import {
	Card,
	CardActionArea,
	Box,
	Typography,
	IconButton,
	Chip,
	CircularProgress,
} from '@mui/material';
import { DeviceClusterName, ThermostatMode } from '../../../server/modules/device/cluster';
import { fadeInUpStaggered, staggerItem } from '../../lib/animations';
import type { IncludedIconNames } from './icon';
import type { HomeDetailView } from './Home';
import { apiPost } from '../../lib/fetch';
import { motion } from 'framer-motion';
import { IconComponent } from './icon';
import React from 'react';

const IconOrNull = ({ icon }: { icon: IncludedIconNames | undefined }) => {
	return icon ? <IconComponent iconName={icon} /> : null;
};

const getTimeSince = (timestamp?: number): string => {
	if (!timestamp) {
		return 'Never';
	}
	const now = Date.now();
	const diff = now - timestamp;
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) {
		return `${days}d ago`;
	}
	if (hours > 0) {
		return `${hours}h ago`;
	}
	if (minutes > 0) {
		return `${minutes}m ago`;
	}
	return `${seconds}s ago`;
};

export interface DeviceClusterCardBaseProps<C extends DashboardDeviceClusterWithState> {
	device: DeviceListWithValuesResponse[number];
	cluster: C;
	invalidate: () => void;
	pushDetailView: (detailView: HomeDetailView) => void;
	animationIndex: number;
}

interface DeviceClusterCardProps
	extends DeviceClusterCardBaseProps<DashboardDeviceClusterWithState> {
	onPress?: () => void;
	cardBackground?: string;
	cardRef?: React.RefObject<HTMLDivElement>;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
	children?: React.ReactNode;
	hasInteractiveChildren?: boolean;
}

const DeviceClusterCardSkeleton = (props: DeviceClusterCardProps) => {
	const isOffline = props.device.status === 'offline';
	const [isReconnecting, setIsReconnecting] = React.useState(false);

	const handleReconnect = async () => {
		if (isReconnecting) {
			return;
		}
		setIsReconnecting(true);
		try {
			await apiPost('device', '/reconnect/:deviceId', { deviceId: props.device.uniqueId });
			props.invalidate();
		} finally {
			setIsReconnecting(false);
		}
	};

	const cardContent =
		!props.children || isOffline ? (
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: 'rgba(0, 0, 0, 0.08)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						fontSize: '1.5rem',
						color: 'text.secondary',
						opacity: isOffline ? 0.5 : 1,
					}}
				>
					<IconOrNull icon={isOffline ? 'CloudOff' : props.cluster.icon} />
				</Box>
				<Typography
					variant="body1"
					sx={{
						fontWeight: 500,
						flexGrow: 1,
						opacity: isOffline ? 0.6 : 1,
					}}
				>
					{props.device.name}
				</Typography>
				{isOffline && (
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 1,
						}}
					>
						<Chip
							icon={<CloudOffIcon />}
							label="Offline"
							size="small"
							sx={{
								opacity: 0.8,
								'& .MuiChip-icon': {
									fontSize: '1rem',
								},
							}}
						/>
						<IconButton
							onClick={(e) => {
								e.stopPropagation();
								void handleReconnect();
							}}
							size="small"
							disabled={isReconnecting}
							sx={{
								color: 'text.secondary',
								'&:hover': {
									backgroundColor: 'rgba(0, 0, 0, 0.08)',
								},
							}}
						>
							{isReconnecting ? (
								<CircularProgress size={20} thickness={4} />
							) : (
								<RefreshIcon fontSize="small" />
							)}
						</IconButton>
					</Box>
				)}
			</Box>
		) : (
			props.children
		);

	const isDraggable = !!props.onPointerMove;
	const hasInteractiveChildren = props.hasInteractiveChildren ?? false;
	const useCardActionArea = !isDraggable && !hasInteractiveChildren && !isOffline;

	return (
		<motion.div
			variants={staggerItem}
			initial="initial"
			animate="animate"
			style={{ position: 'relative' }}
		>
			<Card
				ref={props.cardRef}
				sx={{
					...fadeInUpStaggered(props.animationIndex),
					borderRadius: 3,
					overflow: 'hidden',
					background: props.cardBackground,
					touchAction: isDraggable ? 'none' : undefined,
					userSelect: isDraggable ? 'none' : undefined,
					boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
					transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
					opacity: isOffline ? 0.7 : 1,
					'&:hover': {
						boxShadow: isDraggable
							? '0 2px 8px rgba(0,0,0,0.08)'
							: '0 8px 24px rgba(0,0,0,0.15)',
					},
				}}
				onClick={isDraggable ? undefined : props.onPress}
				onPointerDown={props.onPointerDown}
				onPointerMove={props.onPointerMove}
				onPointerUp={props.onPointerUp}
			>
				{useCardActionArea ? (
					<CardActionArea
						sx={{
							p: 2,
							pointerEvents: isOffline ? 'none' : 'auto',
							'& button': {
								pointerEvents: 'auto',
							},
						}}
					>
						{cardContent}
					</CardActionArea>
				) : (
					<Box
						sx={{
							p: 2,
							cursor: props.onPress && !isOffline ? 'pointer' : undefined,
							pointerEvents: isOffline ? 'none' : 'auto',
							'& button': {
								pointerEvents: 'auto',
							},
						}}
					>
						{cardContent}
					</Box>
				)}
			</Card>
		</motion.div>
	);
};

const WindowCoveringCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterWindowCovering>
): JSX.Element => {
	const [dragPosition, setDragPosition] = React.useState<number | null>(null);
	const [isDragging, setIsDragging] = React.useState(false);
	const [hasMoved, setHasMoved] = React.useState(false);
	const cardRef = React.useRef<HTMLDivElement>(null);
	const dragStartX = React.useRef<number>(0);
	const dragStartPosition = React.useRef<number>(0);

	const currentPosition =
		dragPosition !== null ? dragPosition : props.cluster.targetPositionLiftPercentage;

	const handlePointerDown = (e: React.PointerEvent) => {
		setIsDragging(true);
		setHasMoved(false);
		e.currentTarget.setPointerCapture(e.pointerId);
		dragStartX.current = e.clientX;
		dragStartPosition.current = props.cluster.targetPositionLiftPercentage;
	};

	const handlePointerMove = (e: React.PointerEvent) => {
		if (!isDragging || !cardRef.current) {
			return;
		}

		const deltaX = Math.abs(e.clientX - dragStartX.current);
		// Only consider it a drag if moved more than 5 pixels
		if (deltaX > 5) {
			setHasMoved(true);
		}

		const rect = cardRef.current.getBoundingClientRect();
		const fullDeltaX = e.clientX - dragStartX.current;
		const deltaPercentage = (fullDeltaX / rect.width) * 100 * 2; // 2x sensitivity
		const newPosition = dragStartPosition.current + deltaPercentage;
		const clampedPosition = Math.max(0, Math.min(100, newPosition));
		setDragPosition(Math.round(clampedPosition));
	};

	const handlePointerUp = async (e: React.PointerEvent) => {
		if (!isDragging) {
			return;
		}
		setIsDragging(false);
		e.currentTarget.releasePointerCapture(e.pointerId);

		// If user didn't drag, open detail view
		if (!hasMoved) {
			props.pushDetailView({
				type: 'device',
				deviceId: props.device.uniqueId,
				clusterName: props.cluster.name,
			});
			return;
		}

		// Otherwise, update the position
		if (dragPosition !== null) {
			await apiPost(
				'device',
				'/cluster/WindowCovering',
				{},
				{
					deviceIds: [props.device.uniqueId],
					targetPositionLiftPercentage: dragPosition,
				}
			);
			setDragPosition(null);
			props.invalidate();
		}
	};

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardRef={cardRef}
			cardBackground={`linear-gradient(to right, #0053a6 ${currentPosition}%, #3f3f3f ${currentPosition}%)`}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
		/>
	);
};

interface GroupedWindowCoveringCardProps {
	devices: DeviceListWithValuesResponse;
	cluster: DashboardDeviceClusterWindowCovering;
	invalidate: () => void;
	pushDetailView: (detailView: HomeDetailView) => void;
	animationIndex: number;
	roomName: string;
}

const GroupedWindowCoveringCard = (props: GroupedWindowCoveringCardProps): JSX.Element => {
	const [dragPosition, setDragPosition] = React.useState<number | null>(null);
	const [isDragging, setIsDragging] = React.useState(false);
	const [hasMoved, setHasMoved] = React.useState(false);
	const cardRef = React.useRef<HTMLDivElement>(null);
	const dragStartX = React.useRef<number>(0);
	const dragStartPosition = React.useRef<number>(0);

	// Calculate average position across all window coverings
	const averagePosition = React.useMemo(() => {
		const positions = props.devices
			.flatMap((device) => device.mergedAllClusters)
			.filter(
				(cluster): cluster is DashboardDeviceClusterWindowCovering =>
					cluster.name === DeviceClusterName.WINDOW_COVERING
			)
			.map((cluster) => cluster.targetPositionLiftPercentage);

		if (positions.length === 0) {
			return 0;
		}

		const sum = positions.reduce((acc, pos) => acc + pos, 0);
		return Math.round(sum / positions.length);
	}, [props.devices]);

	const currentPosition = dragPosition !== null ? dragPosition : averagePosition;

	const handlePointerDown = (e: React.PointerEvent) => {
		setIsDragging(true);
		setHasMoved(false);
		e.currentTarget.setPointerCapture(e.pointerId);
		dragStartX.current = e.clientX;
		dragStartPosition.current = averagePosition;
	};

	const handlePointerMove = (e: React.PointerEvent) => {
		if (!isDragging || !cardRef.current) {
			return;
		}

		const deltaX = Math.abs(e.clientX - dragStartX.current);
		// Only consider it a drag if moved more than 5 pixels
		if (deltaX > 5) {
			setHasMoved(true);
		}

		const rect = cardRef.current.getBoundingClientRect();
		const fullDeltaX = e.clientX - dragStartX.current;
		const deltaPercentage = (fullDeltaX / rect.width) * 100 * 2; // 2x sensitivity
		const newPosition = dragStartPosition.current + deltaPercentage;
		const clampedPosition = Math.max(0, Math.min(100, newPosition));
		setDragPosition(Math.round(clampedPosition));
	};

	const handlePointerUp = async (e: React.PointerEvent) => {
		if (!isDragging) {
			return;
		}
		setIsDragging(false);
		e.currentTarget.releasePointerCapture(e.pointerId);

		// If user didn't drag, open grouped detail view
		if (!hasMoved) {
			props.pushDetailView({
				type: 'room-grouped-cluster',
				roomName: props.roomName,
				clusterName: DeviceClusterName.WINDOW_COVERING,
				deviceIds: props.devices.map((device) => device.uniqueId),
			});
			return;
		}

		// Otherwise, update the position for all devices
		if (dragPosition !== null) {
			const deviceIds = props.devices.map((device) => device.uniqueId);
			await apiPost(
				'device',
				'/cluster/WindowCovering',
				{},
				{
					deviceIds,
					targetPositionLiftPercentage: dragPosition,
				}
			);
			setDragPosition(null);
			props.invalidate();
		}
	};

	// Create a pseudo-device for the skeleton
	const pseudoDevice = {
		...props.devices[0],
		name: `Window Coverings (${props.devices.length})`,
	};

	return (
		<DeviceClusterCardSkeleton
			device={pseudoDevice}
			cluster={props.cluster}
			invalidate={props.invalidate}
			pushDetailView={props.pushDetailView}
			animationIndex={props.animationIndex}
			cardRef={cardRef}
			cardBackground={`linear-gradient(to right, #0053a6 ${currentPosition}%, #3f3f3f ${currentPosition}%)`}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
		/>
	);
};

// Convert Kelvin color temperature to RGB using a more accurate algorithm
// Based on the Planckian locus approximation
const kelvinToRgb = (kelvin: number): { r: number; g: number; b: number } => {
	// Clamp to typical range
	const temp = Math.max(2000, Math.min(6500, kelvin));
	const temp100 = temp / 100;

	let r: number;
	let g: number;
	let b: number;

	// Red channel
	if (temp <= 6600) {
		r = 255;
	} else {
		r = temp100 - 60;
		r = 329.698727446 * Math.pow(r, -0.1332047592);
		r = Math.max(0, Math.min(255, r));
	}

	// Green channel
	if (temp <= 6600) {
		g = temp100 - 2;
		g = 99.4708025861 * Math.log(g) - 161.1195681661;
		g = Math.max(0, Math.min(255, g));
	} else {
		g = temp100 - 60;
		g = 288.1221695283 * Math.pow(g, -0.0755148492);
		g = Math.max(0, Math.min(255, g));
	}

	// Blue channel
	if (temp >= 6600) {
		b = 255;
	} else if (temp <= 2000) {
		b = 0;
	} else {
		b = temp100 - 10;
		b = 138.5177312231 * Math.log(b) - 305.0447927307;
		b = Math.max(0, Math.min(255, b));
	}

	return {
		r: Math.round(r),
		g: Math.round(g),
		b: Math.round(b),
	};
};

const OnOffCard = (props: DeviceClusterCardBaseProps<DashboardDeviceClusterOnOff>): JSX.Element => {
	const energyCluster =
		props.cluster.mergedClusters?.[DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT];
	const powerCluster =
		props.cluster.mergedClusters?.[DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT];
	const colorControlCluster = props.cluster.mergedClusters?.[DeviceClusterName.COLOR_CONTROL];
	const levelControlCluster = props.cluster.mergedClusters?.[DeviceClusterName.LEVEL_CONTROL];

	const currentLevel = levelControlCluster?.currentLevel ?? 1;

	// Color-code based on color temperature, level control, or power usage
	const getBackgroundColor = (): string => {
		if (!props.cluster.isOn) {
			return '#422d00';
		}

		// Check if color control with temperature is available
		if (
			colorControlCluster &&
			'colorTemperature' in colorControlCluster &&
			colorControlCluster.colorTemperature
		) {
			const { r, g, b } = kelvinToRgb(colorControlCluster.colorTemperature);
			// Apply opacity based on level control if available
			const opacity = levelControlCluster
				? 0.3 + currentLevel * 0.7 // Map 0-100 to 0.3-1.0
				: 1.0;
			return `rgba(${r}, ${g}, ${b}, ${opacity})`;
		}

		// If level control exists but no color temperature, use opacity on default color
		if (levelControlCluster) {
			const opacity = 0.3 + currentLevel * 0.7;
			return `rgba(151, 108, 0, ${opacity})`; // Gold color with opacity
		}

		return '#976c00';
	};

	const formatPower = (watts: number): string => {
		if (watts >= 1000) {
			return `${(watts / 1000).toFixed(1)} kW`;
		}
		return `${watts} W`;
	};

	const cardBackground = getBackgroundColor();
	const hasDetailPage =
		energyCluster || powerCluster || colorControlCluster || levelControlCluster;

	const onOffElement = hasDetailPage ? (
		<IconButton
			onClick={async (e) => {
				e.stopPropagation();
				await apiPost(
					'device',
					'/cluster/OnOff',
					{},
					{
						deviceIds: [props.device.uniqueId],
						isOn: !props.cluster.isOn,
					}
				);
			}}
			size="small"
			sx={{
				color: 'white',
				opacity: props.cluster.isOn ? 1 : 0.5,
				'&:hover': {
					backgroundColor: 'rgba(0, 0, 0, 0.12)',
				},
			}}
		>
			<PowerIcon fontSize="small" />
		</IconButton>
	) : null;

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={cardBackground}
			hasInteractiveChildren={!!onOffElement}
			onPress={async () => {
				if (hasDetailPage) {
					props.pushDetailView({
						type: 'device',
						deviceId: props.device.uniqueId,
						clusterName: props.cluster.name,
					});
				} else {
					await apiPost(
						'device',
						'/cluster/OnOff',
						{},
						{
							deviceIds: [props.device.uniqueId],
							isOn: !props.cluster.isOn,
						}
					);
				}
			}}
		>
			{energyCluster ? (
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: 2,
					}}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							background: 'rgba(0, 0, 0, 0.08)',
							borderRadius: '50%',
							width: 48,
							height: 48,
							fontSize: '1.5rem',
							color: 'text.secondary',
						}}
					>
						<IconOrNull icon={props.cluster.icon} />
					</Box>
					<Box sx={{ flexGrow: 1 }}>
						<Typography
							variant="body1"
							sx={{
								fontWeight: 500,
							}}
						>
							{props.device.name}
						</Typography>
						<Typography
							variant="caption"
							sx={{
								color: 'rgba(255, 255, 255, 0.7)',
							}}
						>
							Total: {energyCluster.totalEnergy} kWh
						</Typography>
					</Box>
					<Box
						sx={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'flex-end',
						}}
					>
						<Typography
							variant="h5"
							sx={{
								fontWeight: 'bold',
								color: 'white',
							}}
						>
							{formatPower(powerCluster?.activePower ?? 0)}
						</Typography>
					</Box>
					{onOffElement}
				</Box>
			) : (
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: 2,
					}}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							background: 'rgba(0, 0, 0, 0.08)',
							borderRadius: '50%',
							width: 48,
							height: 48,
							fontSize: '1.5rem',
							color: 'text.secondary',
						}}
					>
						<IconOrNull icon={props.cluster.icon} />
					</Box>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
							flexGrow: 1,
						}}
					>
						{props.device.name}
					</Typography>
					{onOffElement}
				</Box>
			)}
		</DeviceClusterCardSkeleton>
	);
};

const OccupancySensingCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterOccupancySensing>
): JSX.Element => {
	const getTimeSince = (timestamp?: number): string => {
		if (!timestamp) {
			return 'Never';
		}
		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `${days}d ago`;
		}
		if (hours > 0) {
			return `${hours}h ago`;
		}
		if (minutes > 0) {
			return `${minutes}m ago`;
		}
		return `${seconds}s ago`;
	};

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={props.cluster.occupied ? '#1a472a' : '#2f2f2f'}
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: props.cluster.occupied
							? 'rgba(76, 175, 80, 0.2)'
							: 'rgba(0, 0, 0, 0.08)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						fontSize: '1.5rem',
						color: props.cluster.occupied ? '#4caf50' : 'text.secondary',
					}}
				>
					<IconOrNull icon={props.cluster.icon} />
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
						}}
					>
						{props.device.name}
					</Typography>
					<Typography
						variant="caption"
						sx={{
							color: 'text.secondary',
						}}
					>
						Last triggered: {getTimeSince(props.cluster.lastTriggered)}
					</Typography>
				</Box>
				{props.cluster.occupied && (
					<Box
						sx={{
							width: 12,
							height: 12,
							borderRadius: '50%',
							backgroundColor: '#4caf50',
							animation: 'pulse 2s infinite',
							'@keyframes pulse': {
								'0%, 100%': {
									opacity: 1,
								},
								'50%': {
									opacity: 0.5,
								},
							},
						}}
					/>
				)}
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

const SwitchCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterSwitch>
): JSX.Element => {
	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground="#2f2f2f"
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: 'rgba(0, 0, 0, 0.08)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						fontSize: '1.5rem',
						color: 'text.secondary',
					}}
				>
					<IconOrNull icon={props.cluster.icon} />
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
						}}
					>
						{props.device.name}
					</Typography>
					<Typography
						variant="caption"
						sx={{
							color: 'text.secondary',
						}}
					>
						Tap to view all button press history
					</Typography>
				</Box>
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

const LOCK_STATE_LABELS: Record<number, string> = {
	0: 'Not fully locked',
	1: 'Locked',
	2: 'Unlocked',
	3: 'Unlatched',
};

const DoorLockCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterDoorLock>
): JSX.Element => {
	const stateLabel = LOCK_STATE_LABELS[props.cluster.lockState] ?? 'Unknown';
	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground="#2f2f2f"
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: 'rgba(0, 0, 0, 0.08)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						fontSize: '1.5rem',
						color: 'text.secondary',
					}}
				>
					<IconOrNull icon={props.cluster.icon} />
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
						}}
					>
						{props.device.name}
					</Typography>
					<Typography
						variant="caption"
						sx={{
							color: 'text.secondary',
						}}
					>
						{stateLabel}
					</Typography>
				</Box>
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

const TemperatureMeasurementCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterTemperatureMeasurement>
): JSX.Element => {
	// Color-code based on temperature
	const getTemperatureColor = (temp: number): string => {
		if (temp < 10) {
			return '#1e3a8a'; // Deep blue (cold)
		}
		if (temp < 18) {
			return '#3b82f6'; // Blue (cool)
		}
		if (temp < 22) {
			return '#10b981'; // Green (comfortable)
		}
		if (temp < 26) {
			return '#f59e0b'; // Orange (warm)
		}
		return '#dc2626'; // Red (hot)
	};

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={getTemperatureColor(props.cluster.temperature)}
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: 'rgba(255, 255, 255, 0.2)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						fontSize: '1.5rem',
						color: 'white',
					}}
				>
					<IconOrNull icon={props.cluster.icon} />
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
							color: 'white',
						}}
					>
						{props.device.name}
					</Typography>
					<Typography
						variant="h6"
						sx={{
							color: 'white',
							fontWeight: 'bold',
						}}
					>
						{props.cluster.temperature.toFixed(1)}°C
					</Typography>
				</Box>
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

const RelativeHumidityMeasurementCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterRelativeHumidityMeasurement>
): JSX.Element => {
	// Color-code based on humidity (0-1 to percentage)
	const getHumidityColor = (humidity: number): string => {
		const percent = humidity * 100;
		if (percent < 30) {
			return '#fbbf24'; // Yellow (dry)
		}
		if (percent < 60) {
			return '#10b981'; // Green (comfortable)
		}
		return '#3b82f6'; // Blue (humid)
	};

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={getHumidityColor(props.cluster.humidity)}
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: 'rgba(255, 255, 255, 0.2)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						fontSize: '1.5rem',
						color: 'white',
					}}
				>
					<IconOrNull icon={props.cluster.icon} />
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
							color: 'white',
						}}
					>
						{props.device.name}
					</Typography>
					<Typography
						variant="h6"
						sx={{
							color: 'white',
							fontWeight: 'bold',
						}}
					>
						{(props.cluster.humidity * 100).toFixed(0)}%
					</Typography>
				</Box>
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

const IlluminanceMeasurementCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterIlluminanceMeasurement>
): JSX.Element => {
	// Color-code based on illuminance (lux)
	const getIlluminanceColor = (lux: number): string => {
		if (lux < 10) {
			return '#1f2937'; // Very dark
		}
		if (lux < 50) {
			return '#374151'; // Dark
		}
		if (lux < 200) {
			return '#6b7280'; // Dim
		}
		if (lux < 1000) {
			return '#f59e0b'; // Moderate
		}
		return '#fbbf24'; // Bright
	};

	const getTextColor = (lux: number): string => {
		return lux < 200 ? 'white' : 'black';
	};

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={getIlluminanceColor(props.cluster.illuminance)}
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background:
							props.cluster.illuminance < 200
								? 'rgba(255, 255, 255, 0.2)'
								: 'rgba(0, 0, 0, 0.2)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						fontSize: '1.5rem',
						color: getTextColor(props.cluster.illuminance),
					}}
				>
					<IconOrNull icon={props.cluster.icon} />
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
							color: getTextColor(props.cluster.illuminance),
						}}
					>
						{props.device.name}
					</Typography>
					<Typography
						variant="h6"
						sx={{
							color: getTextColor(props.cluster.illuminance),
							fontWeight: 'bold',
						}}
					>
						{props.cluster.illuminance.toFixed(0)} lux
					</Typography>
				</Box>
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

const OccupancySensorGroupCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterOccupancySensorGroup>
): JSX.Element => {
	const occupancy = props.cluster.mergedClusters[DeviceClusterName.OCCUPANCY_SENSING];
	const temperature = props.cluster.mergedClusters[DeviceClusterName.TEMPERATURE_MEASUREMENT];
	const humidity = props.cluster.mergedClusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT];

	const getTimeSince = (timestamp?: number): string => {
		if (!timestamp) {
			return 'Never';
		}
		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `${days}d ago`;
		}
		if (hours > 0) {
			return `${hours}h ago`;
		}
		if (minutes > 0) {
			return `${minutes}m ago`;
		}
		return `${seconds}s ago`;
	};

	// Background color logic
	const getBackgroundColor = (): string => {
		// If occupancy sensor exists, use its state for background
		if (occupancy) {
			return occupancy.occupied ? '#1a472a' : '#2f2f2f';
		}
		// Otherwise, use temperature-based coloring if available
		if (temperature) {
			const temp = temperature.temperature;
			if (temp < 10) {
				return '#1e3a8a'; // Deep blue (cold)
			}
			if (temp < 18) {
				return '#3b82f6'; // Blue (cool)
			}
			if (temp < 22) {
				return '#10b981'; // Green (comfortable)
			}
			if (temp < 26) {
				return '#f59e0b'; // Orange (warm)
			}
			return '#dc2626'; // Red (hot)
		}
		// Default gray
		return '#2f2f2f';
	};

	const backgroundColor = getBackgroundColor();
	const isTemperatureBased = !occupancy && temperature;

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={backgroundColor}
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: occupancy?.occupied
							? 'rgba(76, 175, 80, 0.2)'
							: isTemperatureBased
								? 'rgba(255, 255, 255, 0.2)'
								: 'rgba(0, 0, 0, 0.08)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						fontSize: '1.5rem',
						color: occupancy?.occupied
							? '#4caf50'
							: isTemperatureBased
								? 'white'
								: 'text.secondary',
					}}
				>
					<IconOrNull icon={props.cluster.icon} />
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
							color: isTemperatureBased ? 'white' : undefined,
						}}
					>
						{props.device.name}
					</Typography>
					<Box
						sx={{
							display: 'flex',
							gap: 1.5,
							alignItems: 'baseline',
						}}
					>
						{temperature && (
							<Typography
								variant="body2"
								sx={{
									color: isTemperatureBased ? 'white' : 'text.secondary',
									fontWeight: isTemperatureBased ? 'bold' : undefined,
								}}
							>
								{temperature.temperature.toFixed(1)}°C
							</Typography>
						)}
						{humidity && (
							<Typography
								variant="body2"
								sx={{
									color: isTemperatureBased ? 'white' : 'text.secondary',
									fontWeight: isTemperatureBased ? 'bold' : undefined,
								}}
							>
								{(humidity.humidity * 100).toFixed(0)}%
							</Typography>
						)}
					</Box>
					{occupancy && (
						<Typography
							variant="caption"
							sx={{
								color: 'text.secondary',
							}}
						>
							Last: {getTimeSince(occupancy.lastTriggered)}
						</Typography>
					)}
				</Box>
				{occupancy?.occupied && (
					<Box
						sx={{
							width: 12,
							height: 12,
							borderRadius: '50%',
							backgroundColor: '#4caf50',
							animation: 'pulse 2s infinite',
							'@keyframes pulse': {
								'0%, 100%': {
									opacity: 1,
								},
								'50%': {
									opacity: 0.5,
								},
							},
						}}
					/>
				)}
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

/**
 * Get air quality level label and color
 * AirQuality enum: Unknown=0, Good=1, Fair=2, Moderate=3, Poor=4, VeryPoor=5, ExtremelyPoor=6
 * CO2/PM2.5 level: Unknown=0, Low=1, Medium=2, High=3, Critical=4
 */
const getAirQualityInfo = (
	airQuality?: number,
	co2Level?: number,
	pm25Level?: number
): { label: string; color: string; indicatorColor: string; isAlert: boolean } => {
	// Determine worst level from available sensors
	let worstLevel = 0;

	// Map AirQuality enum to a 0-4 scale
	if (airQuality !== undefined && airQuality > 0) {
		// Good=1 -> 1, Fair=2 -> 2, Moderate=3 -> 2, Poor=4 -> 3, VeryPoor=5 -> 4, ExtremelyPoor=6 -> 4
		const mappedLevel = airQuality <= 1 ? 1 : airQuality <= 3 ? 2 : airQuality <= 4 ? 3 : 4;
		worstLevel = Math.max(worstLevel, mappedLevel);
	}

	if (co2Level !== undefined && co2Level > 0) {
		worstLevel = Math.max(worstLevel, co2Level);
	}

	if (pm25Level !== undefined && pm25Level > 0) {
		worstLevel = Math.max(worstLevel, pm25Level);
	}

	switch (worstLevel) {
		case 1:
			return { label: 'Good', color: '#10b981', indicatorColor: '#34d399', isAlert: false };
		case 2:
			return {
				label: 'Moderate',
				color: '#f59e0b',
				indicatorColor: '#fbbf24',
				isAlert: false,
			};
		case 3:
			return { label: 'Poor', color: '#ef4444', indicatorColor: '#f87171', isAlert: true };
		case 4:
			return {
				label: 'Critical',
				color: '#7c2d12',
				indicatorColor: '#dc2626',
				isAlert: true,
			};
		default:
			return {
				label: 'Unknown',
				color: '#6b7280',
				indicatorColor: '#9ca3af',
				isAlert: false,
			};
	}
};

const AirQualityGroupCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterAirQualityGroup>
): JSX.Element => {
	const airQuality = props.cluster.mergedClusters[DeviceClusterName.AIR_QUALITY];
	const co2 =
		props.cluster.mergedClusters[DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT];
	const pm25 = props.cluster.mergedClusters[DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT];

	const { label, color, indicatorColor, isAlert } = getAirQualityInfo(
		airQuality?.airQuality,
		co2?.level,
		pm25?.level
	);

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={color}
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: 'rgba(255, 255, 255, 0.2)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						fontSize: '1.5rem',
						color: 'white',
					}}
				>
					<IconOrNull icon={props.cluster.icon} />
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
							color: 'white',
						}}
					>
						{props.device.name}
					</Typography>
					<Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
						{co2?.concentration !== undefined && (
							<Typography
								variant="body2"
								sx={{
									color: 'white',
									fontWeight: 'bold',
								}}
							>
								{Math.round(co2.concentration)} ppm
							</Typography>
						)}
						{pm25?.concentration !== undefined && (
							<Typography
								variant="body2"
								sx={{
									color: 'rgba(255, 255, 255, 0.9)',
								}}
							>
								PM2.5: {pm25.concentration.toFixed(1)}
							</Typography>
						)}
					</Box>
					<Chip
						label={label}
						size="small"
						sx={{
							backgroundColor: 'rgba(255, 255, 255, 0.2)',
							color: 'white',
							fontWeight: 500,
							fontSize: '0.7rem',
							height: 20,
							mt: 0.5,
						}}
					/>
				</Box>
				{isAlert && (
					<Box
						sx={{
							width: 12,
							height: 12,
							borderRadius: '50%',
							backgroundColor: indicatorColor,
							animation: 'pulse 2s infinite',
							'@keyframes pulse': {
								'0%, 100%': {
									opacity: 1,
								},
								'50%': {
									opacity: 0.5,
								},
							},
						}}
					/>
				)}
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

const BooleanStateCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterBooleanState>
): JSX.Element => {
	// Door state: false = open (alert), true = closed (safe)
	const isOpen = !props.cluster.state;
	const backgroundColor = isOpen ? '#7c2d12' : '#1a472a';
	const accentColor = isOpen ? '#f97316' : '#4caf50';

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={backgroundColor}
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: isOpen ? 'rgba(249, 115, 22, 0.2)' : 'rgba(76, 175, 80, 0.2)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						fontSize: '1.5rem',
						color: 'white',
					}}
				>
					<IconOrNull icon={props.cluster.icon} />
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
							color: 'white',
						}}
					>
						{props.device.name}
					</Typography>
					<Typography
						variant="body2"
						sx={{
							color: 'rgba(255, 255, 255, 0.9)',
							fontWeight: 'bold',
						}}
					>
						{isOpen ? 'Open' : 'Closed'}
					</Typography>
					{props.cluster.lastChanged && (
						<Typography
							variant="caption"
							sx={{
								color: 'rgba(255, 255, 255, 0.7)',
							}}
						>
							Last changed: {getTimeSince(props.cluster.lastChanged)}
						</Typography>
					)}
				</Box>
				{isOpen && (
					<Box
						sx={{
							width: 12,
							height: 12,
							borderRadius: '50%',
							backgroundColor: accentColor,
							animation: 'pulse 2s infinite',
							'@keyframes pulse': {
								'0%, 100%': {
									opacity: 1,
								},
								'50%': {
									opacity: 0.5,
								},
							},
						}}
					/>
				)}
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

const ColorControlXYCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterColorControlXY>
): JSX.Element => {
	// Convert HSV to RGB for display
	const hsvToRgb = (
		h: number,
		s: number,
		v: number
	): { color: string; r: number; g: number; b: number } => {
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
			case 5:
				r = vNorm;
				g = p;
				b = q;
				break;
			default:
				r = 0;
				g = 0;
				b = 0;
		}

		const r255 = Math.round(r * 255);
		const g255 = Math.round(g * 255);
		const b255 = Math.round(b * 255);

		return {
			color: `rgb(${r255}, ${g255}, ${b255})`,
			r: r255,
			g: g255,
			b: b255,
		};
	};

	// Calculate relative luminance (WCAG formula)
	const getLuminance = (r: number, g: number, b: number): number => {
		const [rs, gs, bs] = [r, g, b].map((c) => {
			const channel = c / 255;
			return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
		});
		return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
	};

	// Use brightness from LevelControl if available, otherwise use HSV value
	const brightness = props.cluster.mergedClusters[DeviceClusterName.LEVEL_CONTROL]?.currentLevel
		? props.cluster.mergedClusters[DeviceClusterName.LEVEL_CONTROL]?.currentLevel * 100
		: props.cluster.color.value;
	const { color, r, g, b } = hsvToRgb(
		props.cluster.color.hue,
		props.cluster.color.saturation,
		brightness
	);

	// Check if device is on or off
	const onOffCluster = props.cluster.mergedClusters[DeviceClusterName.ON_OFF];
	const isDeviceOn = !onOffCluster || onOffCluster.isOn;
	const hasOnOff = !!onOffCluster;

	// Calculate luminance and determine text color
	const luminance = getLuminance(r, g, b);
	const isLightBackground = isDeviceOn && luminance > 0.5;
	const textColor = isLightBackground ? 'rgba(0, 0, 0, 0.87)' : 'white';
	const iconBgColor = isLightBackground ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.3)';
	const iconColor = isLightBackground ? 'rgba(0, 0, 0, 0.6)' : 'white';
	const textShadow = isLightBackground ? 'none' : '0 0 4px rgba(0,0,0,0.5)';

	const handleToggleOnOff = async (e: React.MouseEvent) => {
		e.stopPropagation(); // Prevent card click from opening detail view
		if (!onOffCluster) {
			return;
		}
		await apiPost(
			'device',
			'/cluster/OnOff',
			{},
			{
				deviceIds: [props.device.uniqueId],
				isOn: !onOffCluster.isOn,
			}
		);
		props.invalidate();
	};

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={isDeviceOn ? color : '#2f2f2f'}
			hasInteractiveChildren={hasOnOff}
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: iconBgColor,
						borderRadius: '50%',
						width: 48,
						height: 48,
						fontSize: '1.5rem',
						color: iconColor,
					}}
				>
					<IconOrNull icon={props.cluster.icon} />
				</Box>
				<Typography
					variant="body1"
					sx={{
						fontWeight: 500,
						color: textColor,
						textShadow: textShadow,
						flexGrow: 1,
					}}
				>
					{props.device.name}
				</Typography>
				{hasOnOff && (
					<IconButton
						onClick={handleToggleOnOff}
						size="small"
						sx={{
							color: iconColor,
							opacity: isDeviceOn ? 1 : 0.5,
							'&:hover': {
								backgroundColor: isLightBackground
									? 'rgba(0, 0, 0, 0.12)'
									: 'rgba(255, 255, 255, 0.1)',
							},
						}}
					>
						<PowerIcon fontSize="small" />
					</IconButton>
				)}
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

const ThermostatCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterThermostat>
): JSX.Element => {
	const getModeColor = (mode: ThermostatMode): string => {
		switch (mode) {
			case ThermostatMode.HEAT:
				return '#f97316';
			case ThermostatMode.COOL:
				return '#3b82f6';
			case ThermostatMode.AUTO:
				return '#10b981';
			case ThermostatMode.OFF:
			default:
				return '#6b7280';
		}
	};

	const getModeLabel = (mode: ThermostatMode): string => {
		switch (mode) {
			case ThermostatMode.HEAT:
				return 'Heating';
			case ThermostatMode.COOL:
				return 'Cooling';
			case ThermostatMode.AUTO:
				return 'Auto';
			case ThermostatMode.OFF:
			default:
				return 'Cooling';
		}
	};

	const backgroundColor = props.cluster.isHeating ? '#2d1b0e' : '#2f2f2f';
	const accentColor = getModeColor(props.cluster.mode);

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={backgroundColor}
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: props.cluster.isHeating
							? 'rgba(249, 115, 22, 0.2)'
							: 'rgba(0, 0, 0, 0.08)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						fontSize: '1.5rem',
						color: accentColor,
					}}
				>
					<IconOrNull icon={props.cluster.icon} />
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
						}}
					>
						{props.device.name}
					</Typography>
					<Typography
						variant="caption"
						sx={{
							color: 'text.secondary',
						}}
					>
						{props.cluster.isHeating ? 'Heating' : getModeLabel(props.cluster.mode)}
					</Typography>
				</Box>
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'flex-end',
						gap: 0.5,
					}}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 0.5,
						}}
					>
						<MyLocationIcon
							sx={{
								fontSize: '1rem',
								color: accentColor,
							}}
						/>
						<Typography
							variant="h6"
							sx={{
								fontWeight: 'bold',
								color: accentColor,
							}}
						>
							{props.cluster.targetTemperature.toFixed(1)}°C
						</Typography>
					</Box>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 0.5,
						}}
					>
						<ThermostatIcon
							sx={{
								fontSize: '0.875rem',
								color: 'text.secondary',
							}}
						/>
						<Typography
							variant="caption"
							sx={{
								color: 'text.secondary',
							}}
						>
							{props.cluster.currentTemperature.toFixed(1)}°C
						</Typography>
					</Box>
				</Box>
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

const FridgeCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterFridge>
): JSX.Element => {
	const cluster = props.cluster;
	const doorOpen = cluster.freezerDoorOpen || cluster.coolerDoorOpen;
	const backgroundColor = doorOpen ? '#b45309' : '#0c4a6e';

	const formatTemp = (temp: number | undefined): string =>
		temp !== undefined ? `${temp.toFixed(1)}°C` : '—';

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={backgroundColor}
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: 'rgba(255, 255, 255, 0.2)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						color: 'white',
					}}
				>
					<KitchenIcon sx={{ fontSize: 28 }} />
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
							color: 'white',
						}}
					>
						{props.device.name}
					</Typography>
					<Typography
						variant="caption"
						sx={{
							color: 'rgba(255, 255, 255, 0.85)',
							display: 'block',
						}}
					>
						Doors: {doorOpen ? 'Open' : 'Closed'}
					</Typography>
					<Box
						sx={{
							display: 'flex',
							gap: 1.5,
							mt: 0.5,
						}}
					>
						<Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
							Fridge {formatTemp(cluster.fridgeTempC)}
						</Typography>
						<Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
							Freezer {formatTemp(cluster.freezerTempC)}
						</Typography>
					</Box>
				</Box>
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

const WasherCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterWasher>
): JSX.Element => {
	const cluster = props.cluster;
	const isRunning = cluster.machineState === 'run' || cluster.operatingState === 'running';
	const isPaused = cluster.machineState === 'pause' || cluster.operatingState === 'paused';
	const isDone = cluster.done === true;

	const getBackgroundColor = (): string => {
		if (isDone) {
			return '#064e3b';
		}
		if (isPaused) {
			return '#78350f';
		}
		if (isRunning) {
			return '#1e3a8a';
		}
		return '#374151';
	};

	const getStateLabel = (): string => {
		if (isDone) {
			return 'Done';
		}
		if (isPaused) {
			return 'Paused';
		}
		if (isRunning) {
			return 'Running';
		}
		return 'Stopped';
	};

	const formatRemaining = (): string => {
		if (cluster.remainingTimeStr) {
			return cluster.remainingTimeStr;
		}
		if (cluster.remainingTimeMinutes !== undefined && cluster.remainingTimeMinutes !== null) {
			const m = cluster.remainingTimeMinutes;
			if (m >= 60) {
				return `${Math.floor(m / 60)}h ${m % 60}m`;
			}
			return `${m} min`;
		}
		return '';
	};

	const phaseLabel =
		cluster.phase && cluster.phase !== 'none'
			? cluster.phase.charAt(0).toUpperCase() + cluster.phase.slice(1)
			: '';

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={getBackgroundColor()}
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: 'rgba(255, 255, 255, 0.2)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						color: 'white',
					}}
				>
					<LocalLaundryServiceIcon sx={{ fontSize: 28 }} />
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
							color: 'white',
						}}
					>
						{props.device.name}
					</Typography>
					<Typography
						variant="caption"
						sx={{
							color: 'rgba(255, 255, 255, 0.9)',
							display: 'block',
						}}
					>
						{getStateLabel()}
						{phaseLabel ? ` • ${phaseLabel}` : ''}
					</Typography>
					{(isRunning || isPaused) && (
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 1,
								mt: 0.5,
							}}
						>
							{cluster.progressPercent !== undefined && (
								<Typography
									variant="caption"
									sx={{ color: 'rgba(255, 255, 255, 0.9)' }}
								>
									{cluster.progressPercent}%
								</Typography>
							)}
							{formatRemaining() && (
								<Typography
									variant="caption"
									sx={{ color: 'rgba(255, 255, 255, 0.9)' }}
								>
									{formatRemaining()} left
								</Typography>
							)}
						</Box>
					)}
					{isDone && (
						<Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
							Cycle complete
						</Typography>
					)}
				</Box>
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

const ActionsCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterActions>
): JSX.Element => {
	const activeAction = props.cluster.actions.find(
		(action) => action.id === props.cluster.activeActionId
	);

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground="#374151"
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					deviceId: props.device.uniqueId,
					clusterName: props.cluster.name,
				});
			}}
		>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 2,
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: 'rgba(255, 255, 255, 0.1)',
						borderRadius: '50%',
						width: 48,
						height: 48,
						fontSize: '1.5rem',
						color: 'white',
					}}
				>
					<IconOrNull icon={props.cluster.icon} />
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
							color: 'white',
						}}
					>
						{props.device.name}
					</Typography>
					{activeAction && (
						<Typography
							variant="caption"
							sx={{
								color: 'rgba(255, 255, 255, 0.7)',
							}}
						>
							Active: {activeAction.name}
						</Typography>
					)}
				</Box>
			</Box>
		</DeviceClusterCardSkeleton>
	);
};

export const DeviceClusterCard = (
	props:
		| DeviceClusterCardBaseProps<DashboardDeviceClusterWithState>
		| GroupedWindowCoveringCardProps
): JSX.Element | null => {
	// Check if this is a grouped cluster card
	if ('devices' in props && 'roomName' in props) {
		if (props.cluster.name === DeviceClusterName.WINDOW_COVERING) {
			return <GroupedWindowCoveringCard {...props} />;
		}
		return null;
	}

	// At this point, props is DeviceClusterCardBaseProps
	const regularProps = props;

	if (regularProps.cluster.name === DeviceClusterName.ON_OFF) {
		return <OnOffCard {...regularProps} cluster={regularProps.cluster} />;
	}
	if (regularProps.cluster.name === DeviceClusterName.WINDOW_COVERING) {
		return <WindowCoveringCard {...regularProps} cluster={regularProps.cluster} />;
	}
	if (regularProps.cluster.name === DeviceClusterName.OCCUPANCY_SENSING) {
		// Check if it's a sensor group or standalone occupancy sensor
		if ('mergedClusters' in regularProps.cluster) {
			return <OccupancySensorGroupCard {...regularProps} cluster={regularProps.cluster} />;
		}
		return <OccupancySensingCard {...regularProps} cluster={regularProps.cluster} />;
	}
	if (regularProps.cluster.name === DeviceClusterName.AIR_QUALITY) {
		// Check if it's an air quality group or standalone air quality sensor
		if ('mergedClusters' in regularProps.cluster) {
			return <AirQualityGroupCard {...regularProps} cluster={regularProps.cluster} />;
		}
		// Standalone air quality sensor not yet supported
		return null;
	}
	if (regularProps.cluster.name === DeviceClusterName.TEMPERATURE_MEASUREMENT) {
		return <TemperatureMeasurementCard {...regularProps} cluster={regularProps.cluster} />;
	}
	if (regularProps.cluster.name === DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT) {
		return <RelativeHumidityMeasurementCard {...regularProps} cluster={regularProps.cluster} />;
	}
	if (regularProps.cluster.name === DeviceClusterName.ILLUMINANCE_MEASUREMENT) {
		return <IlluminanceMeasurementCard {...regularProps} cluster={regularProps.cluster} />;
	}
	if (regularProps.cluster.name === DeviceClusterName.BOOLEAN_STATE) {
		return <BooleanStateCard {...regularProps} cluster={regularProps.cluster} />;
	}
	if (regularProps.cluster.name === DeviceClusterName.COLOR_CONTROL) {
		if ('color' in regularProps.cluster) {
			return <ColorControlXYCard {...regularProps} cluster={regularProps.cluster} />;
		}
		// No separate card for color temperature
	}
	if (regularProps.cluster.name === DeviceClusterName.ACTIONS) {
		return <ActionsCard {...regularProps} cluster={regularProps.cluster} />;
	}
	if (regularProps.cluster.name === DeviceClusterName.THERMOSTAT) {
		return <ThermostatCard {...regularProps} cluster={regularProps.cluster} />;
	}
	if (regularProps.cluster.name === DeviceClusterName.SWITCH) {
		return <SwitchCard {...regularProps} cluster={regularProps.cluster} />;
	}
	if (regularProps.cluster.name === DeviceClusterName.DOOR_LOCK) {
		return <DoorLockCard {...regularProps} cluster={regularProps.cluster} />;
	}
	if (regularProps.cluster.name === DeviceClusterName.FRIDGE) {
		return <FridgeCard {...regularProps} cluster={regularProps.cluster} />;
	}
	if (regularProps.cluster.name === DeviceClusterName.WASHER) {
		return <WasherCard {...regularProps} cluster={regularProps.cluster} />;
	}
	// CO2 and PM2.5 sensors are now grouped in AirQualityGroup
	// Standalone handling is not needed
	return null;
};
