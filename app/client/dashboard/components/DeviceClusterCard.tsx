import type {
	DashboardDeviceClusterOnOff,
	DashboardDeviceClusterWindowCovering,
	DashboardDeviceClusterWithState,
	DashboardDeviceClusterOccupancySensing,
	DashboardDeviceClusterTemperatureMeasurement,
	DashboardDeviceClusterRelativeHumidityMeasurement,
	DashboardDeviceClusterIlluminanceMeasurement,
	DashboardDeviceClusterBooleanState,
	DashboardDeviceClusterColorControl,
	DashboardDeviceClusterActions,
	DashboardDeviceClusterSensorGroup,
	DashboardDeviceClusterThermostat,
	DashboardDeviceClusterSwitch,
	DeviceListWithValuesResponse,
} from '../../../server/modules/device/routing';
import { DeviceClusterName, ThermostatMode } from '../../../server/modules/device/cluster';
import { fadeInUpStaggered, staggerItem } from '../../lib/animations';
import { Card, CardActionArea, Box, Typography } from '@mui/material';
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
}

const DeviceClusterCardSkeleton = (props: DeviceClusterCardProps) => {
	const cardContent = props.children ?? (
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
		</Box>
	);

	const isDraggable = !!props.onPointerMove;
	return (
		<motion.div
			variants={staggerItem}
			whileHover={isDraggable ? undefined : 'hover'}
			whileTap={isDraggable ? undefined : 'tap'}
			initial="rest"
			animate="rest"
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
				{isDraggable ? (
					<Box sx={{ p: 2, cursor: 'pointer' }}>{cardContent}</Box>
				) : (
					<CardActionArea sx={{ p: 2 }}>{cardContent}</CardActionArea>
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
				device: props.device,
				cluster: props.cluster,
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
				devices: props.devices,
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

const OnOffCard = (props: DeviceClusterCardBaseProps<DashboardDeviceClusterOnOff>): JSX.Element => {
	const energyCluster =
		props.cluster.mergedClusters?.[DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT];
	const powerCluster =
		props.cluster.mergedClusters?.[DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT];

	// Color-code based on power usage if energy data is available
	const getBackgroundColor = (): string => {
		if (!energyCluster || !props.cluster.isOn) {
			return props.cluster.isOn ? '#976c00' : '#422d00';
		}

		const power = powerCluster?.activePower ?? 0;
		if (power < 100) {
			return '#976c00'; // Low power - gold
		} else if (power < 1000) {
			return '#b85c00'; // Medium power - orange
		} else {
			return '#c73e1d'; // High power - red-orange
		}
	};

	const formatPower = (watts: number): string => {
		if (watts >= 1000) {
			return `${(watts / 1000).toFixed(1)} kW`;
		}
		return `${watts} W`;
	};

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={getBackgroundColor()}
			onPress={async () => {
				await apiPost(
					'device',
					'/cluster/OnOff',
					{},
					{
						deviceIds: [props.device.uniqueId],
						isOn: !props.cluster.isOn,
					}
				);
				props.invalidate();
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
					device: props.device,
					cluster: props.cluster,
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
					device: props.device,
					cluster: props.cluster,
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
					device: props.device,
					cluster: props.cluster,
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
					device: props.device,
					cluster: props.cluster,
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
					device: props.device,
					cluster: props.cluster,
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

const SensorGroupCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterSensorGroup>
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
					device: props.device,
					cluster: props.cluster,
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
					device: props.device,
					cluster: props.cluster,
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

const ColorControlCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterColorControl>
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
	const brightness =
		props.cluster.mergedClusters[DeviceClusterName.LEVEL_CONTROL]?.currentLevel ??
		props.cluster.color.value;
	const { color, r, g, b } = hsvToRgb(
		props.cluster.color.hue,
		props.cluster.color.saturation,
		brightness
	);

	// Check if device is on or off
	const isDeviceOn =
		!props.cluster.mergedClusters[DeviceClusterName.ON_OFF] ||
		props.cluster.mergedClusters[DeviceClusterName.ON_OFF].isOn;

	// Calculate luminance and determine text color
	const luminance = getLuminance(r, g, b);
	const isLightBackground = isDeviceOn && luminance > 0.5;
	const textColor = isLightBackground ? 'rgba(0, 0, 0, 0.87)' : 'white';
	const iconBgColor = isLightBackground ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.3)';
	const iconColor = isLightBackground ? 'rgba(0, 0, 0, 0.6)' : 'white';
	const textShadow = isLightBackground ? 'none' : '0 0 4px rgba(0,0,0,0.5)';

	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={isDeviceOn ? color : '#2f2f2f'}
			onPress={() => {
				props.pushDetailView({
					type: 'device',
					device: props.device,
					cluster: props.cluster,
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
				return 'Off';
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
					device: props.device,
					cluster: props.cluster,
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
						{getModeLabel(props.cluster.mode)}
						{props.cluster.isHeating && ' • Active'}
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
					<Typography
						variant="h6"
						sx={{
							fontWeight: 'bold',
							color: accentColor,
						}}
					>
						{props.cluster.targetTemperature.toFixed(1)}°C
					</Typography>
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
					device: props.device,
					cluster: props.cluster,
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
			return <SensorGroupCard {...regularProps} cluster={regularProps.cluster} />;
		}
		return <OccupancySensingCard {...regularProps} cluster={regularProps.cluster} />;
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
		return <ColorControlCard {...regularProps} cluster={regularProps.cluster} />;
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
	return null;
};
