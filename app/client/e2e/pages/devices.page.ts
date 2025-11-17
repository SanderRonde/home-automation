import type { Page, Locator } from '@playwright/test';

/**
 * Page object for the Devices page
 */
export class DevicesPage {
	public readonly page: Page;
	public readonly devicesTab: Locator;
	public readonly devicesList: Locator;
	public readonly searchInput: Locator;
	public readonly roomFilter: Locator;

	public constructor(page: Page) {
		this.page = page;
		this.devicesTab = page.locator('text=Devices').first();
		this.devicesList = page.locator('[data-testid="devices-list"]');
		this.searchInput = page.locator('input[placeholder*="Search"]');
		this.roomFilter = page.locator('[data-testid="room-filter"]');
	}

	public async goto(): Promise<void> {
		await this.page.goto('/#/devices');
		await this.page.waitForLoadState('networkidle');
	}

	public async searchDevice(name: string): Promise<void> {
		if (await this.searchInput.isVisible()) {
			await this.searchInput.fill(name);
			await this.page.waitForTimeout(300); // Wait for search debounce
		}
	}

	public async filterByRoom(roomName: string): Promise<void> {
		if (await this.roomFilter.isVisible()) {
			await this.roomFilter.click();
			await this.page.locator(`text="${roomName}"`).click();
		}
	}

	public async getDeviceCard(deviceId: string): Promise<Locator> {
		return Promise.resolve(this.page.locator(`[data-device-id="${deviceId}"]`));
	}

	public async getDeviceCardByName(deviceName: string): Promise<Locator> {
		return Promise.resolve(
			this.page.locator(`text="${deviceName}"`).locator('..').locator('..')
		);
	}

	public async openDevice(deviceId: string): Promise<void> {
		const card = await this.getDeviceCard(deviceId);
		await card.click();
	}

	public async renameDevice(deviceId: string, newName: string): Promise<void> {
		await this.openDevice(deviceId);

		// Find and click rename button or field
		const renameButton = this.page.locator('[aria-label="Rename device"]');
		if (await renameButton.isVisible({ timeout: 1000 })) {
			await renameButton.click();
		}

		const nameInput = this.page.locator('input[name="device-name"]');
		await nameInput.fill(newName);

		// Save
		const saveButton = this.page.locator('button:has-text("Save")');
		await saveButton.click();

		// Wait for success
		await this.page.waitForTimeout(500);
	}

	public async assignRoom(deviceId: string, roomName: string, icon?: string): Promise<void> {
		await this.openDevice(deviceId);

		// Click room assignment button
		const roomButton = this.page.locator('[aria-label="Assign room"]');
		await roomButton.click();

		// Select or create room
		const roomInput = this.page.locator('input[name="room-name"]');
		await roomInput.fill(roomName);

		if (icon) {
			const iconButton = this.page.locator(`[data-icon="${icon}"]`);
			await iconButton.click();
		}

		// Save
		const saveButton = this.page.locator('button:has-text("Save")');
		await saveButton.click();

		// Wait for success
		await this.page.waitForTimeout(500);
	}

	public async getDeviceCount(): Promise<number> {
		const devices = await this.page.locator('[data-testid="device-card"]').all();
		return devices.length;
	}

	public async isDeviceVisible(deviceName: string): Promise<boolean> {
		return this.page.locator(`text="${deviceName}"`).isVisible({ timeout: 1000 });
	}
}
