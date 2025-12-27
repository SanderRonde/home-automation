import {
	calculateSunPosition,
	calculateSunPositionDifference,
	type SunPosition,
} from './sunPosition';
import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { kelvinToRgb, rgbToHsv } from '../../lib/color';
import { apiGet } from '../../lib/fetch';
import React from 'react';

export interface LightOverlay {
	deviceId: string;
	sanitizedId: string;
	imageUrl: string;
	isOn: boolean;
	brightness: number; // 0-1
	color?: { hue: number; saturation: number; value: number };
}

export interface FloorplanRenderInfo {
	hasRenders: boolean;
	currentTimeFolder: string | null;
	baseImageUrl: string | null;
	lightOverlays: LightOverlay[];
}

/**
 * Sanitizes a device unique ID to match the filename format used on disk.
 * Replaces all non-alphanumeric characters with underscores.
 */
function sanitizeDeviceId(uniqueId: string): string {
	return uniqueId.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Finds the closest time folder to the current time.
 * Time folders are in HHMM format (e.g., "0000", "0600", "1200").
 * Uses the most recent past time, or wraps to the last time if before first.
 */
function findClosestTimeFolder(timeFolders: string[], currentTime: Date): string | null {
	if (timeFolders.length === 0) {
		return null;
	}

	const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

	// Convert folder names to minutes and sort
	const folderMinutes = timeFolders
		.map((folder) => {
			const hours = parseInt(folder.slice(0, 2), 10);
			const minutes = parseInt(folder.slice(2, 4), 10);
			return { folder, minutes: hours * 60 + minutes };
		})
		.sort((a, b) => a.minutes - b.minutes);

	// Find the most recent past time
	let selected = folderMinutes[folderMinutes.length - 1]; // Default to last (for times before first)
	for (const fm of folderMinutes) {
		if (fm.minutes <= currentMinutes) {
			selected = fm;
		} else {
			break;
		}
	}

	return selected.folder;
}

/**
 * Pre-calculates sun positions for each time folder on the image date (16/08/2025).
 * Images were taken on August 16, 2025 at specific times.
 * Uses local time to match the time folder format (HHMM in local time).
 */
function calculateImageSunPositions(
	timeFolders: string[],
	latitude: number,
	longitude: number
): Map<string, SunPosition> {
	const positions = new Map<string, SunPosition>();

	for (const folder of timeFolders) {
		const hours = parseInt(folder.slice(0, 2), 10);
		const minutes = parseInt(folder.slice(2, 4), 10);

		// Create date for this specific time on 16/08/2025 in local time
		const folderDate = new Date(2025, 7, 16, hours, minutes, 0, 0); // Month is 0-indexed (7 = August)

		const sunPos = calculateSunPosition(folderDate, latitude, longitude);
		positions.set(folder, sunPos);
	}

	return positions;
}

/**
 * Finds the closest time folder based on sun position matching.
 * Falls back to time-based matching if location is not available.
 */
function findClosestTimeFolderBySunPosition(
	timeFolders: string[],
	currentTime: Date,
	imageSunPositions: Map<string, SunPosition> | null,
	currentSunPosition: SunPosition | null
): string | null {
	if (timeFolders.length === 0) {
		return null;
	}

	// If we have sun position data, use it for matching
	if (imageSunPositions && currentSunPosition) {
		let closestFolder: string | null = null;
		let smallestDistance = Infinity;

		for (const folder of timeFolders) {
			const imageSunPos = imageSunPositions.get(folder);
			if (!imageSunPos) {
				continue;
			}

			const distance = calculateSunPositionDifference(currentSunPosition, imageSunPos);
			if (distance < smallestDistance) {
				smallestDistance = distance;
				closestFolder = folder;
			}
		}

		return closestFolder;
	}

	// Fall back to time-based matching
	return findClosestTimeFolder(timeFolders, currentTime);
}

export function useDeviceStates(
	devices: DeviceListWithValuesResponse
): Record<string, FloorPlanDeviceState> {
	return React.useMemo(() => {
		const deviceStates: Record<string, FloorPlanDeviceState> = {};

		for (const device of devices) {
			// Find relevant clusters for this device
			let isOn = false;
			let brightness = 1.0;
			let color: { hue: number; saturation: number; value: number } | undefined;

			for (const cluster of device.flatAllClusters) {
				if (cluster.name === DeviceClusterName.ON_OFF) {
					isOn = cluster.isOn;
				} else if (cluster.name === DeviceClusterName.LEVEL_CONTROL) {
					brightness = cluster.currentLevel / 100;
				} else if (
					cluster.name === DeviceClusterName.COLOR_CONTROL &&
					cluster.clusterVariant === 'xy'
				) {
					color = cluster.color;
				} else if (
					cluster.name === DeviceClusterName.COLOR_CONTROL &&
					cluster.clusterVariant === 'temperature'
				) {
					// Convert color temperature (Kelvin) to HSV
					if (cluster.colorTemperature !== undefined) {
						const rgb = kelvinToRgb(cluster.colorTemperature);
						color = rgbToHsv(rgb.r, rgb.g, rgb.b);
					}
				}
			}

			// Only include if the device is on
			if (isOn) {
				deviceStates[device.uniqueId] = {
					isOn,
					brightness,
					color,
				};
			}
		}
		return deviceStates;
	}, [devices]);
}

export interface FloorPlanDeviceState {
	isOn?: boolean;
	brightness?: number; // 0-1
	color?: { hue: number; saturation: number; value: number };
}

export function useFloorplanRender(
	deviceStates: Record<string, FloorPlanDeviceState>,
	overrideTimeFolder?: string | null
): FloorplanRenderInfo {
	const [renderInfo, setRenderInfo] = React.useState<{
		hasRenders: boolean;
		timeFolders: string[];
		lightIds: string[];
	}>({ hasRenders: false, timeFolders: [], lightIds: [] });

	const [currentTime, setCurrentTime] = React.useState(() => new Date());
	const [location, setLocation] = React.useState<{
		latitude: number;
		longitude: number;
	} | null>(null);

	// Fetch floorplan render info on mount
	React.useEffect(() => {
		let cancelled = false;

		const fetchInfo = async () => {
			try {
				const response = await apiGet('device', '/floorplan-renders/info', {});
				if (response.ok && !cancelled) {
					const data = await response.json();
					// Copy to mutable arrays
					setRenderInfo({
						hasRenders: data.hasRenders,
						timeFolders: [...data.timeFolders],
						lightIds: [...data.lightIds],
					});
				}
			} catch (error) {
				console.error('Failed to fetch floorplan render info:', error);
			}
		};

		void fetchInfo();

		return () => {
			cancelled = true;
		};
	}, []);

	// Fetch location on mount
	React.useEffect(() => {
		let cancelled = false;

		const fetchLocation = async () => {
			try {
				const response = await apiGet('device', '/location', {});
				if (response.ok && !cancelled) {
					const data = await response.json();
					if (data.location) {
						setLocation(data.location);
					}
				}
			} catch (error) {
				console.error('Failed to fetch location:', error);
			}
		};

		void fetchLocation();

		return () => {
			cancelled = true;
		};
	}, []);

	// Update current time every minute to handle time folder changes
	React.useEffect(() => {
		const interval = setInterval(() => {
			setCurrentTime(new Date());
		}, 60000); // Every minute

		return () => clearInterval(interval);
	}, []);

	// Pre-calculate sun positions for image times (16/08/2025)
	const imageSunPositions = React.useMemo<Map<string, SunPosition> | null>(() => {
		if (!location || !renderInfo.timeFolders.length) {
			return null;
		}

		try {
			return calculateImageSunPositions(
				renderInfo.timeFolders,
				location.latitude,
				location.longitude
			);
		} catch (error) {
			console.error('Failed to calculate image sun positions:', error);
			return null;
		}
	}, [location, renderInfo.timeFolders]);

	// Calculate current sun position
	const currentSunPosition = React.useMemo<SunPosition | null>(() => {
		if (!location) {
			return null;
		}

		try {
			return calculateSunPosition(currentTime, location.latitude, location.longitude);
		} catch (error) {
			console.error('Failed to calculate current sun position:', error);
			return null;
		}
	}, [location, currentTime]);

	// Calculate the current time folder and overlay info
	const result = React.useMemo<FloorplanRenderInfo>(() => {
		if (!renderInfo.hasRenders || renderInfo.timeFolders.length === 0) {
			return {
				hasRenders: false,
				currentTimeFolder: null,
				baseImageUrl: null,
				lightOverlays: [],
			};
		}

		// Use override if provided, otherwise find closest based on sun position (or time if no location)
		const timeFolder =
			overrideTimeFolder !== undefined && overrideTimeFolder !== null
				? overrideTimeFolder
				: findClosestTimeFolderBySunPosition(
						renderInfo.timeFolders,
						currentTime,
						imageSunPositions,
						currentSunPosition
					);
		if (!timeFolder || !renderInfo.timeFolders.includes(timeFolder)) {
			return {
				hasRenders: false,
				currentTimeFolder: null,
				baseImageUrl: null,
				lightOverlays: [],
			};
		}

		const baseImageUrl = `/floorplan-renders/floorplan/${timeFolder}/base.png`;

		// Create a set of available light IDs for quick lookup
		const availableLightIds = new Set(renderInfo.lightIds);

		// Build light overlays from device state
		const lightOverlays: LightOverlay[] = [];

		for (const deviceId in deviceStates) {
			const deviceState = deviceStates[deviceId];

			const sanitizedId = sanitizeDeviceId(deviceId);
			if (availableLightIds.has(sanitizedId) && deviceState.isOn) {
				lightOverlays.push({
					deviceId,
					sanitizedId,
					imageUrl: `/floorplan-renders/floorplan/${timeFolder}/light.${sanitizeDeviceId(deviceId)}.png`,
					isOn: deviceState.isOn ?? false,
					brightness: deviceState.brightness ?? 1.0,
					color: deviceState.color,
				});
			}
		}

		return {
			hasRenders: true,
			currentTimeFolder: timeFolder,
			baseImageUrl,
			lightOverlays,
		};
	}, [
		renderInfo,
		currentTime,
		overrideTimeFolder,
		imageSunPositions,
		currentSunPosition,
		deviceStates,
	]);

	return result;
}
