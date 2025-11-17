import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
	test('should load the application', async ({ page }) => {
		await page.goto('/');

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check if page loaded successfully
		const body = page.locator('body');
		await expect(body).toBeVisible();

		// Should have some content (not a blank page or error)
		const content = await page.textContent('body');
		expect(content).toBeTruthy();
		expect(content!.length).toBeGreaterThan(0);
	});

	test('should not have console errors on load', async ({ page }) => {
		const errors: string[] = [];

		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Allow for some expected errors (like WebSocket connection in test mode)
		const criticalErrors = errors.filter(
			(err) => !err.includes('WebSocket') && !err.includes('Failed to fetch')
		);

		expect(criticalErrors.length).toBe(0);
	});

	test('should respond to API requests', async ({ page }) => {
		// Try to fetch device list
		const response = await page.request.get('/api/device/list');

		// Should get a valid response (even if empty)
		expect(response.ok() || response.status() === 404).toBeTruthy();
	});
});
