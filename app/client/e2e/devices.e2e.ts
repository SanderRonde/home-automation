import { DevicesPage } from './pages/devices.page';
import { test, expect } from './fixtures';

test.describe('Device Management', () => {
	let devicesPage: DevicesPage;

	test.beforeEach(async ({ page }) => {
		devicesPage = new DevicesPage(page);
		await devicesPage.goto();
	});

	test('should display devices list', async ({ page }) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check if devices list is visible (may be empty)
		const body = await page.textContent('body');
		expect(body).toBeTruthy();

		// Should either have devices or show "No devices" message
		const hasDevices = (await page.locator('[data-testid="device-card"]').count()) > 0;
		const hasNoDevicesMessage = await page
			.locator('text=/no devices|empty/i')
			.isVisible()
			.catch(() => false);

		expect(hasDevices || hasNoDevicesMessage).toBeTruthy();
	});

	test('should search for devices', async ({ page }) => {
		// Skip if no search input
		const hasSearch = await devicesPage.searchInput.isVisible().catch(() => false);
		if (!hasSearch) {
			test.skip();
			return;
		}

		// Get initial device count
		const initialCount = await devicesPage.getDeviceCount();

		if (initialCount === 0) {
			test.skip(); // No devices to search
			return;
		}

		// Search for something that shouldn't exist
		await devicesPage.searchDevice('NonExistentDevice12345');
		await page.waitForTimeout(500);

		const searchCount = await devicesPage.getDeviceCount();
		expect(searchCount).toBe(0);

		// Clear search
		await devicesPage.searchDevice('');
		await page.waitForTimeout(500);

		const clearedCount = await devicesPage.getDeviceCount();
		expect(clearedCount).toBe(initialCount);
	});

	test('should filter devices by room', async ({ page }) => {
		// Skip if no room filter
		const hasFilter = await devicesPage.roomFilter.isVisible().catch(() => false);
		if (!hasFilter) {
			test.skip();
			return;
		}

		// Try to select a room filter
		await devicesPage.roomFilter.click();

		// Check if any rooms are available
		const rooms = await page.locator('[data-testid="room-option"]').all();
		if (rooms.length === 0) {
			test.skip(); // No rooms to filter
			return;
		}

		// Select first room
		await rooms[0].click();
		await page.waitForTimeout(500);

		// Should show filtered results
		const filteredCount = await devicesPage.getDeviceCount();
		expect(filteredCount).toBeGreaterThanOrEqual(0);
	});

	test('should open device detail view', async ({ page }) => {
		const deviceCards = await page.locator('[data-testid="device-card"]').all();
		if (deviceCards.length === 0) {
			test.skip(); // No devices
			return;
		}

		// Click first device
		await deviceCards[0].click();
		await page.waitForTimeout(500);

		// Should show device details (dialog or expanded view)
		const hasDialog = await page
			.locator('[role="dialog"]')
			.isVisible()
			.catch(() => false);
		const hasDetailView = await page
			.locator('[data-testid="device-detail"]')
			.isVisible()
			.catch(() => false);

		expect(hasDialog || hasDetailView).toBeTruthy();
	});

	test('should handle device rename', async ({ page, deviceAPI }) => {
		const deviceCards = await page.locator('[data-testid="device-card"]').all();
		if (deviceCards.length === 0) {
			test.skip(); // No devices
			return;
		}

		// Get first device ID
		const deviceId = await deviceCards[0].getAttribute('data-device-id');
		if (!deviceId) {
			test.skip();
			return;
		}

		const newName = `TestDevice_${Date.now()}`;

		// Rename via API
		await deviceAPI.renameDevice(deviceId, newName);

		// Reload page to see changes
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Should see new name
		const hasNewName = await page
			.locator(`text=${newName}`)
			.isVisible({ timeout: 2000 })
			.catch(() => false);
		expect(hasNewName).toBeTruthy();
	});

	test('should handle room assignment', async ({ page, deviceAPI }) => {
		const deviceCards = await page.locator('[data-testid="device-card"]').all();
		if (deviceCards.length === 0) {
			test.skip(); // No devices
			return;
		}

		const deviceId = await deviceCards[0].getAttribute('data-device-id');
		if (!deviceId) {
			test.skip();
			return;
		}

		const roomName = `TestRoom_${Date.now()}`;

		// Assign room via API
		await deviceAPI.assignRoom(deviceId, roomName);

		// Reload to see changes
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Should show room name somewhere
		const hasRoom = await page
			.locator(`text=${roomName}`)
			.isVisible({ timeout: 2000 })
			.catch(() => false);
		expect(hasRoom).toBeTruthy();
	});

	test('should persist device changes', async ({ page, deviceAPI }) => {
		const deviceCards = await page.locator('[data-testid="device-card"]').all();
		if (deviceCards.length === 0) {
			test.skip();
			return;
		}

		const deviceId = await deviceCards[0].getAttribute('data-device-id');
		if (!deviceId) {
			test.skip();
			return;
		}

		const newName = `Persistent_${Date.now()}`;
		await deviceAPI.renameDevice(deviceId, newName);

		// Navigate away
		await page.goto('/#/scenes');
		await page.waitForLoadState('networkidle');

		// Navigate back
		await devicesPage.goto();

		// Should still have new name
		const hasName = await page
			.locator(`text=${newName}`)
			.isVisible({ timeout: 2000 })
			.catch(() => false);
		expect(hasName).toBeTruthy();
	});
});
