import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { getClusterIcon } from './clusterIcons';
import { IconButton } from '@mui/material';
import { apiPost } from '../../lib/fetch';
import React from 'react';

interface ClusterIconButtonSkeletonProps extends ClusterIconButtonProps {
	onPress: () => void;
	enabled: boolean;
	clusterIcon: JSX.Element | null;
}

const ClusterIconButtonSkeleton = (props: ClusterIconButtonSkeletonProps) => {
	return (
		<IconButton
			key={props.clusterName}
			onClick={(e) => {
				e.stopPropagation();
				e.preventDefault();
			}}
			onPointerDown={(e) => {
				e.stopPropagation();
				e.preventDefault();
				const timer = setTimeout(() => {
					// Handle long press
					props.onLongPress();
					document.removeEventListener('pointerup', handlePointerUp);
				}, 1000);

				const handlePointerUp = () => {
					clearTimeout(timer);
					// Handle normal click
					props.onPress();
					document.removeEventListener('pointerup', handlePointerUp);
				};

				document.addEventListener('pointerup', handlePointerUp);
			}}
			sx={{
				backgroundColor: props.enabled ? '#ffffff' : 'rgba(255, 255, 255, 0.2)',
				width: 48,
				height: 48,
				fontSize: '1.5rem',
				color: props.enabled ? '#2a2a2a' : 'rgba(0, 0, 0, 0.5)',
				'&:hover': {
					backgroundColor: props.enabled ? '#f0f0f0' : 'rgba(255, 255, 255, 0.4)',
				},
			}}
		>
			{props.clusterIcon}
		</IconButton>
	);
};

const WindowCoveringIconButton = (props: ClusterIconButtonProps) => {
	const devices = props.devices.filter((device) =>
		device.mergedAllClusters.some((c) => c.name === DeviceClusterName.WINDOW_COVERING)
	);
	const anyEnabled = devices
		.flatMap((d) => d.mergedAllClusters)
		.filter((c) => c.name === DeviceClusterName.WINDOW_COVERING)
		.some((d) => d.targetPositionLiftPercentage === 0);
	return (
		<ClusterIconButtonSkeleton
			{...props}
			enabled={anyEnabled}
			clusterIcon={getClusterIcon(
				props.devices
					.flatMap((d) => d.mergedAllClusters)
					.filter((c) => c.name === props.clusterName)[0]?.icon
			)}
			onPress={async () => {
				// Toggle all
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
			}}
		/>
	);
};

const OnOffIconButton = (props: ClusterIconButtonProps) => {
	const devices = props.devices.filter((device) =>
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

	let icon = null;
	for (const device of devices) {
		for (const cluster of device.mergedAllClusters) {
			if (cluster.name === DeviceClusterName.ON_OFF) {
				icon = getClusterIcon(cluster.icon);
				break;
			} else if (
				cluster.name === DeviceClusterName.COLOR_CONTROL &&
				cluster.mergedClusters[DeviceClusterName.ON_OFF]
			) {
				icon = getClusterIcon(cluster.mergedClusters[DeviceClusterName.ON_OFF]?.icon);
				break;
			}
		}
	}

	return (
		<ClusterIconButtonSkeleton
			{...props}
			enabled={anyEnabled}
			clusterIcon={icon}
			onPress={async () => {
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
			}}
		/>
	);
};

export interface ClusterIconButtonProps {
	clusterName: DeviceClusterName;
	devices: DeviceListWithValuesResponse;
	invalidate: () => void;
	onLongPress: () => void;
}

export const ClusterIconButton = (props: ClusterIconButtonProps): JSX.Element | null => {
	if (props.clusterName === DeviceClusterName.WINDOW_COVERING) {
		return <WindowCoveringIconButton {...props} />;
	}
	if (
		props.clusterName === DeviceClusterName.ON_OFF ||
		props.clusterName === DeviceClusterName.COLOR_CONTROL
	) {
		return <OnOffIconButton {...props} />;
	}
	return null;
};
