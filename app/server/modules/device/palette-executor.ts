import type { Palette } from '../../../../types/palette';
import { DeviceColorControlCluster } from './cluster';
import { logTag } from '../../lib/logging/logger';
import { Color } from '../../lib/color';
import type { Device } from './device';

/**
 * Hash a string to a number for deterministic color selection
 */
function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash);
}

/**
 * Select a color from a palette based on device ID
 */
function selectColorForDevice(deviceId: string, palette: Palette): string {
	const hash = hashString(deviceId);
	const colorIndex = hash % palette.colors.length;
	return palette.colors[colorIndex];
}

/**
 * Convert hex color to HSV format
 */
function hexToHSV(hex: string): { hue: number; saturation: number; value: number } {
	// Remove # if present
	const cleanHex = hex.replace('#', '');

	// Parse RGB
	const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
	const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
	const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

	// Convert RGB to HSV
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;

	let hue = 0;
	if (delta !== 0) {
		if (max === r) {
			hue = ((g - b) / delta) % 6;
		} else if (max === g) {
			hue = (b - r) / delta + 2;
		} else {
			hue = (r - g) / delta + 4;
		}
		hue = hue * 60;
		if (hue < 0) {
			hue += 360;
		}
	}

	const saturation = max === 0 ? 0 : delta / max;
	const value = max;

	return {
		hue: hue / 360, // Normalize to 0-1
		saturation,
		value,
	};
}

/**
 * Apply a palette to a collection of devices
 */
export async function applyPaletteToDevices(devices: Device[], palette: Palette): Promise<boolean> {
	const results = await Promise.all(
		devices.map(async (device) => {
			const colorControlCluster = device.getClusterByType(DeviceColorControlCluster);
			if (!colorControlCluster) {
				logTag(
					'palette',
					'yellow',
					'Device has no ColorControl cluster:',
					device.getUniqueId()
				);
				return false;
			}

			try {
				const hexColor = selectColorForDevice(device.getUniqueId(), palette);
				const hsv = hexToHSV(hexColor);
				const color = Color.fromHSV(hsv.hue, hsv.saturation, hsv.value);

				await colorControlCluster.setColor({ color });
				logTag(
					'palette',
					'green',
					`Applied color ${hexColor} to device ${device.getUniqueId()}`
				);
				return true;
			} catch (error) {
				logTag(
					'palette',
					'red',
					`Failed to apply color to device ${device.getUniqueId()}:`,
					error
				);
				return false;
			}
		})
	);

	return results.every((success) => success);
}
