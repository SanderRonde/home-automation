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
	onPress: () => void;
	cardBackground?: string;
}

const DeviceClusterCardSkeleton = (props: DeviceClusterCardProps) => {
	return (
		<Card
			sx={{
				borderRadius: 2,
				overflow: 'hidden',
				background: props.cardBackground,
			}}
			onClick={props.onPress}
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
			</CardActionArea>
		</Card>
	);
};

const WindowCoveringCard = (props: DeviceClusterCardBaseProps) => {
	const extra =
		props.cluster as DashboardDeviceClusterExtra['WindowCovering'];
	return (
		<DeviceClusterCardSkeleton
			{...props}
			onPress={async () => {
				const target = extra.targetPositionLiftPercentage ? 0 : 100;
				await apiPost(
					'device',
					'/cluster/WindowCovering',
					{},
					{
						deviceId: props.device.uniqueId,
						targetPositionLiftPercentage: target,
					}
				);
				props.invalidate();
			}}
			cardBackground={`linear-gradient(to right, #0053a6 ${extra.targetPositionLiftPercentage}%, #3f3f3f ${extra.targetPositionLiftPercentage}%)`}
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
