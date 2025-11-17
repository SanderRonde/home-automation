import type { Page, Locator } from '@playwright/test';

/**
 * Page object for the Scenes page
 */
export class ScenesPage {
	public readonly page: Page;
	public readonly scenesTab: Locator;
	public readonly createSceneButton: Locator;
	public readonly scenesList: Locator;

	public constructor(page: Page) {
		this.page = page;
		this.scenesTab = page.locator('text=Scenes').first();
		this.createSceneButton = page.locator('button:has-text("Create Scene")');
		this.scenesList = page.locator('[data-testid="scenes-list"]');
	}

	public async goto(): Promise<void> {
		await this.page.goto('/#/scenes');
		await this.page.waitForLoadState('networkidle');
	}

	public async createScene(name: string, icon?: string): Promise<void> {
		await this.createSceneButton.click();

		// Fill in scene details
		const nameInput = this.page.locator('input[name="scene-name"]');
		await nameInput.fill(name);

		if (icon) {
			const iconButton = this.page.locator(`[data-icon="${icon}"]`);
			await iconButton.click();
		}

		// Save
		const saveButton = this.page.locator('button:has-text("Create")');
		await saveButton.click();

		// Wait for scene to appear
		await this.page.waitForTimeout(500);
	}

	public async addDeviceAction(
		sceneName: string,
		deviceName: string,
		action: { type: 'onoff'; isOn: boolean } | { type: 'covering'; position: number }
	): Promise<void> {
		// Open scene editor
		await this.openScene(sceneName);

		// Click add device button
		const addButton = this.page.locator('button:has-text("Add Device")');
		await addButton.click();

		// Select device
		const deviceOption = this.page.locator(`text="${deviceName}"`);
		await deviceOption.click();

		// Configure action
		if (action.type === 'onoff') {
			const toggle = this.page.locator('input[type="checkbox"]');
			const isChecked = await toggle.isChecked();
			if (isChecked !== action.isOn) {
				await toggle.click();
			}
		} else if (action.type === 'covering') {
			const slider = this.page.locator('input[type="range"]');
			await slider.fill(action.position.toString());
		}

		// Save action
		const saveButton = this.page.locator('button:has-text("Add")');
		await saveButton.click();
	}

	public async openScene(sceneName: string): Promise<void> {
		const sceneCard = this.page.locator(`text="${sceneName}"`).locator('..').locator('..');
		await sceneCard.click();
		await this.page.waitForTimeout(300);
	}

	public async triggerScene(sceneName: string): Promise<void> {
		const sceneCard = this.page.locator(`text="${sceneName}"`).locator('..').locator('..');
		const triggerButton = sceneCard.locator('button[aria-label="Trigger scene"]');
		await triggerButton.click();

		// Wait for scene execution
		await this.page.waitForTimeout(1000);
	}

	public async deleteScene(sceneName: string): Promise<void> {
		await this.openScene(sceneName);

		// Click delete button
		const deleteButton = this.page.locator('button:has-text("Delete")');
		await deleteButton.click();

		// Confirm deletion
		const confirmButton = this.page.locator('button:has-text("Confirm")');
		if (await confirmButton.isVisible({ timeout: 1000 })) {
			await confirmButton.click();
		}

		// Wait for deletion
		await this.page.waitForTimeout(500);
	}

	public async getSceneCount(): Promise<number> {
		const scenes = await this.page.locator('[data-testid="scene-card"]').all();
		return scenes.length;
	}

	public async isSceneVisible(sceneName: string): Promise<boolean> {
		return this.page.locator(`text="${sceneName}"`).isVisible({ timeout: 1000 });
	}
}
