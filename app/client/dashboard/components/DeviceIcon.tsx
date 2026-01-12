import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { Box, IconButton } from '@mui/material';
import type { IncludedIconNames } from './icon';
import { IconComponent } from './icon';
import React from 'react';

export interface DeviceIconProps {
	device: DeviceListWithValuesResponse[number];
	position: { x: number; y: number };
	stageTransform: { x: number; y: number; scale: number };
	onTap: () => void;
	onHold: () => void;
	isDragging: boolean;
}

// Get primary icon from device clusters
const getDeviceIcon = (device: DeviceListWithValuesResponse[number]): IncludedIconNames | null => {
	// Check for custom icon first
	if (device.customIcon) {
		return device.customIcon;
	}

	// For offline devices, show CloudOff icon
	if (device.status === 'offline') {
		return 'CloudOff';
	}

	// Priority: ColorControl > OnOff > WindowCovering > others
	const clusterPriority = [
		DeviceClusterName.COLOR_CONTROL,
		DeviceClusterName.ON_OFF,
		DeviceClusterName.WINDOW_COVERING,
		DeviceClusterName.THERMOSTAT,
		DeviceClusterName.OCCUPANCY_SENSING,
		DeviceClusterName.TEMPERATURE_MEASUREMENT,
		DeviceClusterName.BOOLEAN_STATE,
	];

	for (const clusterName of clusterPriority) {
		const cluster = device.mergedAllClusters.find((c) => c.name === clusterName);
		if (cluster?.icon) {
			return cluster.icon;
		}
	}

	// Fallback to first cluster with icon
	for (const cluster of device.mergedAllClusters) {
		if (cluster.icon) {
			return cluster.icon;
		}
	}

	return 'Settings'; // Generic fallback
};

// Check if device is "on" (for visual state)
const isDeviceOn = (device: DeviceListWithValuesResponse[number]): boolean => {
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
	return false;
};

// Check if device has any controllable cluster (OnOff, WindowCovering, etc.)
const hasControllableCluster = (device: DeviceListWithValuesResponse[number]): boolean => {
	return device.mergedAllClusters.some(
		(c) =>
			c.name === DeviceClusterName.ON_OFF ||
			c.name === DeviceClusterName.WINDOW_COVERING ||
			(c.name === DeviceClusterName.COLOR_CONTROL &&
				c.clusterVariant === 'xy' &&
				c.mergedClusters[DeviceClusterName.ON_OFF])
	);
};

export const DeviceIcon = React.memo((props: DeviceIconProps): JSX.Element | null => {
	const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	const didHoldRef = React.useRef(false);

	const icon = getDeviceIcon(props.device);
	const isOn = isDeviceOn(props.device);
	const isOffline = props.device.status === 'offline';
	const canControl = !isOffline && hasControllableCluster(props.device);

	// Calculate screen position from floor plan coordinates
	const screenX = props.position.x * props.stageTransform.scale + props.stageTransform.x;
	const screenY = props.position.y * props.stageTransform.scale + props.stageTransform.y;

	// Scale icon size with zoom but keep reasonable bounds
	const baseSize = 36;
	const minSize = 28;
	const maxSize = 48;
	const scaledSize = Math.max(minSize, Math.min(maxSize, baseSize * props.stageTransform.scale));

	const onTap = props.onTap;
	const onHold = props.onHold;
	const handlePointerDown = React.useCallback(
		(e: React.PointerEvent) => {
			if (props.isDragging) {
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
		[props.isDragging, onHold]
	);

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
			if (!didHoldRef.current && !props.isDragging && canControl) {
				onTap();
			}
		},
		[props.isDragging, onTap, canControl]
	);

	const handlePointerLeave = React.useCallback(() => {
		// Clear hold timer if pointer leaves
		if (holdTimerRef.current) {
			clearTimeout(holdTimerRef.current);
			holdTimerRef.current = null;
		}
	}, []);

	if (!icon) {
		return null;
	}

	return (
		<Box
			sx={{
				position: 'absolute',
				left: screenX - scaledSize / 2,
				top: screenY - scaledSize / 2,
				pointerEvents: props.isDragging ? 'none' : 'auto',
			}}
		>
			<IconButton
				sx={{
					width: scaledSize,
					height: scaledSize,
					backgroundColor: isOffline
						? 'rgba(158, 158, 158, 0.3)'
						: isOn
							? '#ffffff'
							: 'rgba(255, 255, 255, 0.6)',
					color: isOffline
						? 'rgba(0, 0, 0, 0.4)'
						: isOn
							? '#2a2a2a'
							: 'rgba(0, 0, 0, 0.5)',
					fontSize: `${scaledSize * 0.5}px`,
					boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
					opacity: isOffline ? 0.6 : 1,
					transition: 'background-color 0.2s ease, transform 0.1s ease',
					pointerEvents: isOffline ? 'none' : 'auto',
					'&:hover': {
						backgroundColor: isOffline
							? 'rgba(158, 158, 158, 0.3)'
							: isOn
								? '#f0f0f0'
								: 'rgba(255, 255, 255, 0.8)',
						transform: isOffline ? 'none' : 'scale(1.1)',
					},
					'&:active': {
						transform: isOffline ? 'none' : 'scale(0.95)',
					},
				}}
				onPointerDown={isOffline ? undefined : handlePointerDown}
				onPointerUp={isOffline ? undefined : handlePointerUp}
				onPointerLeave={isOffline ? undefined : handlePointerLeave}
			>
				<IconComponent iconName={icon} />
			</IconButton>
		</Box>
	);
});
