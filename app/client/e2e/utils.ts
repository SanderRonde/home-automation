import type { Page, Locator } from '@playwright/test';

/**
 * E2E test utility functions
 */

/**
 * Wait for WebSocket connection to be established
 */
export async function waitForWebSocket(page: Page, timeout = 5000): Promise<void> {
	await page.waitForFunction(
		() => {
			return (window as unknown as { wsConnected?: boolean }).wsConnected === true;
		},
		{ timeout }
	);
}

/**
 * Wait for element to be visible and stable (not animating)
 */
export async function waitForStable(locator: Locator, timeout = 5000): Promise<void> {
	await locator.waitFor({ state: 'visible', timeout });
	// Wait a bit for animations to finish
	await new Promise((resolve) => setTimeout(resolve, 300));
}

/**
 * Click and wait for navigation or response
 */
export async function clickAndWaitForResponse(
	page: Page,
	locator: Locator,
	urlPattern: string | RegExp
): Promise<void> {
	const responsePromise = page.waitForResponse(urlPattern);
	await locator.click();
	await responsePromise;
}

/**
 * Fill form field and wait for it to be updated
 */
export async function fillAndWait(locator: Locator, value: string, delay = 100): Promise<void> {
	await locator.fill(value);
	await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Simulate server-side device state change via API
 */
export async function simulateDeviceStateChange(
	page: Page,
	deviceId: string,
	state: { isOn?: boolean; position?: number }
): Promise<void> {
	// This would typically trigger a WebSocket update
	// For now, we can call the API directly
	if (state.isOn !== undefined) {
		await page.request.post('/api/device/control/onoff', {
			data: { uniqueId: deviceId, isOn: state.isOn },
		});
	}
	if (state.position !== undefined) {
		await page.request.post('/api/device/control/window-covering', {
			data: { uniqueId: deviceId, targetPosition: state.position },
		});
	}
	// Wait for WebSocket update to propagate
	await page.waitForTimeout(500);
}

/**
 * Get computed style of an element
 */
export async function getComputedStyle(locator: Locator, property: string): Promise<string> {
	return locator.evaluate((el, prop) => {
		return window.getComputedStyle(el).getPropertyValue(prop);
	}, property);
}

/**
 * Scroll element into view if needed
 */
export async function scrollIntoView(locator: Locator): Promise<void> {
	await locator.evaluate((el) => {
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	});
	await new Promise((resolve) => setTimeout(resolve, 300));
}

/**
 * Take screenshot with a descriptive name
 */
export async function screenshot(
	page: Page,
	name: string,
	options?: { fullPage?: boolean }
): Promise<void> {
	await page.screenshot({
		path: `test-results/screenshots/${name}.png`,
		fullPage: options?.fullPage ?? false,
	});
}

/**
 * Mock a device for testing
 */
export interface MockDevice {
	uniqueId: string;
	name: string;
	source: string;
	clusters: Array<{
		name: string;
		isOn?: boolean;
		targetPositionLiftPercentage?: number;
		icon?: string;
	}>;
}

/**
 * Create a mock device via test API (if available)
 * For now, this is a placeholder - in real implementation,
 * you'd need a test-only API endpoint to inject mock devices
 */
export function createMockDevice(_page: Page, device: MockDevice): void {
	// This would call a test-only API endpoint
	// For now, we'll rely on actual device connections or manual setup
	// Mock device creation not yet implemented: device
	void device; // Suppress unused warning
}
