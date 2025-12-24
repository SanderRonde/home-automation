import {
	Box,
	Typography,
	Slider,
	ToggleButtonGroup,
	ToggleButton,
	Autocomplete,
	TextField,
} from '@mui/material';
import type { DashboardDeviceClusterWithStateMap } from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type { SceneDeviceAction } from '../../../../types/scene';
import type { Palette } from '../../../../types/palette';
import React from 'react';

interface ColorControlActionConfigProps {
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

export const ColorControlActionConfig = (props: ColorControlActionConfigProps): JSX.Element => {
	const [colorMode, setColorMode] = React.useState<'manual' | 'palette'>(
		props.action.cluster === DeviceClusterName.COLOR_CONTROL &&
			'paletteId' in props.action.action
			? 'palette'
			: 'manual'
	);

	return (
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',
				gap: 2,
			}}
		>
			{/* Color Mode Selector (only for groups) */}
			{props.isGroup && (
				<ToggleButtonGroup
					value={colorMode}
					exclusive
					onChange={(_e, value) => {
						if (value) {
							setColorMode(value);
							// Clear action data when switching modes
							if (value === 'manual') {
								props.onActionChange(props.actionKey, {
									action: {
										hue: 0,
										saturation: 100,
										value: 100,
									},
								});
							} else {
								props.onActionChange(props.actionKey, {
									action: {
										paletteId: '',
									},
								});
							}
						}
					}}
					fullWidth
				>
					<ToggleButton value="manual">Manual Color</ToggleButton>
					<ToggleButton value="palette">Palette</ToggleButton>
				</ToggleButtonGroup>
			)}

			{/* Color Preview (only for manual mode) */}
			{colorMode === 'manual' && 'hue' in props.action.action && (
				<Box
					sx={{
						width: '100%',
						height: 60,
						borderRadius: 2,
						border: '1px solid',
						borderColor: 'divider',
						backgroundColor: `hsl(${props.action.action.hue ?? 0}, ${props.action.action.saturation ?? 100}%, ${(props.action.action.value ?? 100) / 2}%)`,
					}}
				/>
			)}

			{/* Palette Selector */}
			{colorMode === 'palette' && (
				<Box>
					<Autocomplete
						options={props.availablePalettes}
						getOptionLabel={(option) => option.name}
						value={(() => {
							if ('paletteId' in props.action.action) {
								const paletteId = (
									props.action.action as {
										paletteId: string;
									}
								).paletteId;
								return (
									props.availablePalettes.find((p) => p.id === paletteId) ?? null
								);
							}
							return null;
						})()}
						onChange={(_e, newValue) => {
							props.onActionChange(props.actionKey, {
								action: {
									paletteId: newValue?.id ?? '',
								},
							});
						}}
						renderInput={(params) => (
							<TextField {...params} label="Select Palette" size="small" />
						)}
						renderOption={(optionProps, option) => (
							<li {...optionProps}>
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
										gap: 1,
										width: '100%',
									}}
								>
									<Typography sx={{ flex: 1 }}>{option.name}</Typography>
									<Box
										sx={{
											display: 'flex',
											gap: 0.5,
										}}
									>
										{option.colors.map((color, idx) => (
											<Box
												key={idx}
												sx={{
													width: 20,
													height: 20,
													backgroundColor: color,
													borderRadius: '50%',
													border: '1px solid rgba(0,0,0,0.2)',
												}}
											/>
										))}
									</Box>
								</Box>
							</li>
						)}
					/>
				</Box>
			)}

			{colorMode === 'manual' && 'hue' in props.action.action && (
				<>
					<Box>
						<Typography variant="body2" gutterBottom>
							Hue: {props.action.action.hue}°
						</Typography>
						<Slider
							value={props.action.action.hue}
							onChange={(_e, value) =>
								props.onActionChange(props.actionKey, {
									action: {
										...(props.action.action as {
											hue: number;
											saturation: number;
											value: number;
										}),
										hue: value,
									},
								})
							}
							min={0}
							max={360}
							marks={[
								{
									value: 0,
									label: '0°',
								},
								{
									value: 180,
									label: '180°',
								},
								{
									value: 360,
									label: '360°',
								},
							]}
						/>
					</Box>
					<Box>
						<Typography variant="body2" gutterBottom>
							Saturation: {props.action.action.saturation}%
						</Typography>
						<Slider
							value={props.action.action.saturation}
							onChange={(_e, value) =>
								props.onActionChange(props.actionKey, {
									action: {
										...(props.action.action as {
											hue: number;
											saturation: number;
											value: number;
										}),
										saturation: value,
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
					{'value' in props.action.action &&
						props.availableClusters[DeviceClusterName.COLOR_CONTROL]?.clusterVariant ===
							'xy' &&
						!props.availableClusters[DeviceClusterName.COLOR_CONTROL]?.mergedClusters[
							DeviceClusterName.LEVEL_CONTROL
						] && (
							<Box>
								<Typography variant="body2" gutterBottom>
									Brightness: {props.action.action.value}%
								</Typography>
								<Slider
									value={props.action.action.value}
									onChange={(_e, value) =>
										props.onActionChange(props.actionKey, {
											action: {
												...(props.action.action as {
													hue: number;
													saturation: number;
													value: number;
												}),
												value: value,
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
				</>
			)}
		</Box>
	);
};
