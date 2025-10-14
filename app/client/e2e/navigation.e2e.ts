import { DevicesPage } from './pages/devices.page';
import { ScenesPage } from './pages/scenes.page';
import { test, expect } from './fixtures';

test.describe('Navigation', () => {
	test('should navigate to home page', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\//);
		await expect(page).toHaveTitle(/Home Automation|Dashboard/i);
	});

	test('should navigate between tabs', async ({ page }) => {
		await page.goto('/');

		// Navigate to Devices
		const devicesPage = new DevicesPage(page);
		await devicesPage.devicesTab.click();
		await expect(page).toHaveURL(/#\/devices/);

		// Navigate to Scenes
		const scenesPage = new ScenesPage(page);
		await scenesPage.scenesTab.click();
		await expect(page).toHaveURL(/#\/scenes/);

		// Navigate back to Home
		await page.locator('text=Home').first().click();
		await expect(page).toHaveURL(/\//);
	});

	test('should handle browser back/forward', async ({ page }) => {
		await page.goto('/');

		// Navigate forward
		const devicesPage = new DevicesPage(page);
		await devicesPage.goto();
		await expect(page).toHaveURL(/#\/devices/);

		// Go back
		await page.goBack();
		await expect(page).toHaveURL(/\/$/);

		// Go forward
		await page.goForward();
		await expect(page).toHaveURL(/#\/devices/);
	});

	test('should persist navigation state on reload', async ({ page }) => {
		const devicesPage = new DevicesPage(page);
		await devicesPage.goto();
		await expect(page).toHaveURL(/#\/devices/);

		// Reload page
		await page.reload();

		// Should still be on devices page
		await expect(page).toHaveURL(/#\/devices/);
	});
});
