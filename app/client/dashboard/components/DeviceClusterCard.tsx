import type {
	DashboardDeviceClusterOnOff,
	DashboardDeviceClusterWindowCovering,
	DashboardDeviceClusterWithState,
	DashboardDeviceClusterOccupancySensing,
	DashboardDeviceClusterTemperatureMeasurement,
	DashboardDeviceClusterRelativeHumidityMeasurement,
	DashboardDeviceClusterIlluminanceMeasurement,
	DashboardDeviceClusterBooleanState,
	DashboardDeviceClusterSwitch,
	DashboardDeviceClusterColorControl,
	DeviceListWithValuesResponse,
} from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { Card, CardActionArea, Box, Typography } from '@mui/material';
import type { EnumValue } from '../../../server/lib/enum';
import { getClusterIcon } from './clusterIcons';
import type { HomeDetailView } from './Home';
import { apiPost } from '../../lib/fetch';
import React from 'react';

interface DeviceClusterCardBaseProps<C extends DashboardDeviceClusterWithState> {
	device: DeviceListWithValuesResponse[number];
	cluster: C;
	invalidate: () => void;
	pushDetailView: (detailView: HomeDetailView) => void;
}

interface DeviceClusterCardProps
	extends DeviceClusterCardBaseProps<DashboardDeviceClusterWithState> {
	onPress?: () => void;
	cardBackground?: string;
	cardRef?: React.RefObject<HTMLDivElement>;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

const DeviceClusterCardSkeleton = (props: DeviceClusterCardProps) => {
	const cardContent = (
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
				{getClusterIcon(props.cluster.icon)}
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
		<Card
			ref={props.cardRef}
			sx={{
				borderRadius: 2,
				overflow: 'hidden',
				background: props.cardBackground,
				touchAction: isDraggable ? 'none' : undefined,
				userSelect: isDraggable ? 'none' : undefined,
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
	);
};

const WindowCoveringCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterWindowCovering>
): JSX.Element => {
	const [dragPosition, setDragPosition] = React.useState<number | null>(null);
	const [isDragging, setIsDragging] = React.useState(false);
	const cardRef = React.useRef<HTMLDivElement>(null);
	const dragStartX = React.useRef<number>(0);
	const dragStartPosition = React.useRef<number>(0);

	const currentPosition =
		dragPosition !== null ? dragPosition : props.cluster.targetPositionLiftPercentage;

	const handlePointerDown = (e: React.PointerEvent) => {
		setIsDragging(true);
		e.currentTarget.setPointerCapture(e.pointerId);
		dragStartX.current = e.clientX;
		dragStartPosition.current = props.cluster.targetPositionLiftPercentage;
	};

	const handlePointerMove = (e: React.PointerEvent) => {
		if (!isDragging || !cardRef.current) {
			return;
		}

		const rect = cardRef.current.getBoundingClientRect();
		const deltaX = e.clientX - dragStartX.current;
		const deltaPercentage = (deltaX / rect.width) * 100 * 2; // 2x sensitivity
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

const OnOffCard = (props: DeviceClusterCardBaseProps<DashboardDeviceClusterOnOff>): JSX.Element => {
	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={props.cluster.isOn ? '#976c00' : '#422d00'}
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
		/>
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
		<Card
			sx={{
				borderRadius: 2,
				overflow: 'hidden',
				background: props.cluster.occupied ? '#1a472a' : '#2f2f2f',
			}}
		>
			<CardActionArea
				sx={{ p: 2 }}
				onClick={() => {
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
						{getClusterIcon(props.cluster.icon)}
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
			</CardActionArea>
		</Card>
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
		<Card
			sx={{
				borderRadius: 2,
				overflow: 'hidden',
				background: getTemperatureColor(props.cluster.temperature),
			}}
		>
			<CardActionArea
				sx={{ p: 2 }}
				onClick={() => {
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
						{getClusterIcon(props.cluster.icon)}
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
			</CardActionArea>
		</Card>
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
		<Card
			sx={{
				borderRadius: 2,
				overflow: 'hidden',
				background: getHumidityColor(props.cluster.humidity),
			}}
		>
			<CardActionArea
				sx={{ p: 2 }}
				onClick={() => {
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
						{getClusterIcon(props.cluster.icon)}
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
			</CardActionArea>
		</Card>
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
		<Card
			sx={{
				borderRadius: 2,
				overflow: 'hidden',
				background: getIlluminanceColor(props.cluster.illuminance),
			}}
		>
			<CardActionArea
				sx={{ p: 2 }}
				onClick={() => {
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
						{getClusterIcon(props.cluster.icon)}
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
			</CardActionArea>
		</Card>
	);
};

const BooleanStateCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterBooleanState>
): JSX.Element => {
	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={props.cluster.state ? '#1a472a' : '#2f2f2f'}
		/>
	);
};

const SwitchCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterSwitch>
): JSX.Element => {
	return (
		<Card
			sx={{
				borderRadius: 2,
				overflow: 'hidden',
				background: '#374151',
			}}
		>
			<CardActionArea sx={{ p: 2 }}>
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
						{getClusterIcon(props.cluster.icon)}
					</Box>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
							color: 'white',
							flexGrow: 1,
						}}
					>
						{props.device.name}
					</Typography>
				</Box>
			</CardActionArea>
		</Card>
	);
};

const ColorControlCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterColorControl>
): JSX.Element => {
	// Convert HSV to RGB for display
	const hsvToRgb = (h: number, s: number, v: number): string => {
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

		return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
	};

	const color = hsvToRgb(
		props.cluster.color.hue,
		props.cluster.color.saturation,
		props.cluster.color.value
	);

	return (
		<Card
			sx={{
				borderRadius: 2,
				overflow: 'hidden',
				background: color,
			}}
		>
			<CardActionArea
				sx={{ p: 2 }}
				onClick={() => {
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
							background: 'rgba(0, 0, 0, 0.3)',
							borderRadius: '50%',
							width: 48,
							height: 48,
							fontSize: '1.5rem',
							color: 'white',
						}}
					>
						{getClusterIcon(props.cluster.icon)}
					</Box>
					<Typography
						variant="body1"
						sx={{
							fontWeight: 500,
							color: 'white',
							textShadow: '0 0 4px rgba(0,0,0,0.5)',
							flexGrow: 1,
						}}
					>
						{props.device.name}
					</Typography>
				</Box>
			</CardActionArea>
		</Card>
	);
};

export const DEVICE_CLUSTER_CARDS: Record<
	EnumValue,
	React.ComponentType<DeviceClusterCardBaseProps<DashboardDeviceClusterWithState>>
> = {
	[DeviceClusterName.WINDOW_COVERING]: WindowCoveringCard,
	[DeviceClusterName.ON_OFF]: OnOffCard,
	[DeviceClusterName.OCCUPANCY_SENSING]: OccupancySensingCard,
	[DeviceClusterName.TEMPERATURE_MEASUREMENT]: TemperatureMeasurementCard,
	[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT]: RelativeHumidityMeasurementCard,
	[DeviceClusterName.ILLUMINANCE_MEASUREMENT]: IlluminanceMeasurementCard,
	[DeviceClusterName.BOOLEAN_STATE]: BooleanStateCard,
	[DeviceClusterName.SWITCH]: SwitchCard,
	[DeviceClusterName.COLOR_CONTROL]: ColorControlCard,
};

export const DeviceClusterCard = (
	props: DeviceClusterCardBaseProps<DashboardDeviceClusterWithState>
): JSX.Element | null => {
	if (props.cluster.name === DeviceClusterName.ON_OFF) {
		return <OnOffCard {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.WINDOW_COVERING) {
		return <WindowCoveringCard {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.OCCUPANCY_SENSING) {
		return <OccupancySensingCard {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.TEMPERATURE_MEASUREMENT) {
		return <TemperatureMeasurementCard {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT) {
		return <RelativeHumidityMeasurementCard {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.ILLUMINANCE_MEASUREMENT) {
		return <IlluminanceMeasurementCard {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.BOOLEAN_STATE) {
		return <BooleanStateCard {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.SWITCH) {
		return <SwitchCard {...props} cluster={props.cluster} />;
	}
	if (props.cluster.name === DeviceClusterName.COLOR_CONTROL) {
		return <ColorControlCard {...props} cluster={props.cluster} />;
	}
	return null;
};
