import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	TextField,
	Box,
	IconButton,
	Typography,
	ToggleButtonGroup,
	ToggleButton,
	Autocomplete,
	Card,
	Divider,
	Switch,
	FormControlLabel,
	Checkbox,
	useMediaQuery,
	useTheme,
	Alert,
	CircularProgress,
} from '@mui/material';
import type {
	DeviceListWithValuesResponse,
	DashboardDeviceClusterSwitch,
} from '../../../server/modules/device/routing';
import type {
	SceneTriggerWithConditions,
	SceneTrigger,
	SceneCondition,
} from '../../../../types/scene';
import { Delete as DeleteIcon, Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import { SceneTriggerType, SceneConditionType } from '../../../../types/scene';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type { Host } from '../../../server/modules/home-detector/routing';
import type { Webhook } from '../../../server/modules/webhook/types';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import React, { useState, useEffect, useMemo } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { TimePicker } from '@mui/x-date-pickers';
import { apiGet } from '../../lib/fetch';
import 'leaflet/dist/leaflet.css';

// Dynamic import for react-leaflet to handle ESM module
let MapContainer: React.ComponentType<any>;
let TileLayer: React.ComponentType<any>;
let Marker: React.ComponentType<any>;
let Popup: React.ComponentType<any>;
let Circle: React.ComponentType<any>;
let L: any;

// Lazy load leaflet and react-leaflet
const loadLeaflet = async () => {
	if (!MapContainer) {
		const leaflet = (await import('leaflet')) as { default: typeof import('leaflet') };
		L = leaflet.default;
		// Fix for default marker icons in Leaflet with bundlers
		delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
		L.Icon.Default.mergeOptions({
			iconRetinaUrl:
				'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
			iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
			shadowUrl:
				'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
		});
		const reactLeaflet = await import('react-leaflet');
		MapContainer = reactLeaflet.MapContainer;
		TileLayer = reactLeaflet.TileLayer;
		Marker = reactLeaflet.Marker;
		Popup = reactLeaflet.Popup;
		Circle = reactLeaflet.Circle;
	}
};

interface TriggerEditDialogProps {
	open: boolean;
	onClose: () => void;
	onSave: (trigger: SceneTriggerWithConditions) => void;
	trigger?: SceneTriggerWithConditions;
	devices: DeviceListWithValuesResponse;
	hosts: Host[];
}

type TriggerType = SceneTriggerType;
type ConditionType = SceneConditionType;

// Helper functions to convert between HH:MM strings and Date objects
const timeStringToDate = (timeStr: string): Date => {
	const [hours, minutes] = timeStr.split(':').map(Number);
	const date = new Date();
	date.setHours(hours, minutes, 0, 0);
	return date;
};

const dateToTimeString = (date: Date | null): string => {
	if (!date) {
		return '09:00';
	}
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
	return `${hours}:${minutes}`;
};

interface LocationTriggerMapPreviewProps {
	deviceId: string;
	targetId: string;
	rangeKm: string;
	devices: Array<{
		id: string;
		name: string;
		lastKnownLocation: {
			latitude: number;
			longitude: number;
			accuracy: number | null;
			timestamp: number;
		} | null;
	}>;
	targets: Array<{
		id: string;
		name: string;
		coordinates: { latitude: number; longitude: number };
	}>;
}

const LocationTriggerMapPreview = ({
	deviceId,
	targetId,
	rangeKm,
	devices,
	targets,
}: LocationTriggerMapPreviewProps): JSX.Element => {
	const [mapLoaded, setMapLoaded] = useState(false);

	useEffect(() => {
		void loadLeaflet().then(() => {
			setMapLoaded(true);
		});
	}, []);

	const device = useMemo(() => devices.find((d) => d.id === deviceId), [devices, deviceId]);
	const target = useMemo(() => targets.find((t) => t.id === targetId), [targets, targetId]);

	const range = useMemo(() => {
		const parsed = parseFloat(rangeKm);
		return isNaN(parsed) || parsed <= 0 ? null : parsed;
	}, [rangeKm]);

	const mapCenter = useMemo((): [number, number] | null => {
		if (target) {
			return [target.coordinates.latitude, target.coordinates.longitude];
		}
		if (device?.lastKnownLocation) {
			return [device.lastKnownLocation.latitude, device.lastKnownLocation.longitude];
		}
		return null;
	}, [device, target]);

	if (!mapLoaded || !MapContainer || !mapCenter) {
		if (!deviceId || !targetId) {
			return (
				<Box
					sx={{
						height: '300px',
						width: '100%',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						bgcolor: 'action.hover',
						borderRadius: 1,
					}}
				>
					<Typography variant="body2" color="text.secondary">
						Select a device and target to see map preview
					</Typography>
				</Box>
			);
		}
		return (
			<Box
				sx={{
					height: '300px',
					width: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	const zoom = range && range < 1 ? 13 : range && range < 5 ? 12 : 11;

	return (
		<Box sx={{ height: '300px', width: '100%', borderRadius: 1, overflow: 'hidden' }}>
			<MapContainer center={mapCenter} zoom={zoom} style={{ height: '100%', width: '100%' }}>
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
				/>
				{target && (
					<>
						<Marker
							position={[target.coordinates.latitude, target.coordinates.longitude]}
						>
							<Popup>
								<strong>{target.name}</strong>
								<br />
								Target
								<br />
								{target.coordinates.latitude.toFixed(6)},{' '}
								{target.coordinates.longitude.toFixed(6)}
							</Popup>
						</Marker>
						{range && (
							<Circle
								center={[target.coordinates.latitude, target.coordinates.longitude]}
								radius={range * 1000} // Convert km to meters
								pathOptions={{
									color: '#1976d2',
									fillColor: '#1976d2',
									fillOpacity: 0.2,
									weight: 2,
								}}
							>
								<Popup>
									<strong>Range: {range.toFixed(2)}km</strong>
								</Popup>
							</Circle>
						)}
					</>
				)}
				{device?.lastKnownLocation && (
					<Marker
						position={[
							device.lastKnownLocation.latitude,
							device.lastKnownLocation.longitude,
						]}
					>
						<Popup>
							<strong>{device.name}</strong>
							<br />
							Device
							<br />
							{device.lastKnownLocation.latitude.toFixed(6)},{' '}
							{device.lastKnownLocation.longitude.toFixed(6)}
						</Popup>
					</Marker>
				)}
			</MapContainer>
		</Box>
	);
};

export const TriggerEditDialog = (props: TriggerEditDialogProps): JSX.Element => {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
	const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

	// Trigger state
	const [triggerType, setTriggerType] = useState<TriggerType>(SceneTriggerType.OCCUPANCY);
	const [triggerDeviceId, setTriggerDeviceId] = useState<string>('');
	const [triggerButtonIndex, setTriggerButtonIndex] = useState<number | undefined>(undefined);
	const [triggerHostId, setTriggerHostId] = useState<string>('');
	const [triggerWebhookName, setTriggerWebhookName] = useState<string>('');
	const [triggerOccupied, setTriggerOccupied] = useState<boolean>(true); // true = detect, false = removal

	// Interval trigger state
	const [intervalMinutes, setIntervalMinutes] = useState<number>(60);

	// Delay trigger state
	const [delaySeconds, setDelaySeconds] = useState<number>(5);

	// Webhooks
	const [webhooks, setWebhooks] = useState<Webhook[]>([]);

	// Conditions state
	const [conditions, setConditions] = useState<SceneCondition[]>([]);

	// Condition editor state
	const [addingCondition, setAddingCondition] = useState(false);
	const [conditionType, setConditionType] = useState<ConditionType>(SceneConditionType.HOST_HOME);
	const [conditionHostId, setConditionHostId] = useState<string>('');
	const [conditionDeviceId, setConditionDeviceId] = useState<string>('');
	const [conditionShouldBeHome, setConditionShouldBeHome] = useState(true);
	const [conditionShouldBeOn, setConditionShouldBeOn] = useState(true);
	const [conditionCustomJsCode, setConditionCustomJsCode] = useState<string>(
		'// Custom condition code\n// Return true to pass, false to fail\nreturn true;'
	);
	const [conditionVariableName, setConditionVariableName] = useState<string>('');
	const [conditionShouldBeTrue, setConditionShouldBeTrue] = useState(true);
	const [conditionInvert, setConditionInvert] = useState(false);
	const [variables, setVariables] = useState<Record<string, boolean>>({});

	// Location trigger state
	const [locationDeviceId, setLocationDeviceId] = useState<string>('');
	const [locationTargetId, setLocationTargetId] = useState<string>('');
	const [locationRangeKm, setLocationRangeKm] = useState<string>('');
	const [locationEnteredRange, setLocationEnteredRange] = useState(false);
	const [locationTargets, setLocationTargets] = useState<Array<{ id: string; name: string }>>([]);
	const [locationDevices, setLocationDevices] = useState<Array<{ id: string; name: string }>>([]);
	const [locationTargetsFull, setLocationTargetsFull] = useState<
		Array<{
			id: string;
			name: string;
			coordinates: { latitude: number; longitude: number };
		}>
	>([]);
	const [locationDevicesFull, setLocationDevicesFull] = useState<
		Array<{
			id: string;
			name: string;
			lastKnownLocation: {
				latitude: number;
				longitude: number;
				accuracy: number | null;
				timestamp: number;
			} | null;
		}>
	>([]);

	// Time window state
	type DayOfWeek =
		| 'monday'
		| 'tuesday'
		| 'wednesday'
		| 'thursday'
		| 'friday'
		| 'saturday'
		| 'sunday';
	const [timeWindowDays, setTimeWindowDays] = useState<Record<DayOfWeek, boolean>>({
		monday: false,
		tuesday: false,
		wednesday: false,
		thursday: false,
		friday: false,
		saturday: false,
		sunday: false,
	});
	const [timeWindowStart, setTimeWindowStart] = useState<Record<DayOfWeek, string>>({
		monday: '09:00',
		tuesday: '09:00',
		wednesday: '09:00',
		thursday: '09:00',
		friday: '09:00',
		saturday: '09:00',
		sunday: '09:00',
	});
	const [timeWindowEnd, setTimeWindowEnd] = useState<Record<DayOfWeek, string>>({
		monday: '17:00',
		tuesday: '17:00',
		wednesday: '17:00',
		thursday: '17:00',
		friday: '17:00',
		saturday: '17:00',
		sunday: '17:00',
	});

	// Validation
	const [errors, setErrors] = useState<string[]>([]);

	// Load variables and location targets
	useEffect(() => {
		if (props.open) {
			const loadVariables = async () => {
				try {
					const response = await apiGet('device', '/variables/list', {});
					if (response.ok) {
						const data = await response.json();
						setVariables(data.variables || {});
					}
				} catch (error) {
					console.error('Failed to load variables:', error);
				}
			};
			const loadLocationData = async () => {
				try {
					const [targetsResponse, devicesResponse] = await Promise.all([
						apiGet('location', '/targets', {}),
						apiGet('location', '/devices', {}),
					]);
					if (targetsResponse.ok) {
						const data = await targetsResponse.json();
						const targets = data.targets || [];
						setLocationTargets(
							targets.map((t: { id: string; name: string }) => ({
								id: t.id,
								name: t.name,
							}))
						);
						setLocationTargetsFull(
							targets.map(
								(t: {
									id: string;
									name: string;
									coordinates: { latitude: number; longitude: number };
								}) => ({
									id: t.id,
									name: t.name,
									coordinates: t.coordinates,
								})
							)
						);
					}
					if (devicesResponse.ok) {
						const data = await devicesResponse.json();
						const devices = data.devices || [];
						setLocationDevices(
							devices.map((d: { id: string; name: string }) => ({
								id: d.id,
								name: d.name,
							}))
						);
						setLocationDevicesFull(
							devices.map(
								(d: {
									id: string;
									name: string;
									lastKnownLocation: {
										latitude: number;
										longitude: number;
										accuracy: number | null;
										timestamp: number;
									} | null;
								}) => ({
									id: d.id,
									name: d.name,
									lastKnownLocation: d.lastKnownLocation,
								})
							)
						);
					}
				} catch (error) {
					console.error('Failed to load location data:', error);
				}
			};
			void loadVariables();
			void loadLocationData();
		}
	}, [props.open]);

	// Initialize from existing trigger
	useEffect(() => {
		if (props.open && props.trigger) {
			const trigger = props.trigger.trigger;
			setTriggerType(trigger.type);

			if (trigger.type === SceneTriggerType.OCCUPANCY) {
				setTriggerDeviceId(trigger.deviceId);
				setTriggerOccupied(trigger.occupied);
			} else if (trigger.type === SceneTriggerType.BUTTON_PRESS) {
				setTriggerDeviceId(trigger.deviceId);
				setTriggerButtonIndex(trigger.buttonIndex);
			} else if (trigger.type === SceneTriggerType.HOST_ARRIVAL) {
				setTriggerHostId(trigger.hostId);
			} else if (trigger.type === SceneTriggerType.HOST_DEPARTURE) {
				setTriggerHostId(trigger.hostId);
			} else if (trigger.type === SceneTriggerType.WEBHOOK) {
				setTriggerWebhookName(trigger.webhookName);
			} else if (trigger.type === SceneTriggerType.CRON) {
				setIntervalMinutes(trigger.intervalMinutes);
			} else if (trigger.type === SceneTriggerType.DELAY) {
				setDelaySeconds(trigger.seconds);
			} else if (trigger.type === SceneTriggerType.LOCATION_WITHIN_RANGE) {
				setLocationDeviceId(trigger.deviceId);
				setLocationTargetId(trigger.targetId);
				setLocationRangeKm(trigger.rangeKm.toString());
			}

			setConditions(props.trigger.conditions || []);
		} else if (props.open) {
			// Reset for new trigger
			setTriggerType(SceneTriggerType.OCCUPANCY);
			setTriggerDeviceId('');
			setTriggerButtonIndex(undefined);
			setTriggerHostId('');
			setTriggerWebhookName('');
			setTriggerOccupied(true);
			setLocationDeviceId('');
			setLocationTargetId('');
			setLocationRangeKm('');
			setConditions([]);
		}
		setErrors([]);
		setAddingCondition(false);
	}, [props.open, props.trigger]);

	// Load webhooks
	useEffect(() => {
		if (props.open) {
			const fetchWebhooks = async () => {
				try {
					const response = await apiGet('webhook', '/list', {});
					if (response.ok) {
						const data = await response.json();
						setWebhooks(data.webhooks);
					}
				} catch (error) {
					console.error('Failed to load webhooks:', error);
				}
			};
			void fetchWebhooks();
		}
	}, [props.open]);

	// Get filtered device lists
	const occupancyDevices = React.useMemo(() => {
		return props.devices.filter((device) =>
			device.mergedAllClusters.some(
				(cluster) => cluster.name === DeviceClusterName.OCCUPANCY_SENSING
			)
		);
	}, [props.devices]);

	const buttonDevices = React.useMemo(() => {
		return props.devices.filter((device) =>
			device.mergedAllClusters.some((cluster) => cluster.name === DeviceClusterName.SWITCH)
		);
	}, [props.devices]);

	const onOffDevices = React.useMemo(() => {
		return props.devices.filter((device) =>
			device.mergedAllClusters.some((cluster) => {
				// Check if it's a direct OnOff cluster
				if (cluster.name === DeviceClusterName.ON_OFF) {
					return true;
				}
				// Check if OnOff is merged into ColorControl
				if (
					cluster.name === DeviceClusterName.COLOR_CONTROL &&
					'mergedClusters' in cluster
				) {
					return !!cluster.mergedClusters[DeviceClusterName.ON_OFF];
				}
				return false;
			})
		);
	}, [props.devices]);

	// Get button count and labels for the selected device
	const selectedDeviceButtons = React.useMemo(() => {
		if (!triggerDeviceId || triggerType !== 'button-press') {
			return [];
		}
		const device = buttonDevices.find((d) => d.uniqueId === triggerDeviceId);
		if (!device) {
			return [];
		}

		// Get switch clusters with their labels from the backend
		const switchClusters = device.mergedAllClusters.filter(
			(cluster): cluster is DashboardDeviceClusterSwitch =>
				cluster.name === DeviceClusterName.SWITCH
		);

		return switchClusters.map((cluster) => ({
			index: cluster.index,
			label: cluster.label,
		}));
	}, [triggerDeviceId, triggerType, buttonDevices]);

	const handleTriggerTypeChange = (_e: React.MouseEvent, value: TriggerType | null) => {
		if (value) {
			setTriggerType(value);
			setTriggerDeviceId('');
			setTriggerHostId('');
			setTriggerButtonIndex(undefined);
			setTriggerWebhookName('');
		}
	};

	const handleAddCondition = () => {
		let newCondition: SceneCondition;

		if (conditionType === SceneConditionType.HOST_HOME) {
			newCondition = {
				type: SceneConditionType.HOST_HOME,
				hostId: conditionHostId,
				shouldBeHome: conditionShouldBeHome,
			};
		} else if (conditionType === SceneConditionType.DEVICE_ON) {
			newCondition = {
				type: SceneConditionType.DEVICE_ON,
				deviceId: conditionDeviceId,
				shouldBeOn: conditionShouldBeOn,
			};
		} else if (conditionType === SceneConditionType.ANYONE_HOME) {
			newCondition = {
				type: SceneConditionType.ANYONE_HOME,
				shouldBeHome: conditionShouldBeHome,
			};
		} else if (conditionType === SceneConditionType.CUSTOM_JS) {
			newCondition = {
				type: SceneConditionType.CUSTOM_JS,
				code: conditionCustomJsCode,
			};
		} else if (conditionType === SceneConditionType.VARIABLE) {
			newCondition = {
				type: SceneConditionType.VARIABLE,
				variableName: conditionVariableName,
				shouldBeTrue: conditionShouldBeTrue,
				invert: conditionInvert || undefined,
			};
		} else {
			// TIME_WINDOW
			const windows: Record<string, { start: string; end: string }> = {};
			const days: DayOfWeek[] = [
				'monday',
				'tuesday',
				'wednesday',
				'thursday',
				'friday',
				'saturday',
				'sunday',
			];
			for (const day of days) {
				if (timeWindowDays[day]) {
					windows[day] = {
						start: timeWindowStart[day],
						end: timeWindowEnd[day],
					};
				}
			}
			newCondition = {
				type: SceneConditionType.TIME_WINDOW,
				windows,
			};
		}

		setConditions([...conditions, newCondition]);
		setAddingCondition(false);
		setConditionHostId('');
		setConditionDeviceId('');
		setConditionShouldBeHome(true);
		setConditionShouldBeOn(true);
		setConditionVariableName('');
		setConditionShouldBeTrue(true);
		setConditionInvert(false);
		// Reset time window state
		setTimeWindowDays({
			monday: false,
			tuesday: false,
			wednesday: false,
			thursday: false,
			friday: false,
			saturday: false,
			sunday: false,
		});
	};

	const handleRemoveCondition = (index: number) => {
		setConditions(conditions.filter((_, i) => i !== index));
	};

	const getConditionLabel = (condition: SceneCondition): string => {
		if (condition.type === SceneConditionType.HOST_HOME) {
			const host = props.hosts.find((h) => h.name === condition.hostId);
			return `${host?.name || condition.hostId} is ${condition.shouldBeHome ? 'home' : 'away'}`;
		} else if (condition.type === SceneConditionType.DEVICE_ON) {
			const device = props.devices.find((d) => d.uniqueId === condition.deviceId);
			return `${device?.name || condition.deviceId} is ${condition.shouldBeOn ? 'on' : 'off'}`;
		} else if (condition.type === SceneConditionType.ANYONE_HOME) {
			return condition.shouldBeHome ? 'Someone must be home' : 'Everyone must be away';
		} else if (condition.type === SceneConditionType.TIME_WINDOW) {
			const dayAbbr: Record<string, string> = {
				monday: 'Mon',
				tuesday: 'Tue',
				wednesday: 'Wed',
				thursday: 'Thu',
				friday: 'Fri',
				saturday: 'Sat',
				sunday: 'Sun',
			};

			const windows = condition.windows;
			const entries = Object.entries(windows);

			if (entries.length === 0) {
				return 'Time window (no days configured)';
			}

			// Group consecutive days with the same time window
			const groups: Array<{ days: string[]; window: { start: string; end: string } }> = [];
			for (const [day, window] of entries) {
				const lastGroup = groups[groups.length - 1];
				if (
					lastGroup &&
					lastGroup.window.start === window.start &&
					lastGroup.window.end === window.end
				) {
					lastGroup.days.push(dayAbbr[day]);
				} else {
					groups.push({ days: [dayAbbr[day]], window });
				}
			}

			// Format groups
			const formatted = groups.map((group) => {
				const dayRange =
					group.days.length > 1
						? `${group.days[0]}-${group.days[group.days.length - 1]}`
						: group.days[0];
				return `${dayRange} ${group.window.start}-${group.window.end}`;
			});

			return formatted.join(', ');
		} else if (condition.type === SceneConditionType.CUSTOM_JS) {
			return 'Custom JavaScript condition';
		} else if (condition.type === SceneConditionType.VARIABLE) {
			const invertText = condition.invert ? ' (inverted)' : '';
			return `Variable "${condition.variableName}" is ${condition.shouldBeTrue ? 'TRUE' : 'FALSE'}${invertText}`;
		}
		return '';
	};

	const validate = (): boolean => {
		const newErrors: string[] = [];

		// Validate trigger
		if (
			triggerType === SceneTriggerType.OCCUPANCY ||
			triggerType === SceneTriggerType.BUTTON_PRESS
		) {
			if (!triggerDeviceId) {
				newErrors.push('Please select a device for the trigger');
			}
		} else if (
			triggerType === SceneTriggerType.HOST_ARRIVAL ||
			triggerType === SceneTriggerType.HOST_DEPARTURE
		) {
			if (!triggerHostId) {
				newErrors.push('Please select a host for the trigger');
			}
		} else if (triggerType === SceneTriggerType.WEBHOOK) {
			if (!triggerWebhookName) {
				newErrors.push('Please select a webhook for the trigger');
			}
		} else {
			// ANYBODY_HOME, NOBODY_HOME, NOBODY_HOME_TIMEOUT require no extra fields
		}

		setErrors(newErrors);
		return newErrors.length === 0;
	};

	const handleSave = () => {
		if (!validate()) {
			return;
		}

		let trigger: SceneTrigger;

		if (triggerType === SceneTriggerType.OCCUPANCY) {
			trigger = {
				type: SceneTriggerType.OCCUPANCY,
				deviceId: triggerDeviceId,
				occupied: triggerOccupied,
			};
		} else if (triggerType === SceneTriggerType.BUTTON_PRESS) {
			trigger = {
				type: SceneTriggerType.BUTTON_PRESS,
				deviceId: triggerDeviceId,
				buttonIndex: triggerButtonIndex ?? 0,
			};
		} else if (triggerType === SceneTriggerType.HOST_ARRIVAL) {
			trigger = {
				type: SceneTriggerType.HOST_ARRIVAL,
				hostId: triggerHostId,
			};
		} else if (triggerType === SceneTriggerType.HOST_DEPARTURE) {
			trigger = {
				type: SceneTriggerType.HOST_DEPARTURE,
				hostId: triggerHostId,
			};
		} else if (triggerType === SceneTriggerType.WEBHOOK) {
			trigger = {
				type: SceneTriggerType.WEBHOOK,
				webhookName: triggerWebhookName,
			};
		} else if (triggerType === SceneTriggerType.ANYBODY_HOME) {
			trigger = { type: SceneTriggerType.ANYBODY_HOME };
		} else if (triggerType === SceneTriggerType.NOBODY_HOME) {
			trigger = { type: SceneTriggerType.NOBODY_HOME };
		} else if (triggerType === SceneTriggerType.CRON) {
			trigger = {
				type: SceneTriggerType.CRON,
				intervalMinutes: intervalMinutes,
			};
		} else if (triggerType === SceneTriggerType.DELAY) {
			trigger = {
				type: SceneTriggerType.DELAY,
				seconds: delaySeconds,
			};
		} else if (triggerType === SceneTriggerType.LOCATION_WITHIN_RANGE) {
			const range = parseFloat(locationRangeKm);
			const locationErrors: string[] = [];

			if (isNaN(range) || range <= 0) {
				locationErrors.push('Range must be a positive number');
			}
			if (!locationDeviceId) {
				locationErrors.push('Please select a device');
			}
			if (!locationTargetId) {
				locationErrors.push('Please select a target');
			}

			if (locationErrors.length === 0) {
				trigger = {
					type: SceneTriggerType.LOCATION_WITHIN_RANGE,
					deviceId: locationDeviceId,
					targetId: locationTargetId,
					rangeKm: range,
					enteredRange: locationEnteredRange,
				};
			} else {
				// Set a default trigger to avoid "used before assigned" error
				trigger = { type: SceneTriggerType.NOBODY_HOME_TIMEOUT };
			}
		} else {
			trigger = { type: SceneTriggerType.NOBODY_HOME_TIMEOUT };
		}

		const triggerWithConditions: SceneTriggerWithConditions = {
			trigger,
			conditions: conditions.length > 0 ? conditions : undefined,
		};

		props.onSave(triggerWithConditions);
	};

	const canAddCondition =
		(conditionType === SceneConditionType.HOST_HOME && conditionHostId) ||
		(conditionType === SceneConditionType.DEVICE_ON && conditionDeviceId) ||
		conditionType === SceneConditionType.ANYONE_HOME ||
		(conditionType === SceneConditionType.TIME_WINDOW &&
			Object.values(timeWindowDays).some((enabled) => enabled)) ||
		(conditionType === SceneConditionType.CUSTOM_JS &&
			conditionCustomJsCode.trim().length > 0) ||
		(conditionType === SceneConditionType.VARIABLE && conditionVariableName.trim().length > 0);

	return (
		<LocalizationProvider dateAdapter={AdapterDateFns}>
			<Dialog
				open={props.open}
				onClose={props.onClose}
				maxWidth="md"
				fullWidth
				fullScreen={fullScreen}
			>
				<DialogTitle>
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
						}}
					>
						<Typography variant="h6">
							{props.trigger ? 'Edit Trigger' : 'Add Trigger'}
						</Typography>
						<IconButton onClick={props.onClose} size="small">
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>

				<DialogContent>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
						{/* Errors */}
						{errors.length > 0 && (
							<Alert severity="error">
								{errors.map((error, i) => (
									<Typography key={i} variant="body2">
										{error}
									</Typography>
								))}
							</Alert>
						)}

						{/* Trigger Configuration */}
						<Box>
							<Typography variant="subtitle1" fontWeight="medium" gutterBottom>
								Trigger
							</Typography>
							<Typography
								variant="caption"
								color="text.secondary"
								sx={{ mb: 2, display: 'block' }}
							>
								Select what event will trigger this scene
							</Typography>

							<ToggleButtonGroup
								value={triggerType}
								exclusive
								onChange={handleTriggerTypeChange}
								fullWidth
								size="small"
								sx={{ mb: 2 }}
							>
								<ToggleButton value={SceneTriggerType.OCCUPANCY}>
									Occupancy
								</ToggleButton>
								<ToggleButton value={SceneTriggerType.BUTTON_PRESS}>
									Button
								</ToggleButton>
								<ToggleButton value={SceneTriggerType.WEBHOOK}>
									Webhook
								</ToggleButton>
								<ToggleButton value={SceneTriggerType.HOST_ARRIVAL}>
									Arrival
								</ToggleButton>
								<ToggleButton value={SceneTriggerType.HOST_DEPARTURE}>
									Departure
								</ToggleButton>
								<ToggleButton value={SceneTriggerType.ANYBODY_HOME}>
									Anybody Home
								</ToggleButton>
								<ToggleButton value={SceneTriggerType.NOBODY_HOME}>
									Nobody Home
								</ToggleButton>
								<ToggleButton value={SceneTriggerType.NOBODY_HOME_TIMEOUT}>
									Nobody Home Timeout
								</ToggleButton>
								<ToggleButton value={SceneTriggerType.CRON}>Interval</ToggleButton>
								<ToggleButton value={SceneTriggerType.DELAY}>Delay</ToggleButton>
								<ToggleButton value={SceneTriggerType.LOCATION_WITHIN_RANGE}>
									Location
								</ToggleButton>
							</ToggleButtonGroup>

							{/* Occupancy trigger */}
							{triggerType === SceneTriggerType.OCCUPANCY && (
								<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
									<Autocomplete
										options={occupancyDevices}
										getOptionLabel={(option) => option.name}
										value={
											occupancyDevices.find(
												(d) => d.uniqueId === triggerDeviceId
											) ?? null
										}
										onChange={(_e, newValue) => {
											setTriggerDeviceId(newValue?.uniqueId ?? '');
										}}
										renderInput={(params) => (
											<TextField
												{...params}
												label="Occupancy Sensor"
												required
											/>
										)}
									/>
									<FormControlLabel
										control={
											<Switch
												checked={triggerOccupied}
												onChange={(e) =>
													setTriggerOccupied(e.target.checked)
												}
											/>
										}
										label={
											triggerOccupied
												? 'Trigger on occupancy detected'
												: 'Trigger on occupancy removed'
										}
									/>
								</Box>
							)}

							{/* Button press trigger */}
							{triggerType === SceneTriggerType.BUTTON_PRESS && (
								<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
									<Autocomplete
										options={buttonDevices}
										getOptionLabel={(option) => option.name}
										value={
											buttonDevices.find(
												(d) => d.uniqueId === triggerDeviceId
											) ?? null
										}
										onChange={(_e, newValue) => {
											setTriggerDeviceId(newValue?.uniqueId ?? '');
											setTriggerButtonIndex(undefined);
										}}
										renderInput={(params) => (
											<TextField {...params} label="Button Device" required />
										)}
									/>
									{triggerDeviceId && selectedDeviceButtons.length > 0 && (
										<Autocomplete
											options={selectedDeviceButtons}
											getOptionLabel={(option) => option.label}
											value={
												selectedDeviceButtons.find(
													(b) => b.index === triggerButtonIndex
												) ?? null
											}
											onChange={(_e, newValue) => {
												setTriggerButtonIndex(
													newValue !== null ? newValue.index : undefined
												);
											}}
											renderInput={(params) => (
												<TextField
													{...params}
													label="Button"
													helperText="Optional: Leave empty to trigger on any button"
												/>
											)}
										/>
									)}
								</Box>
							)}

							{/* Host arrival trigger */}
							{triggerType === SceneTriggerType.HOST_ARRIVAL && (
								<Autocomplete
									options={props.hosts}
									getOptionLabel={(option) => option.name}
									value={
										props.hosts.find((h) => h.name === triggerHostId) ?? null
									}
									onChange={(_e, newValue) => {
										setTriggerHostId(newValue?.name ?? '');
									}}
									renderInput={(params) => (
										<TextField {...params} label="Host" required />
									)}
								/>
							)}

							{/* Host departure trigger */}
							{triggerType === SceneTriggerType.HOST_DEPARTURE && (
								<Autocomplete
									options={props.hosts}
									getOptionLabel={(option) => option.name}
									value={
										props.hosts.find((h) => h.name === triggerHostId) ?? null
									}
									onChange={(_e, newValue) => {
										setTriggerHostId(newValue?.name ?? '');
									}}
									renderInput={(params) => (
										<TextField {...params} label="Host" required />
									)}
								/>
							)}

							{/* Webhook trigger */}
							{triggerType === SceneTriggerType.WEBHOOK && (
								<Autocomplete<Webhook>
									options={webhooks}
									getOptionLabel={(option) => option.name}
									value={
										webhooks.find((w) => w.name === triggerWebhookName) ?? null
									}
									onChange={(_e, newValue) => {
										setTriggerWebhookName(newValue?.name ?? '');
									}}
									renderInput={(params) => (
										<TextField {...params} label="Webhook" required />
									)}
								/>
							)}

							{/* Interval trigger */}
							{triggerType === SceneTriggerType.CRON && (
								<TextField
									type="number"
									label="Run Every (minutes)"
									value={intervalMinutes}
									onChange={(e) => {
										const val = parseInt(e.target.value);
										if (val >= 1) {
											setIntervalMinutes(val);
										}
									}}
									inputProps={{ min: 1 }}
									helperText="Scene will trigger every X minutes"
									fullWidth
								/>
							)}

							{/* Delay trigger */}
							{triggerType === SceneTriggerType.DELAY && (
								<TextField
									type="number"
									label="Delay (seconds)"
									value={delaySeconds}
									onChange={(e) => {
										const val = parseInt(e.target.value);
										if (val >= 0) {
											setDelaySeconds(val);
										}
									}}
									inputProps={{ min: 0, max: 3600 }}
									helperText="Wait this many seconds before executing the scene"
									fullWidth
								/>
							)}

							{/* Location trigger */}
							{triggerType === SceneTriggerType.LOCATION_WITHIN_RANGE && (
								<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
									<Autocomplete
										options={locationDevices}
										getOptionLabel={(option) => `${option.name} (${option.id})`}
										value={
											locationDevices.find(
												(d) => d.id === locationDeviceId
											) ?? null
										}
										onChange={(_e, newValue) => {
											setLocationDeviceId(newValue?.id ?? '');
										}}
										renderInput={(params) => (
											<TextField {...params} label="Device" required />
										)}
									/>
									<Autocomplete
										options={locationTargets}
										getOptionLabel={(option) => `${option.name} (${option.id})`}
										value={
											locationTargets.find(
												(t) => t.id === locationTargetId
											) ?? null
										}
										onChange={(_e, newValue) => {
											setLocationTargetId(newValue?.id ?? '');
										}}
										renderInput={(params) => (
											<TextField {...params} label="Target" required />
										)}
									/>
									<TextField
										label="Range (km)"
										type="number"
										value={locationRangeKm}
										onChange={(e) => setLocationRangeKm(e.target.value)}
										inputProps={{ step: '0.1', min: 0.01 }}
										required
									/>
									<FormControlLabel
										control={
											<Switch
												checked={locationEnteredRange}
												onChange={(e) =>
													setLocationEnteredRange(e.target.checked)
												}
											/>
										}
										label="Entered Range"
									/>
									<Typography variant="caption" color="text.secondary">
										Trigger when {locationDeviceId || 'device'} is within{' '}
										{locationRangeKm || 'X'}km of {locationTargetId || 'target'}
									</Typography>
									<LocationTriggerMapPreview
										deviceId={locationDeviceId}
										targetId={locationTargetId}
										rangeKm={locationRangeKm}
										devices={locationDevicesFull}
										targets={locationTargetsFull}
									/>
								</Box>
							)}
						</Box>

						<Divider />

						{/* Conditions */}
						<Box>
							<Typography variant="subtitle1" fontWeight="medium" gutterBottom>
								Conditions (Optional)
							</Typography>
							<Typography
								variant="caption"
								color="text.secondary"
								sx={{ mb: 2, display: 'block' }}
							>
								All conditions must be true for the trigger to fire (AND logic)
							</Typography>

							{/* Condition list */}
							{conditions.length > 0 && (
								<Box
									sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}
								>
									{conditions.map((condition, index) => (
										<Card key={index} variant="outlined" sx={{ p: 1.5 }}>
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'flex-start',
													gap: 1,
												}}
											>
												<Box sx={{ flex: 1 }}>
													<Typography variant="body2" gutterBottom>
														{getConditionLabel(condition)}
													</Typography>
													<FormControlLabel
														control={
															<Checkbox
																size="small"
																checked={
																	condition.checkOnManual ?? false
																}
																onChange={(e) => {
																	const newConditions = [
																		...conditions,
																	];
																	newConditions[index] = {
																		...newConditions[index],
																		checkOnManual:
																			e.target.checked,
																	};
																	setConditions(newConditions);
																}}
															/>
														}
														label={
															<Typography
																variant="caption"
																color="text.secondary"
															>
																Check on manual trigger
															</Typography>
														}
														sx={{ mt: 0.5 }}
													/>
												</Box>
												<IconButton
													size="small"
													onClick={() => handleRemoveCondition(index)}
												>
													<DeleteIcon fontSize="small" />
												</IconButton>
											</Box>
										</Card>
									))}
								</Box>
							)}

							{/* Add condition section */}
							{!addingCondition ? (
								<Button
									variant="outlined"
									startIcon={<AddIcon />}
									onClick={() => setAddingCondition(true)}
									fullWidth
								>
									Add Condition
								</Button>
							) : (
								<Card variant="outlined" sx={{ p: 2 }}>
									<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
										<Typography variant="subtitle2">New Condition</Typography>

										<ToggleButtonGroup
											value={conditionType}
											exclusive
											onChange={(_e, value) => {
												if (value) {
													setConditionType(value);
												}
											}}
											fullWidth
											size="small"
										>
											<ToggleButton value={SceneConditionType.HOST_HOME}>
												Host Home/Away
											</ToggleButton>
											<ToggleButton value={SceneConditionType.DEVICE_ON}>
												Device On/Off
											</ToggleButton>
											<ToggleButton value={SceneConditionType.TIME_WINDOW}>
												Time Window
											</ToggleButton>
											<ToggleButton value={SceneConditionType.ANYONE_HOME}>
												Someone Home/Away
											</ToggleButton>
											<ToggleButton value={SceneConditionType.CUSTOM_JS}>
												Custom JS
											</ToggleButton>
											<ToggleButton value={SceneConditionType.VARIABLE}>
												Variable
											</ToggleButton>
										</ToggleButtonGroup>

										{conditionType === SceneConditionType.HOST_HOME && (
											<>
												<Autocomplete
													options={props.hosts}
													getOptionLabel={(option) => option.name}
													value={
														props.hosts.find(
															(h) => h.name === conditionHostId
														) ?? null
													}
													onChange={(_e, newValue) => {
														setConditionHostId(newValue?.name ?? '');
													}}
													renderInput={(params) => (
														<TextField
															{...params}
															label="Host"
															required
														/>
													)}
												/>
												<FormControlLabel
													control={
														<Switch
															checked={conditionShouldBeHome}
															onChange={(e) =>
																setConditionShouldBeHome(
																	e.target.checked
																)
															}
														/>
													}
													label={
														conditionShouldBeHome
															? 'Must be home'
															: 'Must be away'
													}
												/>
											</>
										)}

										{conditionType === SceneConditionType.DEVICE_ON && (
											<>
												<Autocomplete
													options={onOffDevices}
													getOptionLabel={(option) => option.name}
													value={
														onOffDevices.find(
															(d) => d.uniqueId === conditionDeviceId
														) ?? null
													}
													onChange={(_e, newValue) => {
														setConditionDeviceId(
															newValue?.uniqueId ?? ''
														);
													}}
													renderInput={(params) => (
														<TextField
															{...params}
															label="Device"
															required
														/>
													)}
												/>
												<FormControlLabel
													control={
														<Switch
															checked={conditionShouldBeOn}
															onChange={(e) =>
																setConditionShouldBeOn(
																	e.target.checked
																)
															}
														/>
													}
													label={
														conditionShouldBeOn
															? 'Must be on'
															: 'Must be off'
													}
												/>
											</>
										)}

										{conditionType === SceneConditionType.TIME_WINDOW && (
											<Box
												sx={{
													display: 'flex',
													flexDirection: 'column',
													gap: 1.5,
												}}
											>
												<Typography
													variant="caption"
													color="text.secondary"
												>
													Enable days and set time windows. Days without a
													window are allowed all day.
												</Typography>

												{(
													[
														'monday',
														'tuesday',
														'wednesday',
														'thursday',
														'friday',
														'saturday',
														'sunday',
													] as DayOfWeek[]
												).map((day) => {
													const dayLabel =
														day.charAt(0).toUpperCase() + day.slice(1);
													return (
														<Box
															key={day}
															sx={{
																display: 'flex',
																alignItems: 'center',
																gap: 1,
																flexWrap: 'wrap',
															}}
														>
															<FormControlLabel
																control={
																	<Switch
																		checked={
																			timeWindowDays[day]
																		}
																		onChange={(e) =>
																			setTimeWindowDays({
																				...timeWindowDays,
																				[day]: e.target
																					.checked,
																			})
																		}
																		size="small"
																	/>
																}
																label={dayLabel}
																sx={{ minWidth: 120 }}
															/>
															{timeWindowDays[day] && (
																<>
																	<TimePicker
																		label="Start"
																		value={timeStringToDate(
																			timeWindowStart[day]
																		)}
																		onChange={(
																			newValue: Date | null
																		) => {
																			setTimeWindowStart({
																				...timeWindowStart,
																				[day]: dateToTimeString(
																					newValue
																				),
																			});
																		}}
																		ampm={false}
																		slotProps={{
																			textField: {
																				size: 'small',
																				sx: { width: 130 },
																			},
																		}}
																	/>
																	<Typography
																		variant="body2"
																		color="text.secondary"
																	>
																		to
																	</Typography>
																	<TimePicker
																		label="End"
																		value={timeStringToDate(
																			timeWindowEnd[day]
																		)}
																		onChange={(
																			newValue: Date | null
																		) => {
																			setTimeWindowEnd({
																				...timeWindowEnd,
																				[day]: dateToTimeString(
																					newValue
																				),
																			});
																		}}
																		ampm={false}
																		slotProps={{
																			textField: {
																				size: 'small',
																				sx: { width: 130 },
																			},
																		}}
																	/>
																	{timeWindowStart[day] >
																		timeWindowEnd[day] && (
																		<Typography
																			variant="caption"
																			color="warning.main"
																			sx={{ ml: 1 }}
																		>
																			(overnight)
																		</Typography>
																	)}
																</>
															)}
														</Box>
													);
												})}
											</Box>
										)}

										{conditionType === SceneConditionType.ANYONE_HOME && (
											<>
												<FormControlLabel
													control={
														<Switch
															checked={conditionShouldBeHome}
															onChange={(e) =>
																setConditionShouldBeHome(
																	e.target.checked
																)
															}
														/>
													}
													label={
														conditionShouldBeHome
															? 'Someone must be home'
															: 'Everyone must be away'
													}
												/>
											</>
										)}

										{conditionType === SceneConditionType.CUSTOM_JS && (
											<TextField
												label="JavaScript Code"
												value={conditionCustomJsCode}
												onChange={(e) =>
													setConditionCustomJsCode(e.target.value)
												}
												multiline
												rows={8}
												fullWidth
												helperText="Return true to pass, false to fail the condition"
												sx={{ fontFamily: 'monospace' }}
											/>
										)}

										{conditionType === SceneConditionType.VARIABLE && (
											<>
												<Autocomplete
													options={Object.keys(variables)}
													freeSolo
													value={conditionVariableName}
													onChange={(_e, newValue) => {
														setConditionVariableName(newValue || '');
													}}
													onInputChange={(_e, newValue) => {
														setConditionVariableName(newValue);
													}}
													renderInput={(params) => (
														<TextField
															{...params}
															label="Variable Name"
															required
														/>
													)}
												/>
												<FormControlLabel
													control={
														<Switch
															checked={conditionShouldBeTrue}
															onChange={(e) =>
																setConditionShouldBeTrue(
																	e.target.checked
																)
															}
														/>
													}
													label={
														conditionShouldBeTrue
															? 'Variable should be TRUE'
															: 'Variable should be FALSE'
													}
												/>
												<FormControlLabel
													control={
														<Checkbox
															checked={conditionInvert}
															onChange={(e) =>
																setConditionInvert(e.target.checked)
															}
														/>
													}
													label="Invert condition"
												/>
											</>
										)}

										<Box
											sx={{
												display: 'flex',
												gap: 1,
												justifyContent: 'flex-end',
											}}
										>
											<Button
												onClick={() => {
													setAddingCondition(false);
													setConditionHostId('');
													setConditionDeviceId('');
												}}
											>
												Cancel
											</Button>
											<Button
												variant="contained"
												onClick={handleAddCondition}
												disabled={!canAddCondition}
											>
												Add
											</Button>
										</Box>
									</Box>
								</Card>
							)}
						</Box>
					</Box>
				</DialogContent>

				<DialogActions sx={{ p: 2, gap: 1 }}>
					<Button onClick={props.onClose} fullWidth={isMobile}>
						Cancel
					</Button>
					<Button variant="contained" onClick={handleSave} fullWidth={isMobile}>
						Save Trigger
					</Button>
				</DialogActions>
			</Dialog>
		</LocalizationProvider>
	);
};
