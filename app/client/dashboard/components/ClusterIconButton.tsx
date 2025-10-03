import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { apiPost, type ReturnTypeForApi } from '../../lib/fetch';
import { getClusterIcon } from './clusterIcons';
import { IconButton } from '@mui/material';
import React from 'react';

interface ClusterIconButtonSkeletonProps extends ClusterIconButtonProps {
	onPress: () => void;
	enabled: boolean;
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
			{getClusterIcon(
				props.devices
					.flatMap((d) => d.clusters)
					.filter((c) => c.name === props.clusterName)[0]?.icon
			)}
		</IconButton>
	);
};

const WindowCoveringIconButton = (props: ClusterIconButtonProps) => {
	const devices = props.devices.filter((device) =>
		device.clusters.some((c) => c.name === DeviceClusterName.WINDOW_COVERING)
	);
	const anyEnabled = devices
		.flatMap((d) => d.clusters)
		.filter((c) => c.name === DeviceClusterName.WINDOW_COVERING)
		.some((d) => d.targetPositionLiftPercentage === 0);
	return (
		<ClusterIconButtonSkeleton
			{...props}
			enabled={anyEnabled}
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
		device.clusters.some((c) => c.name === DeviceClusterName.ON_OFF)
	);
	const anyEnabled = devices
		.flatMap((d) => d.clusters)
		.filter((c) => c.name === DeviceClusterName.ON_OFF)
		.some((d) => d.isOn);
	return (
		<ClusterIconButtonSkeleton
			{...props}
			enabled={anyEnabled}
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

type DeviceType = ReturnTypeForApi<'device', '/listWithValues', 'GET'>['ok']['devices'][number];

export interface ClusterIconButtonProps {
	clusterName: DeviceClusterName;
	devices: DeviceType[];
	invalidate: () => void;
	onLongPress: () => void;
}

export const ClusterIconButton = (props: ClusterIconButtonProps): JSX.Element | null => {
	if (props.clusterName === DeviceClusterName.WINDOW_COVERING) {
		return <WindowCoveringIconButton {...props} />;
	}
	if (props.clusterName === DeviceClusterName.ON_OFF) {
		return <OnOffIconButton {...props} />;
	}
	return null;
};
