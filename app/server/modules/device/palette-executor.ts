import type { Palette } from '../../../../types/palette';
import { DeviceColorControlCluster } from './cluster';
import { logTag } from '../../lib/logging/logger';
import { Color } from '../../lib/color';
import type { Device } from './device';

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
	const results: boolean[] = [];
	for (const device of devices) {
		const colorControlCluster = device.getClusterByType(DeviceColorControlCluster);
		if (!colorControlCluster) {
			logTag(
				'palette',
				'yellow',
				'Device has no ColorControl cluster:',
				device.getUniqueId()
			);
			results.push(false);
			await new Promise((resolve) => setTimeout(resolve, 50));
			continue;
		}

		try {
			const segmentCount = colorControlCluster.getSegmentCount();
			const randomPalettes: string[] = [];
			for (let i = 0; i < Math.ceil(segmentCount / palette.colors.length); i++) {
				const shuffledColors = [...palette.colors].sort(() => Math.random() - 0.5);
				randomPalettes.push(...shuffledColors);
			}

			const colors = randomPalettes.slice(0, segmentCount).map((hexColor) => {
				const hsv = hexToHSV(hexColor);
				return Color.fromHSV(hsv.hue, hsv.saturation, hsv.value);
			});

			await colorControlCluster.setColor({ colors });
			logTag(
				'palette',
				'green',
				`Applied colors ${colors.map((color) => color.toHex()).join(', ')} to device ${device.getUniqueId()}`
			);

			results.push(true);
		} catch (error) {
			logTag(
				'palette',
				'red',
				`Failed to apply color to device ${device.getUniqueId()}:`,
				error
			);
			results.push(false);
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}

	return results.every((success) => success);
}
