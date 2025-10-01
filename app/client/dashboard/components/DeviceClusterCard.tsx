import type {
	DashboardDeviceClusterExtra,
	DashboardDeviceClusterWithState,
} from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { Card, CardActionArea, Box, Typography } from '@mui/material';
import { apiPost, type ReturnTypeForApi } from '../../lib/fetch';
import type { EnumValue } from '../../../server/lib/enum';
import { getClusterIcon } from './clusterIcons';
import React from 'react';

type DeviceType = ReturnTypeForApi<
	'device',
	'/listWithValues',
	'GET'
>['ok']['devices'][number];

interface DeviceClusterCardBaseProps {
	device: DeviceType;
	cluster: DashboardDeviceClusterWithState;
	invalidate: () => void;
}

interface DeviceClusterCardProps extends DeviceClusterCardBaseProps {
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

const WindowCoveringCard = (props: DeviceClusterCardBaseProps) => {
	const extra =
		props.cluster as DashboardDeviceClusterExtra['WindowCovering'];
	const [dragPosition, setDragPosition] = React.useState<number | null>(null);
	const [isDragging, setIsDragging] = React.useState(false);
	const cardRef = React.useRef<HTMLDivElement>(null);
	const dragStartX = React.useRef<number>(0);
	const dragStartPosition = React.useRef<number>(0);

	const currentPosition =
		dragPosition !== null
			? dragPosition
			: extra.targetPositionLiftPercentage;

	const handlePointerDown = (e: React.PointerEvent) => {
		setIsDragging(true);
		e.currentTarget.setPointerCapture(e.pointerId);
		dragStartX.current = e.clientX;
		dragStartPosition.current = extra.targetPositionLiftPercentage;
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
					deviceId: props.device.uniqueId,
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

const OnOffCard = (props: DeviceClusterCardBaseProps) => {
	const extra = props.cluster as DashboardDeviceClusterExtra['OnOff'];
	return (
		<DeviceClusterCardSkeleton
			{...props}
			cardBackground={extra.isOn ? '#976c00' : '#422d00'}
			onPress={async () => {
				await apiPost(
					'device',
					'/cluster/OnOff',
					{},
					{ deviceId: props.device.uniqueId, isOn: !extra.isOn }
				);
				props.invalidate();
			}}
		/>
	);
};

const DEVICE_CLUSTER_CARDS: Record<
	EnumValue,
	React.ComponentType<DeviceClusterCardBaseProps>
> = {
	[DeviceClusterName.WINDOW_COVERING.value]: WindowCoveringCard,
	[DeviceClusterName.ON_OFF.value]: OnOffCard,
};

export const DeviceClusterCard = (
	props: DeviceClusterCardBaseProps
): JSX.Element => {
	const CardComponent = DEVICE_CLUSTER_CARDS[props.cluster.name];
	return <CardComponent {...props} />;
};
