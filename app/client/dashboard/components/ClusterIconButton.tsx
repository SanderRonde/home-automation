import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { IconButton } from '@mui/material';
import { apiPost } from '../../lib/fetch';
import { IconComponent } from './icon';
import React from 'react';

interface ClusterIconButtonSkeletonProps extends ClusterIconButtonProps {
	onPress: (() => void) | undefined;
	enabled: boolean;
	offline: boolean;
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
				if (props.offline) {
					return;
				}
				const timer = setTimeout(() => {
					// Handle long press
					props.onLongPress();
					document.removeEventListener('pointerup', handlePointerUp);
				}, 1000);

				const handlePointerUp = (e: MouseEvent) => {
					e.preventDefault();
					e.stopPropagation();
					clearTimeout(timer);
					// Handle normal click
					props.onPress?.();
					document.removeEventListener('pointerup', handlePointerUp);
				};

				document.addEventListener('pointerup', handlePointerUp);
			}}
			sx={{
				backgroundColor: props.offline
					? 'rgba(0, 0, 0, 0.25)'
					: props.enabled
						? '#ffffff'
						: '#333',
				width: 48,
				height: 48,
				fontSize: '1.5rem',
				color: props.offline
					? 'rgba(255, 255, 255, 0.5)'
					: props.enabled
						? '#2a2a2a'
						: '#fff',
				opacity: props.offline ? 0.6 : 1,
				pointerEvents: props.offline ? 'none' : 'auto',
				'&:hover': {
					backgroundColor: props.offline
						? 'rgba(0, 0, 0, 0.25)'
						: props.enabled
							? '#f0f0f0'
							: '#555',
					color: props.offline
						? 'rgba(255, 255, 255, 0.5)'
						: props.enabled
							? '#111'
							: '#fff',
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
		.some((d) => d.targetPositionLiftPercentage < 5);
	const icon = props.devices
		.flatMap((d) => d.mergedAllClusters)
		.filter((c) => c.name === props.clusterName)[0]?.icon;
	const offline = devices.length > 0 && devices.every((d) => d.status === 'offline');
	return (
		<ClusterIconButtonSkeleton
			{...props}
			enabled={anyEnabled}
			offline={offline}
			clusterIcon={icon ? <IconComponent iconName={icon} /> : null}
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
					c.clusterVariant === 'xy' &&
					c.mergedClusters[DeviceClusterName.ON_OFF])
		)
	);
	const anyEnabled = devices
		.flatMap((d) => d.mergedAllClusters)
		.some(
			(d) =>
				(d.name === DeviceClusterName.ON_OFF && d.isOn) ||
				(d.name === DeviceClusterName.COLOR_CONTROL &&
					d.clusterVariant === 'xy' &&
					d.mergedClusters[DeviceClusterName.ON_OFF]?.isOn)
		);

	let icon = null;
	for (const device of devices) {
		for (const cluster of device.mergedAllClusters) {
			if (cluster.name === DeviceClusterName.ON_OFF) {
				icon = cluster.icon ? <IconComponent iconName={cluster.icon} /> : null;
				break;
			} else if (
				cluster.name === DeviceClusterName.COLOR_CONTROL &&
				cluster.clusterVariant === 'xy' &&
				cluster.mergedClusters[DeviceClusterName.ON_OFF]
			) {
				icon = cluster.mergedClusters[DeviceClusterName.ON_OFF]?.icon ? (
					<IconComponent
						iconName={cluster.mergedClusters[DeviceClusterName.ON_OFF]?.icon}
					/>
				) : null;
				break;
			}
		}
	}

	const offline = devices.length > 0 && devices.every((d) => d.status === 'offline');
	return (
		<ClusterIconButtonSkeleton
			{...props}
			enabled={anyEnabled}
			offline={offline}
			clusterIcon={icon}
			onPress={async () => {
				await apiPost(
					'device',
					'/cluster/OnOff',
					{},
					{
						deviceIds: devices
							.filter(
								(d) =>
									// Very hacky, don't on/off for devices that have a power measurement cluster
									!d.flatAllClusters.some(
										(c) =>
											c.name ===
											DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT
									)
							)
							.map((d) => d.uniqueId),
						isOn: !anyEnabled,
					}
				);
				props.invalidate();
			}}
		/>
	);
};

const ColorControlIconButton = (props: ClusterIconButtonProps) => {
	const devices = props.devices.filter((device) =>
		device.mergedAllClusters.some(
			(c) =>
				c.name === DeviceClusterName.ON_OFF ||
				(c.name === DeviceClusterName.COLOR_CONTROL &&
					c.clusterVariant === 'xy' &&
					c.mergedClusters[DeviceClusterName.ON_OFF])
		)
	);

	const anyEnabled = devices
		.flatMap((d) => d.mergedAllClusters)
		.some(
			(d) =>
				(d.name === DeviceClusterName.ON_OFF && d.isOn) ||
				(d.name === DeviceClusterName.COLOR_CONTROL &&
					d.clusterVariant === 'xy' &&
					d.mergedClusters[DeviceClusterName.ON_OFF]?.isOn)
		);

	let icon = null;
	for (const device of devices) {
		for (const cluster of device.mergedAllClusters) {
			if (cluster.name === DeviceClusterName.COLOR_CONTROL) {
				icon = cluster.icon ? <IconComponent iconName={cluster.icon} /> : null;
				break;
			}
		}
	}

	const offline = devices.length > 0 && devices.every((d) => d.status === 'offline');
	return (
		<ClusterIconButtonSkeleton
			{...props}
			enabled={anyEnabled}
			offline={offline}
			clusterIcon={icon}
			onPress={props.onLongPress}
		/>
	);
};

export interface ClusterIconButtonProps {
	clusterName: DeviceClusterName;
	allClusters: Set<DeviceClusterName>;
	devices: DeviceListWithValuesResponse;
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
	if (props.clusterName === DeviceClusterName.COLOR_CONTROL) {
		return (
			<>
				<ColorControlIconButton {...props} />
				{!props.allClusters.has(DeviceClusterName.ON_OFF) && <OnOffIconButton {...props} />}
			</>
		);
	}
	return null;
};
