import {
	Box,
	Typography,
	Slider,
	ToggleButtonGroup,
	ToggleButton,
	FormControlLabel,
	Switch,
	TextField,
} from '@mui/material';
import type { DashboardDeviceClusterWithStateMap } from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { ColorControlActionConfig } from './ColorControlActionConfig';
import type { SceneDeviceAction } from '../../../../types/scene';
import type { Palette } from '../../../../types/palette';
import React from 'react';

interface ClusterActionControlsProps {
	action: SceneDeviceAction & { key: string; targetType?: 'device' | 'group' };
	actionKey: string;
	isGroup: boolean;
	availableClusters: DashboardDeviceClusterWithStateMap<
		| DeviceClusterName.ON_OFF
		| DeviceClusterName.WINDOW_COVERING
		| DeviceClusterName.COLOR_CONTROL
		| DeviceClusterName.LEVEL_CONTROL
	>;
	availablePalettes: Palette[];
	onActionChange: (key: string, updates: Partial<SceneDeviceAction & { key: string }>) => void;
}

export const ClusterActionControls = (props: ClusterActionControlsProps): JSX.Element => {
	return (
		<>
			{/* Action Configuration */}
			{props.action.cluster === DeviceClusterName.ON_OFF && (
				<FormControlLabel
					control={
						<Switch
							checked={
								(
									props.action.action as {
										isOn: boolean;
									}
								).isOn
							}
							onChange={(e) =>
								props.onActionChange(props.actionKey, {
									action: {
										isOn: e.target.checked,
									},
								})
							}
						/>
					}
					label={props.action.action.isOn ? 'Turn On' : 'Turn Off'}
				/>
			)}

			{props.action.cluster === DeviceClusterName.WINDOW_COVERING && (
				<Box>
					<Typography variant="body2" gutterBottom>
						Position:{' '}
						{
							(
								props.action.action as {
									targetPositionLiftPercentage: number;
								}
							).targetPositionLiftPercentage
						}
						%
					</Typography>
					<Slider
						value={props.action.action.targetPositionLiftPercentage}
						onChange={(_e, value) =>
							props.onActionChange(props.actionKey, {
								action: {
									targetPositionLiftPercentage: value,
								},
							})
						}
						min={0}
						max={100}
						marks={[
							{
								value: 0,
								label: '0%',
							},
							{
								value: 50,
								label: '50%',
							},
							{
								value: 100,
								label: '100%',
							},
						]}
					/>
				</Box>
			)}

			{props.action.cluster === DeviceClusterName.LEVEL_CONTROL && (
				<Box>
					<Typography variant="body2" gutterBottom>
						Level:{' '}
						{
							(
								props.action.action as {
									level: number;
									durationSeconds?: number;
								}
							).level
						}
						%
					</Typography>
					<Slider
						value={props.action.action.level}
						onChange={(_e, value) =>
							props.onActionChange(props.actionKey, {
								action: {
									level: value,
									durationSeconds: (
										props.action.action as {
											level: number;
											durationSeconds?: number;
										}
									).durationSeconds,
								},
							})
						}
						min={0}
						max={100}
						marks={[
							{
								value: 0,
								label: '0%',
							},
							{
								value: 50,
								label: '50%',
							},
							{
								value: 100,
								label: '100%',
							},
						]}
					/>
					<TextField
						label="Duration (seconds, optional)"
						type="number"
						value={
							(
								props.action.action as {
									level: number;
									durationSeconds?: number;
								}
							).durationSeconds || ''
						}
						onChange={(e) => {
							const value = e.target.value;
							const levelAction = props.action.action as {
								level: number;
								durationSeconds?: number;
							};
							props.onActionChange(props.actionKey, {
								action: {
									level: levelAction.level,
									durationSeconds:
										value === '' ? undefined : Math.max(0, parseInt(value, 10)),
								},
							});
						}}
						inputProps={{ min: 0, step: 1 }}
						fullWidth
						margin="normal"
						size="small"
						helperText="Leave empty for immediate change. Set duration to gradually increase level over time."
					/>
				</Box>
			)}

			{((props.action.cluster === DeviceClusterName.COLOR_CONTROL &&
				props.availableClusters[DeviceClusterName.COLOR_CONTROL]?.clusterVariant === 'xy' &&
				props.availableClusters[DeviceClusterName.COLOR_CONTROL]?.mergedClusters?.[
					DeviceClusterName.ON_OFF
				]) ||
				props.action.cluster === DeviceClusterName.ON_OFF) && (
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						gap: 2,
					}}
				>
					<ToggleButtonGroup
						value={
							props.action.cluster === DeviceClusterName.ON_OFF
								? props.action.action.isOn
									? 'on'
									: 'off'
								: 'color'
						}
						exclusive
						onChange={(_e, value) => {
							if (value === 'off') {
								props.onActionChange(props.actionKey, {
									cluster: DeviceClusterName.ON_OFF,
									action: {
										isOn: false,
									},
								});
							} else if (value === 'on') {
								props.onActionChange(props.actionKey, {
									cluster: DeviceClusterName.ON_OFF,
									action: {
										isOn: true,
									},
								});
							} else if (value === 'color') {
								props.onActionChange(props.actionKey, {
									cluster: DeviceClusterName.COLOR_CONTROL,
									action: {
										hue: 0,
										saturation: 100,
										value: 100,
									},
								});
							}
						}}
						fullWidth
					>
						<ToggleButton value="off">Off</ToggleButton>
						<ToggleButton value="on">On</ToggleButton>
						<ToggleButton value="color">Color</ToggleButton>
					</ToggleButtonGroup>
				</Box>
			)}

			{props.action.cluster === DeviceClusterName.COLOR_CONTROL && (
				<ColorControlActionConfig
					action={props.action}
					actionKey={props.actionKey}
					isGroup={props.isGroup}
					availableClusters={props.availableClusters}
					availablePalettes={props.availablePalettes}
					onActionChange={props.onActionChange}
				/>
			)}
		</>
	);
};
