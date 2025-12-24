import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type { DeviceGroup } from '../../../../types/group';
import { Box, IconButton } from '@mui/material';
import type { IncludedIconNames } from './icon';
import { IconComponent } from './icon';
import React from 'react';

export interface GroupIconProps {
	group: DeviceGroup;
	devices: DeviceListWithValuesResponse; // All devices (to filter by group.deviceIds)
	position: { x: number; y: number };
	stageTransform: { x: number; y: number; scale: number };
	onTap: () => void;
	onHold: () => void;
	isDraggingData: boolean;
}

// Check if any device in the group is "on"
const isGroupOn = (group: DeviceGroup, devices: DeviceListWithValuesResponse): boolean => {
	const groupDevices = devices.filter((d) => group.deviceIds.includes(d.uniqueId));

	for (const device of groupDevices) {
		for (const cluster of device.mergedAllClusters) {
			if (cluster.name === DeviceClusterName.ON_OFF && cluster.isOn) {
				return true;
			}
			if (
				cluster.name === DeviceClusterName.COLOR_CONTROL &&
				cluster.clusterVariant === 'xy' &&
				cluster.mergedClusters[DeviceClusterName.ON_OFF]?.isOn
			) {
				return true;
			}
		}
	}
	return false;
};

// Check if group has any controllable devices
const hasControllableDevices = (
	group: DeviceGroup,
	devices: DeviceListWithValuesResponse
): boolean => {
	const groupDevices = devices.filter((d) => group.deviceIds.includes(d.uniqueId));

	return groupDevices.some((device) =>
		device.mergedAllClusters.some(
			(c) =>
				c.name === DeviceClusterName.ON_OFF ||
				c.name === DeviceClusterName.WINDOW_COVERING ||
				(c.name === DeviceClusterName.COLOR_CONTROL &&
					c.clusterVariant === 'xy' &&
					c.mergedClusters[DeviceClusterName.ON_OFF])
		)
	);
};

export const GroupIcon = React.memo((props: GroupIconProps): JSX.Element | null => {
	const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	const didHoldRef = React.useRef(false);

	const icon: IncludedIconNames = props.group.icon || 'Group';
	const isOn = isGroupOn(props.group, props.devices);
	const canControl = hasControllableDevices(props.group, props.devices);

	// Calculate screen position from floor plan coordinates
	const screenX = props.position.x * props.stageTransform.scale + props.stageTransform.x;
	const screenY = props.position.y * props.stageTransform.scale + props.stageTransform.y;

	// Scale icon size with zoom but keep reasonable bounds
	const baseSize = 36;
	const minSize = 28;
	const maxSize = 48;
	const scaledSize = Math.max(minSize, Math.min(maxSize, baseSize * props.stageTransform.scale));

	const onHold = props.onHold;
	const handlePointerDown = React.useCallback(
		(e: React.PointerEvent) => {
			if (props.isDraggingData) {
				return;
			}
			e.stopPropagation();
			e.preventDefault();

			didHoldRef.current = false;

			// Start hold timer (500ms)
			holdTimerRef.current = setTimeout(() => {
				didHoldRef.current = true;
				onHold();
			}, 500);
		},
		[props.isDraggingData, onHold]
	);

	const onTap = props.onTap;
	const handlePointerUp = React.useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			e.preventDefault();

			// Clear hold timer
			if (holdTimerRef.current) {
				clearTimeout(holdTimerRef.current);
				holdTimerRef.current = null;
			}

			// If didn't hold, treat as tap
			if (!didHoldRef.current && !props.isDraggingData && canControl) {
				onTap();
			}
		},
		[props.isDraggingData, onTap, canControl]
	);

	const handlePointerLeave = React.useCallback(() => {
		// Clear hold timer if pointer leaves
		if (holdTimerRef.current) {
			clearTimeout(holdTimerRef.current);
			holdTimerRef.current = null;
		}
	}, []);

	return (
		<Box
			sx={{
				position: 'absolute',
				left: screenX - scaledSize / 2,
				top: screenY - scaledSize / 2,
				pointerEvents: props.isDraggingData ? 'none' : 'auto',
			}}
		>
			<IconButton
				sx={{
					width: scaledSize,
					height: scaledSize,
					backgroundColor: isOn ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
					color: isOn ? '#2a2a2a' : 'rgba(0, 0, 0, 0.5)',
					fontSize: `${scaledSize * 0.5}px`,
					boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
					transition: 'background-color 0.2s ease, transform 0.1s ease',
					'&:hover': {
						backgroundColor: isOn ? '#f0f0f0' : 'rgba(255, 255, 255, 0.8)',
						transform: 'scale(1.1)',
					},
					'&:active': {
						transform: 'scale(0.95)',
					},
				}}
				onPointerDown={handlePointerDown}
				onPointerUp={handlePointerUp}
				onPointerLeave={handlePointerLeave}
			>
				<IconComponent iconName={icon} />
			</IconButton>
		</Box>
	);
});
