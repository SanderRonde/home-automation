import type {
	DeviceListWithValuesResponse,
	DashboardDeviceClusterColorControl,
} from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type { WallSegment, DoorSlot } from '../types/layout';
import { Box, IconButton, Typography } from '@mui/material';
import type { DeviceGroup } from '../../../../types/group';
import { useCreateData, useData } from '../lib/data-hooks';
// @ts-expect-error - konva ESM/CommonJS type resolution issue
import type { Stage as StageType } from 'konva/lib/Stage';
import type { RoomInfo } from './RoomAssignmentDialog';
// @ts-expect-error - konva ESM/CommonJS type resolution issue
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Data } from '../../../server/lib/data';
import { detectRooms } from '../lib/room-detection';
import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import { Layer, Line, Stage } from 'react-konva';
import type { IncludedIconNames } from './icon';
import { WbSunny } from '@mui/icons-material';
import type { HomeDetailView } from './Home';
import { DeviceIcon } from './DeviceIcon';
import { GroupIcon } from './GroupIcon';
import { IconComponent } from './icon';

interface HomeLayoutViewProps {
	kiosk: boolean;
	devices: DeviceListWithValuesResponse;
	pushDetailView: (detailView: HomeDetailView) => void;
	invalidate: () => void;
	temperatureExpanded: boolean;
	energyExpanded: boolean;
	verticalSpacing: number;
}

// Helper to filter clusters like ClusterIconButton does
const getRelevantClusters = (clusterNames: DeviceClusterName[]): DeviceClusterName[] => {
	const relevantClusters = new Set<DeviceClusterName>();
	for (const clusterName of clusterNames) {
		if (
			clusterName === DeviceClusterName.WINDOW_COVERING ||
			clusterName === DeviceClusterName.ON_OFF ||
			clusterName === DeviceClusterName.COLOR_CONTROL
		) {
			relevantClusters.add(clusterName);
		}
	}
	return Array.from(relevantClusters).sort();
};

const WALL_THICKNESS = 6;
const WALL_COLOR = '#ccc';

interface ClusterIconButtonProps {
	clusterData: { clusterName: DeviceClusterName; icon: IncludedIconNames | null };
	roomData: {
		room: { id: string; center: { x: number; y: number } };
		mappedRoomName: string;
		roomDevices: DeviceListWithValuesResponse;
	};
	index: number;
	centerX: number;
	centerY: number;
	offsetX: number;
	offsetY: number;
	clusterIconSize: number;
	isCollapsing: boolean;
	handleClusterClick: (clusterName: DeviceClusterName, roomName: string) => void;
	handleClusterAction: (
		clusterName: DeviceClusterName,
		roomDevices: DeviceListWithValuesResponse
	) => Promise<void>;
}

const ClusterIconButton = (props: ClusterIconButtonProps): JSX.Element | null => {
	// Determine if cluster is enabled
	let isEnabled = false;
	if (props.clusterData.clusterName === DeviceClusterName.ON_OFF) {
		const devices = props.roomData.roomDevices.filter((device) =>
			device.mergedAllClusters.some(
				(c) =>
					c.name === DeviceClusterName.ON_OFF ||
					(c.name === DeviceClusterName.COLOR_CONTROL &&
						c.mergedClusters[DeviceClusterName.ON_OFF])
			)
		);
		isEnabled = devices
			.flatMap((d) => d.mergedAllClusters)
			.some(
				(d) =>
					(d.name === DeviceClusterName.ON_OFF && d.isOn) ||
					(d.name === DeviceClusterName.COLOR_CONTROL &&
						d.mergedClusters[DeviceClusterName.ON_OFF]?.isOn)
			);
	} else if (props.clusterData.clusterName === DeviceClusterName.WINDOW_COVERING) {
		const devices = props.roomData.roomDevices.filter((device) =>
			device.mergedAllClusters.some((c) => c.name === DeviceClusterName.WINDOW_COVERING)
		);
		isEnabled = devices
			.flatMap((d) => d.mergedAllClusters)
			.filter((c) => c.name === DeviceClusterName.WINDOW_COVERING)
			.some((d) => d.targetPositionLiftPercentage < 5);
	} else if (props.clusterData.clusterName === DeviceClusterName.COLOR_CONTROL) {
		const devices = props.roomData.roomDevices.filter((device) =>
			device.mergedAllClusters.some(
				(c) =>
					c.name === DeviceClusterName.ON_OFF ||
					(c.name === DeviceClusterName.COLOR_CONTROL &&
						c.mergedClusters[DeviceClusterName.ON_OFF])
			)
		);
		isEnabled = devices
			.flatMap((d) => d.mergedAllClusters)
			.some(
				(d) =>
					(d.name === DeviceClusterName.ON_OFF && d.isOn) ||
					(d.name === DeviceClusterName.COLOR_CONTROL &&
						d.mergedClusters[DeviceClusterName.ON_OFF]?.isOn)
			);
	}

	if (!props.clusterData.icon) {
		return null;
	}

	const keyframeName = props.isCollapsing
		? `clusterCollapse-${props.roomData.room.id}-${props.index}`
		: `clusterExpand-${props.roomData.room.id}-${props.index}`;

	return (
		<IconButton
			key={`${props.roomData.room.id}-${props.clusterData.clusterName}`}
			sx={{
				position: 'absolute',
				left: props.centerX - props.clusterIconSize / 2,
				top: props.centerY - props.clusterIconSize / 2,
				width: props.clusterIconSize,
				height: props.clusterIconSize,
				backgroundColor: isEnabled ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
				color: isEnabled ? '#2a2a2a' : 'rgba(0, 0, 0, 0.5)',
				pointerEvents: props.isCollapsing ? 'none' : 'auto',
				fontSize: '20px',
				opacity: props.isCollapsing ? 1 : 0,
				transform: props.isCollapsing
					? `translate(${props.offsetX}px, ${props.offsetY}px) scale(1)`
					: 'translate(0, 0) scale(0.8)',
				animation: props.isCollapsing
					? `${keyframeName} 200ms ease-out forwards`
					: `${keyframeName} 300ms ease-out forwards`,
				animationDelay: props.isCollapsing ? '0ms' : `${props.index * 40}ms`,
				[`@keyframes ${keyframeName}`]: props.isCollapsing
					? {
							'0%': {
								opacity: 1,
								transform: `translate(${props.offsetX}px, ${props.offsetY}px) scale(1)`,
							},
							'100%': {
								opacity: 0,
								transform: 'translate(0, 0) scale(0.8)',
							},
						}
					: {
							'0%': {
								opacity: 0,
								transform: 'translate(0, 0) scale(0.8)',
							},
							'100%': {
								opacity: 1,
								transform: `translate(${props.offsetX}px, ${props.offsetY}px) scale(1)`,
							},
						},
				'&:hover': {
					backgroundColor: isEnabled ? '#f0f0f0' : 'rgba(255, 255, 255, 0.7)',
				},
			}}
			onPointerDown={(e) => {
				e.stopPropagation();
				e.preventDefault();
				const timer = setTimeout(() => {
					props.handleClusterClick(
						props.clusterData.clusterName,
						props.roomData.mappedRoomName
					);
					document.removeEventListener('pointerup', handlePointerUp);
				}, 500);

				const handlePointerUp = () => {
					clearTimeout(timer);
					void props.handleClusterAction(
						props.clusterData.clusterName,
						props.roomData.roomDevices
					);
					document.removeEventListener('pointerup', handlePointerUp);
				};

				document.addEventListener('pointerup', handlePointerUp);
			}}
		>
			<IconComponent iconName={props.clusterData.icon} />
		</IconButton>
	);
};

interface ExpandedClusterIconsProps {
	roomData: {
		room: { id: string; center: { x: number; y: number } };
		mappedRoomName: string;
		roomDevices: DeviceListWithValuesResponse;
		clusterInfo: Array<{ clusterName: DeviceClusterName; icon: IncludedIconNames | null }>;
	};
	stageTransform: { x: number; y: number; scale: number };
	clusterIconSize: number;
	clusterIconSpacing: number;
	clusterStartX: number;
	clusterY: number;
	isCollapsing: boolean;
	handleClusterClick: (clusterName: DeviceClusterName, roomName: string) => void;
	handleClusterAction: (
		clusterName: DeviceClusterName,
		roomDevices: DeviceListWithValuesResponse
	) => Promise<void>;
}

const ExpandedClusterIcons = (props: ExpandedClusterIconsProps): JSX.Element => {
	return (
		<>
			{props.roomData.clusterInfo.map((clusterData, index) => {
				const x = props.clusterStartX + index * props.clusterIconSpacing;
				const iconCenterX = x + props.clusterIconSize / props.stageTransform.scale / 2;
				const screenX = iconCenterX * props.stageTransform.scale + props.stageTransform.x;
				const screenY =
					props.clusterY * props.stageTransform.scale + props.stageTransform.y;

				const centerX =
					props.roomData.room.center.x * props.stageTransform.scale +
					props.stageTransform.x;
				const centerY =
					(props.roomData.room.center.y + 30 / props.stageTransform.scale) *
						props.stageTransform.scale +
					props.stageTransform.y;

				const offsetX = screenX - centerX;
				const offsetY = screenY - centerY;

				return (
					<ClusterIconButton
						key={`${props.roomData.room.id}-${clusterData.clusterName}`}
						clusterData={clusterData}
						roomData={props.roomData}
						index={index}
						centerX={centerX}
						centerY={centerY}
						offsetX={offsetX}
						offsetY={offsetY}
						clusterIconSize={props.clusterIconSize}
						isCollapsing={props.isCollapsing}
						handleClusterClick={props.handleClusterClick}
						handleClusterAction={props.handleClusterAction}
					/>
				);
			})}
		</>
	);
};

interface RoomExpandButtonProps {
	roomData: {
		room: { id: string; center: { x: number; y: number } };
		roomTemperature: number | null;
		roomEnergy: number | null;
		clusterInfo: Array<{ clusterName: DeviceClusterName; icon: IncludedIconNames | null }>;
	};
	stageTransform: { x: number; y: number; scale: number };
	expandedRoomIdData: Data<string | null>;
	collapsingRoomIdData: Data<string | null>;
	isDraggingRef: React.MutableRefObject<boolean>;
	temperatureExpanded: boolean;
	energyExpanded: boolean;
	hideClusterButtons: boolean;
}

const RoomExpandButton = React.memo((props: RoomExpandButtonProps): JSX.Element | null => {
	const isExpanded = useData(
		props.expandedRoomIdData,
		(expandedRoomId) => expandedRoomId === props.roomData.room.id
	);

	const handleToggle = React.useCallback(() => {
		if (!props.isDraggingRef.current) {
			if (props.expandedRoomIdData.current() === props.roomData.room.id) {
				props.collapsingRoomIdData.set(props.roomData.room.id);
				setTimeout(() => {
					props.expandedRoomIdData.set(null);
					props.collapsingRoomIdData.set(null);
				}, 200);
			} else {
				props.expandedRoomIdData.set(props.roomData.room.id);
			}
		}
	}, [
		props.expandedRoomIdData,
		props.isDraggingRef,
		props.roomData.room.id,
		props.collapsingRoomIdData,
	]);

	if (props.roomData.clusterInfo.length === 0) {
		return null;
	}

	let expandedContent = null;
	if (props.temperatureExpanded && props.roomData.roomTemperature !== null) {
		expandedContent = `${Math.round(props.roomData.roomTemperature * 10) / 10}°`;
	}

	// Hide cluster buttons when device icons are shown (but not when temperature/energy mode is active)
	if (props.hideClusterButtons && !expandedContent) {
		return null;
	}
	if (props.energyExpanded && props.roomData.roomEnergy !== null) {
		expandedContent = `${Math.round(props.roomData.roomEnergy * 10) / 10}W`;
	}
	return (
		<Box
			key={`${props.roomData.room.id}-ellipsis`}
			sx={{
				position: 'absolute',
				left:
					props.roomData.room.center.x * props.stageTransform.scale +
					props.stageTransform.x -
					24,
				top:
					(props.roomData.room.center.y + 30 / props.stageTransform.scale) *
						props.stageTransform.scale +
					props.stageTransform.y -
					24,
				width: 48,
				height: 48,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				pointerEvents: 'auto',
				transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
				opacity: expandedContent ? 1 : props.roomData.clusterInfo.length > 0 ? 1 : 0,
				transform: expandedContent ? 'scale(1)' : 'scale(0.8)',
			}}
		>
			{expandedContent && !isExpanded ? (
				<Box
					sx={{
						width: 48,
						height: 48,
						backgroundColor: 'rgba(255, 255, 255, 0.95)',
						borderRadius: '50%',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
						transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
						animation: 'fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
						'@keyframes fadeInScale': {
							from: {
								opacity: 0,
								transform: 'scale(0.5)',
							},
							to: {
								opacity: 1,
								transform: 'scale(1)',
							},
						},
						'&:hover': {
							backgroundColor: '#ffffff',
							transform: 'scale(1.1)',
						},
					}}
				>
					<Typography
						sx={{
							fontSize: '14px',
							fontWeight: 600,
							color: 'rgba(0, 0, 0, 0.87)',
						}}
					>
						{expandedContent}
					</Typography>
				</Box>
			) : (
				<IconButton
					sx={{
						width: 48,
						height: 48,
						backgroundColor: 'rgba(255, 255, 255, 0.9)',
						color: 'rgba(0, 0, 0, 0.6)',
						fontSize: '20px',
						fontWeight: 'bold',
						opacity: 1,
						transform: 'scale(1)',
						transition: 'opacity 200ms ease-out, transform 200ms ease-out',
						'&:hover': {
							backgroundColor: '#ffffff',
							transform: 'scale(1.1)',
						},
					}}
					onClick={(e) => {
						e.stopPropagation();
						handleToggle();
					}}
					onPointerDown={(e) => {
						e.stopPropagation();
						e.preventDefault();
						handleToggle();
					}}
					onTouchStart={(e) => {
						e.stopPropagation();
						e.preventDefault();
						handleToggle();
					}}
				>
					...
				</IconButton>
			)}
		</Box>
	);
});

interface EllipsisFadeOutButtonProps {
	roomId: string;
	stageTransform: { x: number; y: number; scale: number };
	roomCenter: { x: number; y: number };
}

const EllipsisFadeOutButton = React.memo((props: EllipsisFadeOutButtonProps): JSX.Element => {
	return (
		<IconButton
			key={`${props.roomId}-ellipsis-fading`}
			sx={{
				position: 'absolute',
				left: props.roomCenter.x * props.stageTransform.scale + props.stageTransform.x - 24,
				top:
					(props.roomCenter.y + 30 / props.stageTransform.scale) *
						props.stageTransform.scale +
					props.stageTransform.y -
					24,
				width: 48,
				height: 48,
				backgroundColor: 'rgba(255, 255, 255, 0.9)',
				color: 'rgba(0, 0, 0, 0.6)',
				pointerEvents: 'none',
				fontSize: '20px',
				fontWeight: 'bold',
				opacity: 1,
				transform: 'scale(1)',
				animation: `ellipsisFadeOut-${props.roomId} 200ms ease-out forwards`,
				[`@keyframes ellipsisFadeOut-${props.roomId}`]: {
					'0%': {
						opacity: 1,
						transform: 'scale(1)',
					},
					'100%': {
						opacity: 0,
						transform: 'scale(0.8)',
					},
				},
			}}
		>
			...
		</IconButton>
	);
});

interface RoomOverlayProps {
	roomData: {
		room: { id: string; center: { x: number; y: number } };
		mappedRoomName: string;
		roomInfo: RoomInfo | undefined;
		roomDevices: DeviceListWithValuesResponse;
		clusterInfo: Array<{ clusterName: DeviceClusterName; icon: IncludedIconNames | null }>;
		roomTemperature: number | null;
		roomEnergy: number | null;
	};
	stageTransform: { x: number; y: number; scale: number };
	expandedRoomIdData: Data<string | null>;
	collapsingRoomIdData: Data<string | null>;
	isDraggingRef: React.MutableRefObject<boolean>;
	temperatureExpanded: boolean;
	energyExpanded: boolean;
	hideClusterButtons: boolean;
	clusterIconSize: number;
	clusterIconSpacing: number;
	clusterStartX: number;
	clusterY: number;
	handleClusterClick: (clusterName: DeviceClusterName, roomName: string) => void;
	handleClusterAction: (
		clusterName: DeviceClusterName,
		roomDevices: DeviceListWithValuesResponse
	) => Promise<void>;
}

const RoomOverlay = React.memo((props: RoomOverlayProps): JSX.Element => {
	const isExpanded = useData(
		props.expandedRoomIdData,
		(expandedRoomId) => expandedRoomId === props.roomData.room.id
	);
	const isCollapsing = useData(
		props.collapsingRoomIdData,
		(collapsingRoomId) => collapsingRoomId === props.roomData.room.id
	);

	return (
		<React.Fragment key={`overlay-${props.roomData.room.id}`}>
			{/* Room icon */}
			{props.roomData.roomInfo?.icon && (
				<Box
					sx={{
						position: 'absolute',
						left:
							props.roomData.room.center.x * props.stageTransform.scale +
							props.stageTransform.x -
							16,
						top:
							props.roomData.room.center.y * props.stageTransform.scale +
							props.stageTransform.y -
							16,
						color: 'rgba(0, 0, 0, 0.6)',
						fontSize: '32px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						pointerEvents: 'none',
					}}
				>
					<IconComponent iconName={props.roomData.roomInfo.icon} />
				</Box>
			)}

			{/* Cluster expand button or cluster icons */}
			{isExpanded || isCollapsing ? (
				<ExpandedClusterIcons
					roomData={props.roomData}
					stageTransform={props.stageTransform}
					clusterIconSize={props.clusterIconSize}
					clusterIconSpacing={props.clusterIconSpacing}
					clusterStartX={props.clusterStartX}
					clusterY={props.clusterY}
					isCollapsing={isCollapsing}
					handleClusterClick={props.handleClusterClick}
					handleClusterAction={props.handleClusterAction}
				/>
			) : (
				<RoomExpandButton
					roomData={props.roomData}
					stageTransform={props.stageTransform}
					expandedRoomIdData={props.expandedRoomIdData}
					collapsingRoomIdData={props.collapsingRoomIdData}
					isDraggingRef={props.isDraggingRef}
					temperatureExpanded={props.temperatureExpanded}
					energyExpanded={props.energyExpanded}
					hideClusterButtons={props.hideClusterButtons}
				/>
			)}

			{/* Show "..." button fading out when expanding */}
			{isExpanded && !isCollapsing && props.roomData.clusterInfo.length > 0 && (
				<EllipsisFadeOutButton
					roomId={props.roomData.room.id}
					stageTransform={props.stageTransform}
					roomCenter={props.roomData.room.center}
				/>
			)}
		</React.Fragment>
	);
});

interface OutsideTemperatureBubbleProps {
	outsideTempData: Data<number | null>;
	wallsData: Data<WallSegment[]>;
	stageTransformData: Data<{ x: number; y: number; scale: number }>;
}

const OutsideTemperatureBubble = React.memo(
	(props: OutsideTemperatureBubbleProps): React.ReactNode => {
		const outsideTemp = useData(props.outsideTempData);
		if (!outsideTemp) {
			return null;
		}

		return <_OutsideTemperatureBubble {...props} outsideTemp={outsideTemp} />;
	}
);

const _OutsideTemperatureBubble = React.memo(
	(props: OutsideTemperatureBubbleProps & { outsideTemp: number }): React.ReactNode => {
		// Calculate position for outside temperature display (center, closest edge outside)
		const walls = useData(props.wallsData);
		const stageTransform = useData(props.stageTransformData);

		const outsideTempPosition = React.useMemo(() => {
			if (walls.length === 0) {
				return { x: 60, y: 60 }; // Default if no walls
			}

			const bbox = calculateBoundingBox(walls);
			const centerX = (bbox.minX + bbox.maxX) / 2;
			const centerY = (bbox.minY + bbox.maxY) / 2;
			const padding = 25; // Small padding outside the walls, within viewport

			// Calculate distance from center to each edge
			const distToTop = centerY - bbox.minY;
			const distToBottom = bbox.maxY - centerY;
			const distToLeft = centerX - bbox.minX;
			const distToRight = bbox.maxX - centerX;

			// Find the closest edge
			const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);

			// Place temperature bubble just outside the closest edge
			if (minDist === distToTop) {
				return { x: centerX, y: bbox.minY - padding };
			} else if (minDist === distToBottom) {
				return { x: centerX, y: bbox.maxY + padding };
			} else if (minDist === distToLeft) {
				return { x: bbox.minX - padding, y: centerY };
			} else {
				return { x: bbox.maxX + padding, y: centerY };
			}
		}, [walls]);

		// Determine background color based on temperature
		const getTemperatureColor = (temp: number): string => {
			if (temp < 10) {
				return '#E3F2FD';
			} // Light blue - cold
			if (temp < 18) {
				return '#B3E5FC';
			} // Blue - cool
			if (temp < 24) {
				return '#C8E6C9';
			} // Light green - mild
			if (temp < 30) {
				return '#FFE0B2';
			} // Light orange - warm
			return '#FFCDD2'; // Light red - hot
		};

		const getTemperatureTextColor = (temp: number): string => {
			if (temp < 10) {
				return '#0D47A1';
			} // Dark blue
			if (temp < 18) {
				return '#01579B';
			} // Blue
			if (temp < 24) {
				return '#2E7D32';
			} // Green
			if (temp < 30) {
				return '#E65100';
			} // Orange
			return '#C62828'; // Red
		};

		return (
			<Box
				sx={{
					position: 'absolute',
					left: outsideTempPosition.x * stageTransform.scale + stageTransform.x - 32,
					top: outsideTempPosition.y * stageTransform.scale + stageTransform.y - 32,
					width: 64,
					height: 64,
					borderRadius: '50%',
					backgroundColor: getTemperatureColor(props.outsideTemp),
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
					pointerEvents: 'auto',
					gap: '2px',
				}}
			>
				<WbSunny
					sx={{
						fontSize: '18px',
						color: getTemperatureTextColor(props.outsideTemp),
					}}
				/>
				<Typography
					sx={{
						fontWeight: 600,
						fontSize: '14px',
						lineHeight: 1,
						color: getTemperatureTextColor(props.outsideTemp),
					}}
				>
					{props.outsideTemp}°
				</Typography>
			</Box>
		);
	}
);

interface DeviceIconsOverlayProps {
	devices: DeviceListWithValuesResponse;
	stageTransform: { x: number; y: number; scale: number };
	focusedRoomNameData: Data<string | null>;
	zoomThreshold: number;
	temperatureExpanded: boolean;
	energyExpanded: boolean;
	isDraggingRef: React.MutableRefObject<boolean>;
	handleDeviceTap: (device: DeviceListWithValuesResponse[number]) => Promise<void>;
	handleDeviceHold: (device: DeviceListWithValuesResponse[number]) => void;
}

const DeviceIconsOverlay = React.memo((props: DeviceIconsOverlayProps): JSX.Element | null => {
	const focusedRoomName = useData(props.focusedRoomNameData);

	// Hide when temperature or energy mode is active
	if (props.temperatureExpanded || props.energyExpanded) {
		return null;
	}

	// Check if we should show devices (zoomed in enough or have a focused room)
	const showDevices =
		props.stageTransform.scale >= props.zoomThreshold || focusedRoomName !== null;

	if (!showDevices) {
		return null;
	}

	// Filter devices based on focused room if set
	const visibleDevices = focusedRoomName
		? props.devices.filter((d) => d.room === focusedRoomName)
		: props.devices;

	return (
		<>
			{visibleDevices.map((device) => (
				<DeviceIcon
					key={`device-icon-${device.uniqueId}`}
					device={device}
					position={device.position!}
					stageTransform={props.stageTransform}
					onTap={() => void props.handleDeviceTap(device)}
					onHold={() => props.handleDeviceHold(device)}
					isDragging={props.isDraggingRef.current}
				/>
			))}
		</>
	);
});

interface GroupIconsOverlayProps {
	groups: DeviceGroup[];
	devices: DeviceListWithValuesResponse;
	stageTransform: { x: number; y: number; scale: number };
	focusedRoomNameData: Data<string | null>;
	zoomThreshold: number;
	temperatureExpanded: boolean;
	energyExpanded: boolean;
	isDraggingRef: React.MutableRefObject<boolean>;
	handleGroupTap: (group: DeviceGroup) => Promise<void>;
	handleGroupHold: (group: DeviceGroup) => void;
}

const GroupIconsOverlay = React.memo((props: GroupIconsOverlayProps): JSX.Element | null => {
	const focusedRoomName = useData(props.focusedRoomNameData);

	// Hide when temperature or energy mode is active
	if (props.temperatureExpanded || props.energyExpanded) {
		return null;
	}

	// Check if we should show groups (zoomed in enough or have a focused room)
	const showGroups =
		props.stageTransform.scale >= props.zoomThreshold || focusedRoomName !== null;

	if (!showGroups) {
		return null;
	}

	// Filter groups based on focused room if set (group is visible if any of its devices are in the room)
	const visibleGroups = focusedRoomName
		? props.groups.filter((g) => {
				const groupDevices = props.devices.filter((d) => g.deviceIds.includes(d.uniqueId));
				return groupDevices.some((d) => d.room === focusedRoomName);
			})
		: props.groups;

	return (
		<>
			{visibleGroups.map((group) => (
				<GroupIcon
					key={`group-icon-${group.id}`}
					group={group}
					devices={props.devices}
					position={group.position!}
					stageTransform={props.stageTransform}
					onTap={() => void props.handleGroupTap(group)}
					onHold={() => props.handleGroupHold(group)}
					isDragging={props.isDraggingRef.current}
				/>
			))}
		</>
	);
});

interface RoomProps {
	roomData: {
		room: { id: string; polygon: { x: number; y: number }[] };
		roomInfo: RoomInfo | undefined;
		mappedRoomName: string;
	};
	hoveringRoomIdData: Data<string | null>;
	handleRoomClick: (roomName: string) => void;
	handleRoomLongPress: (roomName: string) => void;
}

const Room = React.memo((props: RoomProps): JSX.Element => {
	const { roomData, hoveringRoomIdData, handleRoomClick, handleRoomLongPress } = props;

	const isHovering = useData(
		hoveringRoomIdData,
		(hoveringRoomId) => hoveringRoomId === roomData.room.id
	);

	const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	const didHoldRef = React.useRef(false);

	const cursorPointer = React.useCallback((e: KonvaEventObject<MouseEvent>) => {
		const stage = e.target.getStage();
		if (stage) {
			stage.container().style.cursor = 'pointer';
		}
	}, []);

	const cursorDefault = React.useCallback((e: KonvaEventObject<MouseEvent>) => {
		const stage = e.target.getStage();
		if (stage) {
			stage.container().style.cursor = 'default';
		}
	}, []);

	const handleInteractionStart = React.useCallback(() => {
		hoveringRoomIdData.set(roomData.room.id);
		didHoldRef.current = false;

		// Start long press timer
		holdTimerRef.current = setTimeout(() => {
			didHoldRef.current = true;
			handleRoomLongPress(roomData.mappedRoomName);
		}, 500);
	}, [hoveringRoomIdData, roomData.room.id, roomData.mappedRoomName, handleRoomLongPress]);

	const handleInteractionEnd = React.useCallback(() => {
		hoveringRoomIdData.set(null);

		// Clear long press timer
		if (holdTimerRef.current) {
			clearTimeout(holdTimerRef.current);
			holdTimerRef.current = null;
		}

		// If didn't hold, treat as single press (zoom to room)
		if (!didHoldRef.current) {
			handleRoomClick(roomData.mappedRoomName);
		}
	}, [hoveringRoomIdData, handleRoomClick, roomData.mappedRoomName]);

	return (
		<Line
			points={roomData.room.polygon.map((p) => [p.x, p.y]).flat()}
			fill={
				roomData.roomInfo?.color
					? `${roomData.roomInfo.color}${isHovering ? 'C0' : '80'}`
					: '#00000030'
			}
			stroke={roomData.roomInfo?.color || '#ccc'}
			strokeWidth={2}
			closed
			onMouseOver={cursorPointer}
			onMouseOut={cursorDefault}
			onMouseDown={handleInteractionStart}
			onMouseUp={handleInteractionEnd}
			onTouchStart={handleInteractionStart}
			onTouchEnd={handleInteractionEnd}
		/>
	);
});

export const HomeLayoutView = (props: HomeLayoutViewProps): JSX.Element => {
	const wallsData = useCreateData<WallSegment[]>([]);
	const walls = useData(wallsData);
	const [doors, setDoors] = useState<DoorSlot[]>([]);
	const [roomMappings, setRoomMappings] = useState<Record<string, string>>({});
	const [availableRooms, setAvailableRooms] = useState<Record<string, RoomInfo>>({});
	const [groups, setGroups] = useState<DeviceGroup[]>([]);
	const stageRef = React.useRef<StageType | null>(null);
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const isDraggingRef = React.useRef<boolean>(false);
	const dragStartPos = React.useRef<{ x: number; y: number } | null>(null);
	const touchStartPos = React.useRef<{ x: number; y: number } | null>(null);

	const expandedRoomIdData = useCreateData<string | null>(null);
	const collapsingRoomIdData = useCreateData<string | null>(null);
	const outsideTempData = useCreateData<number | null>(null);
	const hoveringRoomIdData = useCreateData<string | null>(null);
	const focusedRoomNameData = useCreateData<string | null>(null);

	// Zoom level threshold for showing device icons (devices visible when zoomed in beyond this)
	const DEVICE_VISIBILITY_ZOOM_THRESHOLD = 1.5;

	const stageTransformData = useCreateData<{ x: number; y: number; scale: number }>({
		x: 0,
		y: 0,
		scale: 1,
	});
	const stageTransform = useData(stageTransformData);
	const lastDist = React.useRef<number>(0);
	const lastCenter = React.useRef<{ x: number; y: number } | null>(null);
	const isPinching = React.useRef<boolean>(false);
	const isPanning = React.useRef<boolean>(false);
	const lastTouchPos = React.useRef<{ x: number; y: number } | null>(null);
	const DRAG_THRESHOLD = 20; // pixels

	const width = window.innerWidth > 900 ? window.innerWidth - 240 : window.innerWidth;
	const height = window.innerHeight - props.verticalSpacing;

	const loadLayout = React.useCallback(async () => {
		try {
			const response = await apiGet('device', '/layout', {});
			if (response.ok) {
				const data = await response.json();
				if (data.layout) {
					wallsData.set(data.layout.walls || []);
					setDoors(data.layout.doors || []);
					setRoomMappings(data.layout.roomMappings || {});
				}
			}
		} catch (error) {
			console.error('Failed to load layout:', error);
		}
	}, [wallsData]);

	const loadRooms = React.useCallback(async () => {
		try {
			const response = await apiGet('device', '/rooms', {});
			if (response.ok) {
				const data = await response.json();
				setAvailableRooms(data.rooms);
			}
		} catch (error) {
			console.error('Failed to load rooms:', error);
		}
	}, []);

	const loadGroups = React.useCallback(async () => {
		try {
			const response = await apiGet('device', '/groups/list', {});
			if (response.ok) {
				const data = await response.json();
				setGroups(data.groups || []);
			}
		} catch (error) {
			console.error('Failed to load groups:', error);
		}
	}, []);

	// Load layout, rooms, and groups on mount
	useEffect(() => {
		void loadLayout();
		void loadRooms();
		void loadGroups();
	}, [loadRooms, loadLayout, loadGroups]);

	// Fetch outside temperature periodically
	useEffect(() => {
		const fetchOutsideTemp = async () => {
			try {
				const response = await apiGet('temperature', '/outside-temperature', {});
				if (response.ok) {
					const data = await response.json();
					if (data.success) {
						outsideTempData.set(data.temperature);
					}
				}
			} catch (error) {
				console.error('Failed to fetch outside temperature:', error);
			}
		};

		void fetchOutsideTemp();
		const interval = setInterval(() => {
			void fetchOutsideTemp();
		}, 600000); // Refresh every 10 minutes

		return () => clearInterval(interval);
	}, [outsideTempData]);

	const detectedRooms = React.useMemo(() => {
		return detectRooms(walls, width, height);
	}, [walls, width, height]);

	// Calculate initial zoom to fit all walls with padding
	useEffect(() => {
		if (stageRef.current && walls.length > 0) {
			const bbox = calculateBoundingBox(walls);
			const paddingHorizontal = 40;
			const paddingTop = 40;
			const paddingBottom = 40;
			const scaleX = (width - paddingHorizontal * 2) / bbox.width;
			const scaleY = (height - (paddingTop + paddingBottom)) / bbox.height;
			// Allow zooming beyond 1:1 on large screens, but cap at reasonable maximum
			const maxScale = window.innerWidth >= 900 ? 2 : 1;
			const scale = Math.min(scaleX, scaleY, maxScale);

			const posX = (width - bbox.width * scale) / 2 - bbox.minX * scale;
			const posY =
				(height - (paddingTop + paddingBottom) - bbox.height * scale) / 2 -
				bbox.minY * scale;

			stageRef.current.scale({ x: scale, y: scale });
			// Center the content
			stageRef.current.position({
				x: posX,
				y: posY,
			});
			stageTransformData.set({ x: posX, y: posY, scale });
		}
	}, [walls, width, height, props.kiosk, stageTransformData]);

	// Update stage transform state on pan/zoom
	const updateStageTransform = React.useCallback(() => {
		if (stageRef.current) {
			const pos = stageRef.current.position();
			const scale = stageRef.current.scaleX();
			stageTransformData.set({ x: pos.x, y: pos.y, scale });

			// Clear focused room when zoomed out below threshold
			if (scale < DEVICE_VISIBILITY_ZOOM_THRESHOLD && focusedRoomNameData.current()) {
				focusedRoomNameData.set(null);
			}
		}
	}, [stageTransformData, focusedRoomNameData]);

	const handleWheel = React.useCallback(
		(e: KonvaEventObject<WheelEvent>) => {
			e.evt.preventDefault();

			const stage = stageRef.current;
			if (!stage) {
				return;
			}
			const oldScale = stage.scaleX();
			const pointer = stage.getPointerPosition();
			if (!pointer) {
				return;
			}

			const mousePointTo = {
				x: (pointer.x - stage.x()) / oldScale,
				y: (pointer.y - stage.y()) / oldScale,
			};

			let direction = e.evt.deltaY > 0 ? -1 : 1;

			if (e.evt.ctrlKey) {
				direction = -direction;
			}

			const scaleBy = 1.05;
			const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

			stage.scale({ x: newScale, y: newScale });

			const newPos = {
				x: pointer.x - mousePointTo.x * newScale,
				y: pointer.y - mousePointTo.y * newScale,
			};
			stage.position(newPos);
			updateStageTransform();
		},
		[updateStageTransform]
	);

	const handleStageMouseDown = React.useCallback(
		(e: KonvaEventObject<MouseEvent> | KonvaEventObject<TouchEvent>) => {
			const stage = e.target.getStage();
			if (stage) {
				const pos = stage.getPointerPosition();
				if (pos) {
					dragStartPos.current = { x: pos.x, y: pos.y };
				}
			}
			isDraggingRef.current = false;
		},
		[]
	);

	const handleStageMouseUp = React.useCallback(() => {
		if (!isDraggingRef.current) {
			// Close expanded clusters if clicking on stage background
			collapsingRoomIdData.set(expandedRoomIdData.current());
			setTimeout(() => {
				expandedRoomIdData.set(null);
				collapsingRoomIdData.set(null);
			}, 200);
		}
		dragStartPos.current = null;
		setTimeout(() => (isDraggingRef.current = false), 50); // Small delay to allow click events to check drag state
		updateStageTransform();
	}, [updateStageTransform, collapsingRoomIdData, expandedRoomIdData]);

	const handleStageDragEnd = React.useCallback(() => {
		updateStageTransform();
	}, [updateStageTransform]);

	const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
		return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
	};

	const getCenter = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
		return {
			x: (p1.x + p2.x) / 2,
			y: (p1.y + p2.y) / 2,
		};
	};

	const handleTouchMove = React.useCallback(
		(e: KonvaEventObject<TouchEvent>) => {
			const stage = stageRef.current;
			if (!stage) {
				return;
			}

			const touch1 = e.evt.touches[0];
			const touch2 = e.evt.touches[1];

			if (touch1 && touch2) {
				// Pinch gesture with two touches - prevent default and disable dragging
				e.evt.preventDefault();
				isPinching.current = true;
				stage.draggable(false);

				const p1 = { x: touch1.clientX, y: touch1.clientY };
				const p2 = { x: touch2.clientX, y: touch2.clientY };

				const newCenter = getCenter(p1, p2);
				const dist = getDistance(p1, p2);

				if (lastDist.current === 0) {
					lastDist.current = dist;
					lastCenter.current = newCenter;
					return;
				}

				const oldScale = stage.scaleX();
				const pointTo = {
					x: (newCenter.x - stage.x()) / oldScale,
					y: (newCenter.y - stage.y()) / oldScale,
				};

				const scale = oldScale * (dist / lastDist.current);
				stage.scale({ x: scale, y: scale });

				const newPos = {
					x: newCenter.x - pointTo.x * scale,
					y: newCenter.y - pointTo.y * scale,
				};
				stage.position(newPos);

				lastDist.current = dist;
				lastCenter.current = newCenter;
				updateStageTransform();
			} else if (touch1 && touchStartPos.current) {
				// Single touch - check if movement exceeds threshold before enabling drag
				const currentPos = { x: touch1.clientX, y: touch1.clientY };
				const distance = getDistance(touchStartPos.current, currentPos);

				if (distance > DRAG_THRESHOLD) {
					// Movement exceeds threshold - this is a drag, manually handle panning
					e.evt.preventDefault();
					if (!isPanning.current) {
						// Start panning - record initial position
						isPanning.current = true;
						lastTouchPos.current = currentPos;
						isDraggingRef.current = true;
					} else if (lastTouchPos.current) {
						// Continue panning - calculate delta and update stage position
						const deltaX = currentPos.x - lastTouchPos.current.x;
						const deltaY = currentPos.y - lastTouchPos.current.y;
						const currentPos_stage = stage.position();
						stage.position({
							x: currentPos_stage.x + deltaX,
							y: currentPos_stage.y + deltaY,
						});
						lastTouchPos.current = currentPos;
						updateStageTransform();
					}
				}
			} else if (isPinching.current) {
				// If we were pinching but now only have one touch, prevent default to avoid drag
				e.evt.preventDefault();
			}
		},
		[updateStageTransform]
	);

	const handleTouchEnd = React.useCallback((e: KonvaEventObject<TouchEvent>) => {
		const stage = stageRef.current;
		if (e.evt.touches.length === 0) {
			// All touches ended - reset all gesture states
			lastDist.current = 0;
			lastCenter.current = null;
			isPinching.current = false;
			isPanning.current = false;
			touchStartPos.current = null;
			lastTouchPos.current = null;
			if (stage) {
				stage.draggable(true);
			}
			// Reset dragging state after a short delay to allow tap events to check it
			setTimeout(() => (isDraggingRef.current = false), 50);
		} else if (e.evt.touches.length === 1 && isPinching.current) {
			// One finger lifted during pinch - reset pinch state and prepare for potential pan
			lastDist.current = 0;
			lastCenter.current = null;
			isPinching.current = false;
			// Record new touch start position for potential pan
			const touch = e.evt.touches[0];
			touchStartPos.current = { x: touch.clientX, y: touch.clientY };
			lastTouchPos.current = null;
			if (stage) {
				stage.draggable(false);
			}
		} else if (e.evt.touches.length === 1 && touchStartPos.current) {
			// Single touch ended - reset pan state
			isPanning.current = false;
			lastTouchPos.current = null;
			touchStartPos.current = null;
			if (stage) {
				stage.draggable(true);
			}
		}
	}, []);

	const handleTouchStart = React.useCallback(
		(e: KonvaEventObject<TouchEvent>) => {
			const stage = stageRef.current;
			if (e.evt.touches.length === 2) {
				// Two finger touch - prepare for pinch zoom
				e.evt.preventDefault();
				isPinching.current = true;
				if (stage) {
					stage.draggable(false);
				}
				const touch1 = e.evt.touches[0];
				const touch2 = e.evt.touches[1];
				const p1 = { x: touch1.clientX, y: touch1.clientY };
				const p2 = { x: touch2.clientX, y: touch2.clientY };
				lastDist.current = getDistance(p1, p2);
				lastCenter.current = getCenter(p1, p2);
			} else if (e.evt.touches.length === 1 && !isPinching.current) {
				// Single touch - temporarily disable dragging to detect taps
				// Dragging will be enabled in handleTouchMove if movement exceeds threshold
				if (stage) {
					stage.draggable(false);
				}
				// Record start position for drag detection
				const touch = e.evt.touches[0];
				touchStartPos.current = { x: touch.clientX, y: touch.clientY };
				isDraggingRef.current = false;
				handleStageMouseDown(e);
			} else if (isPinching.current) {
				// If we're in pinch mode, prevent default to avoid interference
				e.evt.preventDefault();
			}
		},
		[handleStageMouseDown]
	);

	// Group devices by room and calculate cluster representations
	const roomsWithClusters = React.useMemo(() => {
		return detectedRooms
			.filter((room) => roomMappings[room.id])
			.map((room) => {
				const mappedRoomName = roomMappings[room.id];
				const roomInfo = availableRooms[mappedRoomName];
				const roomDevices = props.devices.filter((d) => d.room === mappedRoomName);

				// Find which clusters are represented in this room
				const allClusters = new Set<DeviceClusterName>();
				for (const device of roomDevices) {
					for (const cluster of device.mergedAllClusters) {
						allClusters.add(cluster.name);
					}
				}

				// Filter to only relevant clusters (matching ClusterIconButton behavior)
				const representedClusters = getRelevantClusters(Array.from(allClusters));

				// Build cluster info with icons
				const clusterInfo = representedClusters.map((clusterName) => {
					// Find a device with this cluster to get the icon
					let icon: IncludedIconNames | null = null;
					for (const device of roomDevices) {
						for (const cluster of device.mergedAllClusters) {
							if (cluster.name === clusterName && cluster.icon) {
								icon = cluster.icon;
								break;
							}
							// Special case for ON_OFF merged into COLOR_CONTROL
							if (
								clusterName === DeviceClusterName.ON_OFF &&
								cluster.name === DeviceClusterName.COLOR_CONTROL &&
								cluster.mergedClusters[DeviceClusterName.ON_OFF]?.icon
							) {
								icon = cluster.mergedClusters[DeviceClusterName.ON_OFF].icon;
								break;
							}
						}
						if (icon) {
							break;
						}
					}
					return { clusterName, icon };
				});

				// Find temperature sensor in this room
				let roomTemperature: number | null = null;
				let roomEnergy: number | null = null;
				for (const device of roomDevices) {
					for (const cluster of device.flatAllClusters) {
						if (cluster.name === DeviceClusterName.TEMPERATURE_MEASUREMENT) {
							roomTemperature = cluster.temperature;
						}
						if (cluster.name === DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT) {
							roomEnergy ??= 0;
							roomEnergy += cluster.activePower;
						}
					}
				}

				return {
					room,
					mappedRoomName,
					roomInfo,
					roomDevices,
					representedClusters,
					clusterInfo,
					roomTemperature,
					roomEnergy,
				};
			});
	}, [detectedRooms, roomMappings, availableRooms, props.devices]);

	// Zoom to a specific room
	const zoomToRoom = React.useCallback(
		(roomName: string) => {
			const roomData = roomsWithClusters.find((r) => r.mappedRoomName === roomName);
			if (!roomData || !stageRef.current) {
				return;
			}

			// Calculate room bounding box from polygon
			const polygon = roomData.room.polygon;
			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;

			for (const point of polygon) {
				minX = Math.min(minX, point.x);
				minY = Math.min(minY, point.y);
				maxX = Math.max(maxX, point.x);
				maxY = Math.max(maxY, point.y);
			}

			const roomWidth = maxX - minX;
			const roomHeight = maxY - minY;
			const roomCenterX = (minX + maxX) / 2;
			const roomCenterY = (minY + maxY) / 2;

			// Calculate scale to fit room with padding
			const padding = 60;
			const scaleX = (width - padding * 2) / roomWidth;
			const scaleY = (height - padding * 2) / roomHeight;
			const targetScale = Math.min(scaleX, scaleY, 3); // Cap at 3x zoom

			// Calculate position to center the room
			const targetX = width / 2 - roomCenterX * targetScale;
			const targetY = height / 2 - roomCenterY * targetScale;

			// Animate zoom (simple version - direct set)
			stageRef.current.scale({ x: targetScale, y: targetScale });
			stageRef.current.position({ x: targetX, y: targetY });
			stageTransformData.set({ x: targetX, y: targetY, scale: targetScale });

			// Set focused room to show devices
			focusedRoomNameData.set(roomName);
		},
		[roomsWithClusters, width, height, stageTransformData, focusedRoomNameData]
	);

	const handleRoomClick = React.useCallback(
		(roomName: string) => {
			// Close expanded clusters
			expandedRoomIdData.set(null);
			// Only zoom if we didn't drag
			if (!isDraggingRef.current) {
				zoomToRoom(roomName);
			}
		},
		[expandedRoomIdData, zoomToRoom]
	);

	const pushDetailViewForRoom = props.pushDetailView;
	const handleRoomLongPress = React.useCallback(
		(roomName: string) => {
			// Navigate to room detail view on long press
			pushDetailViewForRoom({
				type: 'room',
				roomName: roomName,
			});
		},
		[pushDetailViewForRoom]
	);

	const handleClusterClick = (clusterName: DeviceClusterName, roomName: string) => {
		// Navigate to cluster detail view
		props.pushDetailView({
			type: 'room',
			roomName: roomName,
			clustersName: clusterName,
		});
	};

	const handleClusterAction = async (
		clusterName: DeviceClusterName,
		roomDevices: DeviceListWithValuesResponse
	) => {
		// Execute cluster action (short press behavior)
		if (clusterName === DeviceClusterName.ON_OFF) {
			const devices = roomDevices.filter((device) =>
				device.mergedAllClusters.some(
					(c) =>
						c.name === DeviceClusterName.ON_OFF ||
						(c.name === DeviceClusterName.COLOR_CONTROL &&
							c.mergedClusters[DeviceClusterName.ON_OFF])
				)
			);
			const anyEnabled = devices
				.flatMap((d) => d.mergedAllClusters)
				.some(
					(d) =>
						(d.name === DeviceClusterName.ON_OFF && d.isOn) ||
						(d.name === DeviceClusterName.COLOR_CONTROL &&
							d.mergedClusters[DeviceClusterName.ON_OFF]?.isOn)
				);

			await apiPost(
				'device',
				'/cluster/OnOff',
				{},
				{
					deviceIds: devices.map((d) => d.uniqueId),
					isOn: !anyEnabled,
				}
			);
			props.invalidate();
		} else if (clusterName === DeviceClusterName.WINDOW_COVERING) {
			const devices = roomDevices.filter((device) =>
				device.mergedAllClusters.some((c) => c.name === DeviceClusterName.WINDOW_COVERING)
			);
			const anyEnabled = devices
				.flatMap((d) => d.mergedAllClusters)
				.filter((c) => c.name === DeviceClusterName.WINDOW_COVERING)
				.some((d) => d.targetPositionLiftPercentage < 5);

			await apiPost(
				'device',
				'/cluster/WindowCovering',
				{},
				{
					deviceIds: devices.map((d) => d.uniqueId),
					targetPositionLiftPercentage: anyEnabled ? 100 : 0,
				}
			);
			props.invalidate();
		} else if (clusterName === DeviceClusterName.COLOR_CONTROL) {
			// For color control, go directly to detail view (same as ClusterIconButton)
			// We'll handle this in the touch logic
		}
	};

	// Get devices that have positions set
	const devicesWithPositions = React.useMemo(() => {
		return props.devices.filter((device) => device.position !== undefined);
	}, [props.devices]);

	// Handle device tap (toggle on/off)
	const invalidate = props.invalidate;
	const handleDeviceTap = React.useCallback(
		async (device: DeviceListWithValuesResponse[number]) => {
			// Find OnOff cluster (either directly or via ColorControl)
			const onOffCluster = device.mergedAllClusters.find(
				(c) => c.name === DeviceClusterName.ON_OFF
			);
			const colorControlCluster = device.mergedAllClusters.find(
				(c) =>
					c.name === DeviceClusterName.COLOR_CONTROL &&
					(c as DashboardDeviceClusterColorControl).mergedClusters?.[
						DeviceClusterName.ON_OFF
					]
			);

			if (onOffCluster || colorControlCluster) {
				const isCurrentlyOn = onOffCluster
					? onOffCluster.isOn
					: (colorControlCluster as DashboardDeviceClusterColorControl)?.mergedClusters[
							DeviceClusterName.ON_OFF
						]?.isOn;

				await apiPost(
					'device',
					'/cluster/OnOff',
					{},
					{
						deviceIds: [device.uniqueId],
						isOn: !isCurrentlyOn,
					}
				);
				invalidate();
			}

			// Handle window covering toggle
			const windowCoveringCluster = device.mergedAllClusters.find(
				(c) => c.name === DeviceClusterName.WINDOW_COVERING
			);
			if (windowCoveringCluster && !onOffCluster && !colorControlCluster) {
				const isOpen = windowCoveringCluster.targetPositionLiftPercentage < 5;
				await apiPost(
					'device',
					'/cluster/WindowCovering',
					{},
					{
						deviceIds: [device.uniqueId],
						targetPositionLiftPercentage: isOpen ? 100 : 0,
					}
				);
				invalidate();
			}
		},
		[invalidate]
	);

	// Handle device hold (navigate to detail)
	const pushDetailView = props.pushDetailView;
	const handleDeviceHold = React.useCallback(
		(device: DeviceListWithValuesResponse[number]) => {
			// Find primary cluster for detail view
			const primaryCluster =
				device.mergedAllClusters.find((c) => c.name === DeviceClusterName.COLOR_CONTROL) ||
				device.mergedAllClusters.find((c) => c.name === DeviceClusterName.ON_OFF) ||
				device.mergedAllClusters.find(
					(c) => c.name === DeviceClusterName.WINDOW_COVERING
				) ||
				device.mergedAllClusters[0];

			if (primaryCluster) {
				pushDetailView({
					type: 'device',
					deviceId: device.uniqueId,
					clusterName: primaryCluster.name,
				});
			}
		},
		[pushDetailView]
	);

	// Handle group tap (toggle all devices in group)
	const handleGroupTap = React.useCallback(
		async (group: DeviceGroup) => {
			const groupDevices = props.devices.filter((d) => group.deviceIds.includes(d.uniqueId));

			// Check if any device in group is on
			let anyOn = false;
			for (const device of groupDevices) {
				const onOffCluster = device.mergedAllClusters.find(
					(c) => c.name === DeviceClusterName.ON_OFF
				);
				const colorControlCluster = device.mergedAllClusters.find(
					(c) =>
						c.name === DeviceClusterName.COLOR_CONTROL &&
						(c as DashboardDeviceClusterColorControl).mergedClusters?.[
							DeviceClusterName.ON_OFF
						]
				);

				if (
					onOffCluster?.isOn ||
					(colorControlCluster as DashboardDeviceClusterColorControl)?.mergedClusters[
						DeviceClusterName.ON_OFF
					]?.isOn
				) {
					anyOn = true;
					break;
				}
			}

			// Toggle all controllable devices in group
			const controllableDeviceIds = groupDevices
				.filter((d) =>
					d.mergedAllClusters.some(
						(c) =>
							c.name === DeviceClusterName.ON_OFF ||
							(c.name === DeviceClusterName.COLOR_CONTROL &&
								(c as DashboardDeviceClusterColorControl).mergedClusters?.[
									DeviceClusterName.ON_OFF
								])
					)
				)
				.map((d) => d.uniqueId);

			if (controllableDeviceIds.length > 0) {
				await apiPost(
					'device',
					'/cluster/OnOff',
					{},
					{
						deviceIds: controllableDeviceIds,
						isOn: !anyOn,
					}
				);
				invalidate();
			}
		},
		[props.devices, invalidate]
	);

	// Handle group hold (navigate to group detail)
	const handleGroupHold = React.useCallback(
		(group: DeviceGroup) => {
			pushDetailView({
				type: 'group',
				groupId: group.id,
			});
		},
		[pushDetailView]
	);

	// Get groups that have positions set
	const groupsWithPositions = React.useMemo(() => {
		return groups.filter((group) => group.position !== undefined);
	}, [groups]);

	return (
		<Box
			ref={containerRef}
			sx={{
				height: '100%',
				width: '100%',
				display: 'flex',
				flexDirection: 'column',
				position: 'relative',
				overflow: 'hidden',
			}}
		>
			<Stage
				ref={stageRef}
				width={width}
				height={height}
				style={{
					touchAction: 'none',
				}}
				onWheel={handleWheel}
				onMouseDown={handleStageMouseDown}
				onMouseUp={handleStageMouseUp}
				onDragEnd={handleStageDragEnd}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				draggable={true}
			>
				<Layer>
					{/* Walls */}
					{walls.map((wall) => (
						<Line
							key={wall.id}
							points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
							stroke={WALL_COLOR}
							strokeWidth={WALL_THICKNESS}
						/>
					))}

					{/* Doors */}
					{doors.map((door) => (
						<Line
							key={door.id}
							points={[door.start.x, door.start.y, door.end.x, door.end.y]}
							stroke="#FFF"
							opacity={0.8}
							globalCompositeOperation="destination-out"
							strokeWidth={WALL_THICKNESS + 1}
						/>
					))}
				</Layer>

				<Layer>
					{/* Rooms */}
					{roomsWithClusters.map((roomData) => {
						return (
							<Room
								key={roomData.room.id}
								roomData={roomData}
								hoveringRoomIdData={hoveringRoomIdData}
								handleRoomClick={handleRoomClick}
								handleRoomLongPress={handleRoomLongPress}
							/>
						);
					})}
				</Layer>
			</Stage>

			{/* Overlay for SVG icons */}
			<Box
				sx={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: width,
					height: height,
					pointerEvents: 'none',
					overflow: 'hidden',
				}}
			>
				{roomsWithClusters.map((roomData) => {
					// Calculate cluster icon positions
					const clusterIconSize = 48;
					const clusterIconSpacingScreen = 56; // spacing in screen space
					const clusterIconSpacing = clusterIconSpacingScreen / stageTransform.scale; // convert to world space
					const totalClusterWidth =
						roomData.clusterInfo.length * clusterIconSpacing -
						(roomData.clusterInfo.length > 0
							? clusterIconSpacing - clusterIconSize / stageTransform.scale
							: 0);
					const clusterStartX = roomData.room.center.x - totalClusterWidth / 2;
					const clusterY = roomData.room.center.y + 30 / stageTransform.scale;

					// Hide cluster buttons when device icons are shown (but not in temperature/energy mode)
					const hideClusterButtons =
						devicesWithPositions.length > 0 &&
						!props.temperatureExpanded &&
						!props.energyExpanded;

					return (
						<RoomOverlay
							key={`overlay-${roomData.room.id}`}
							roomData={roomData}
							stageTransform={stageTransform}
							expandedRoomIdData={expandedRoomIdData}
							collapsingRoomIdData={collapsingRoomIdData}
							isDraggingRef={isDraggingRef}
							temperatureExpanded={props.temperatureExpanded}
							energyExpanded={props.energyExpanded}
							hideClusterButtons={hideClusterButtons}
							clusterIconSize={clusterIconSize}
							clusterIconSpacing={clusterIconSpacing}
							clusterStartX={clusterStartX}
							clusterY={clusterY}
							handleClusterClick={handleClusterClick}
							handleClusterAction={handleClusterAction}
						/>
					);
				})}

				{/* Individual device icons - shown when zoomed into a room or above zoom threshold */}
				<DeviceIconsOverlay
					devices={devicesWithPositions}
					stageTransform={stageTransform}
					focusedRoomNameData={focusedRoomNameData}
					zoomThreshold={DEVICE_VISIBILITY_ZOOM_THRESHOLD}
					temperatureExpanded={props.temperatureExpanded}
					energyExpanded={props.energyExpanded}
					isDraggingRef={isDraggingRef}
					handleDeviceTap={handleDeviceTap}
					handleDeviceHold={handleDeviceHold}
				/>

				{/* Group icons - shown when zoomed into a room or above zoom threshold */}
				<GroupIconsOverlay
					groups={groupsWithPositions}
					devices={props.devices}
					stageTransform={stageTransform}
					focusedRoomNameData={focusedRoomNameData}
					zoomThreshold={DEVICE_VISIBILITY_ZOOM_THRESHOLD}
					temperatureExpanded={props.temperatureExpanded}
					energyExpanded={props.energyExpanded}
					isDraggingRef={isDraggingRef}
					handleGroupTap={handleGroupTap}
					handleGroupHold={handleGroupHold}
				/>

				<OutsideTemperatureBubble
					outsideTempData={outsideTempData}
					wallsData={wallsData}
					stageTransformData={stageTransformData}
				/>
			</Box>
		</Box>
	);
};

function calculateBoundingBox(walls: WallSegment[]): {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	width: number;
	height: number;
} {
	if (walls.length === 0) {
		return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
	}

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const wall of walls) {
		minX = Math.min(minX, wall.start.x, wall.end.x);
		minY = Math.min(minY, wall.start.y, wall.end.y);
		maxX = Math.max(maxX, wall.start.x, wall.end.x);
		maxY = Math.max(maxY, wall.start.y, wall.end.y);
	}

	return {
		minX,
		minY,
		maxX,
		maxY,
		width: maxX - minX,
		height: maxY - minY,
	};
}
