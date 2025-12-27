import {
	Box,
	Paper,
	Typography,
	Slider,
	Switch,
	FormControlLabel,
	Button,
	Collapse,
	IconButton,
} from '@mui/material';
import {
	ExpandMore as ExpandMoreIcon,
	ExpandLess as ExpandLessIcon,
	Clear as ClearIcon,
} from '@mui/icons-material';
import type { DeviceListWithValuesResponse } from '../../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../../server/modules/device/cluster';
import type { FloorPlanDeviceState } from '../../lib/useFloorplanRender';
import { hsvToHex } from '../../../lib/color';
import React from 'react';

interface DevicePreviewPanelProps {
	devices: DeviceListWithValuesResponse;
	availableLightIds: Set<string>;
	previewStates: Record<string, FloorPlanDeviceState>;
	currentDeviceStates: Record<string, FloorPlanDeviceState>;
	onDevicePreviewChange: (deviceId: string, state: FloorPlanDeviceState | undefined) => void;
	onClearAll: () => void;
}

interface DevicePreviewItemProps {
	device: DeviceListWithValuesResponse[number];
	previewState: FloorPlanDeviceState | undefined;
	currentDeviceState: FloorPlanDeviceState | undefined;
	onChange: (state: FloorPlanDeviceState | undefined) => void;
}

const DevicePreviewItem = React.memo((props: DevicePreviewItemProps): JSX.Element => {
	const [expanded, setExpanded] = React.useState(false);

	// Get current state (preview or real)
	const isOn = props.previewState?.isOn ?? props.currentDeviceState?.isOn ?? false;
	const brightness =
		props.previewState?.brightness ?? props.currentDeviceState?.brightness ?? 1.0;
	const color = props.previewState?.color ?? props.currentDeviceState?.color ?? undefined;

	const hasColorControl = props.device.flatAllClusters.some(
		(c) => c.name === DeviceClusterName.COLOR_CONTROL
	);
	const hasLevelControl = props.device.flatAllClusters.some(
		(c) => c.name === DeviceClusterName.LEVEL_CONTROL
	);

	const handleToggle = (checked: boolean) => {
		if (checked) {
			props.onChange({
				isOn: true,
				brightness: brightness,
				color: color,
			});
		} else {
			props.onChange({
				isOn: false,
				brightness: brightness,
				color: color,
			});
		}
	};

	const handleBrightnessChange = (_event: Event, value: number | number[]) => {
		props.onChange({
			isOn: isOn,
			brightness: value as number,
			color: color,
		});
	};

	const handleHueChange = (_event: Event, value: number | number[]) => {
		props.onChange({
			isOn: isOn,
			brightness: brightness,
			color: {
				hue: value as number,
				saturation: color?.saturation ?? 100,
				value: color?.value ?? 100,
			},
		});
	};

	const handleSaturationChange = (_event: Event, value: number | number[]) => {
		props.onChange({
			isOn: isOn,
			brightness: brightness,
			color: {
				hue: color?.hue ?? 0,
				saturation: value as number,
				value: color?.value ?? 100,
			},
		});
	};

	const handleValueChange = (_event: Event, value: number | number[]) => {
		props.onChange({
			isOn: isOn,
			brightness: brightness,
			color: {
				hue: color?.hue ?? 0,
				saturation: color?.saturation ?? 100,
				value: value as number,
			},
		});
	};

	const colorHex = color ? hsvToHex(color.hue, color.saturation, color.value) : '#ffffff';

	return (
		<Paper
			sx={{
				p: 1.5,
				mb: 1,
				border: props.previewState ? '1px solid' : '1px solid transparent',
				borderColor: props.previewState ? 'primary.main' : 'divider',
			}}
		>
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
				<FormControlLabel
					control={
						<Switch
							checked={isOn}
							onChange={(e) => handleToggle(e.target.checked)}
							size="small"
						/>
					}
					label={
						<Typography variant="body2" sx={{ flex: 1 }}>
							{props.device.name || props.device.uniqueId}
						</Typography>
					}
					sx={{ flex: 1 }}
				/>
				<Box
					sx={{
						width: 32,
						height: 32,
						borderRadius: 1,
						backgroundColor: isOn ? colorHex : '#333',
						border: '1px solid',
						borderColor: 'divider',
					}}
				/>
				<IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ ml: 'auto' }}>
					{expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
				</IconButton>
			</Box>

			<Collapse in={expanded}>
				<Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
					{/* Brightness */}
					{(hasLevelControl || hasColorControl) && (
						<Box>
							<Typography variant="caption" color="text.secondary">
								Brightness: {Math.round(brightness * 100)}%
							</Typography>
							<Slider
								value={brightness}
								onChange={handleBrightnessChange}
								min={0}
								max={1}
								step={0.01}
								disabled={!isOn}
							/>
						</Box>
					)}

					{/* Color controls */}
					{hasColorControl && color && (
						<>
							<Box>
								<Typography variant="caption" color="text.secondary">
									Hue: {Math.round(color.hue)}°
								</Typography>
								<Slider
									value={color.hue}
									onChange={handleHueChange}
									min={0}
									max={360}
									step={1}
									disabled={!isOn}
								/>
							</Box>
							<Box>
								<Typography variant="caption" color="text.secondary">
									Saturation: {Math.round(color.saturation)}%
								</Typography>
								<Slider
									value={color.saturation}
									onChange={handleSaturationChange}
									min={0}
									max={100}
									step={1}
									disabled={!isOn}
								/>
							</Box>
							{!hasLevelControl && (
								<Box>
									<Typography variant="caption" color="text.secondary">
										Value: {Math.round(color.value)}%
									</Typography>
									<Slider
										value={color.value}
										onChange={handleValueChange}
										min={0}
										max={100}
										step={1}
										disabled={!isOn}
									/>
								</Box>
							)}
						</>
					)}
				</Box>
			</Collapse>
		</Paper>
	);
});
DevicePreviewItem.displayName = 'DevicePreviewItem';

/**
 * Sanitizes a device unique ID to match the filename format used on disk.
 */
function sanitizeDeviceId(uniqueId: string): string {
	return uniqueId.replace(/[^a-zA-Z0-9]/g, '_');
}

export const DevicePreviewPanel = (props: DevicePreviewPanelProps): JSX.Element => {
	// Filter devices that have floorplan renders
	const devicesWithRenders = React.useMemo(() => {
		return props.devices.filter((device) => {
			const sanitizedId = sanitizeDeviceId(device.uniqueId);
			return props.availableLightIds.has(sanitizedId);
		});
	}, [props.devices, props.availableLightIds]);

	const hasPreviews = Object.keys(props.previewStates).length > 0;

	return (
		<Paper sx={{ p: 2 }}>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					mb: 2,
				}}
			>
				<Typography variant="h6">Device Preview</Typography>
				{hasPreviews && (
					<Button
						size="small"
						startIcon={<ClearIcon />}
						onClick={props.onClearAll}
						color="secondary"
					>
						Clear All
					</Button>
				)}
			</Box>

			{devicesWithRenders.length === 0 ? (
				<Typography variant="body2" color="text.secondary">
					No devices with floorplan renders found.
				</Typography>
			) : (
				<Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
					{devicesWithRenders.map((device) => (
						<DevicePreviewItem
							key={device.uniqueId}
							device={device}
							previewState={props.previewStates[device.uniqueId]}
							currentDeviceState={props.currentDeviceStates[device.uniqueId]}
							onChange={(state) =>
								props.onDevicePreviewChange(device.uniqueId, state)
							}
						/>
					))}
				</Box>
			)}
		</Paper>
	);
};
