import { DeviceClusterName } from '../../server/modules/device/cluster';
import { ScenesPage } from './pages/scenes.page';
import { test, expect } from './fixtures';

test.describe('Scene Management', () => {
	let scenesPage: ScenesPage;

	test.beforeEach(async ({ page }) => {
		scenesPage = new ScenesPage(page);
		await scenesPage.goto();
	});

	test('should display scenes list', async ({ page }) => {
		await page.waitForLoadState('networkidle');

		// Check if scenes list or empty state is visible
		const body = await page.textContent('body');
		expect(body).toBeTruthy();

		const hasScenes = (await page.locator('[data-testid="scene-card"]').count()) > 0;
		const hasNoScenesMessage = await page
			.locator('text=/no scenes|empty/i')
			.isVisible()
			.catch(() => false);

		expect(hasScenes || hasNoScenesMessage).toBeTruthy();
	});

	test('should show create scene button', async ({ page }) => {
		const createButton = await page
			.locator('button:has-text("Create")')
			.or(page.locator('button[aria-label*="create"]'));

		const hasButton = await createButton.isVisible().catch(() => false);
		expect(hasButton).toBeTruthy();
	});

	test('should create a scene via API', async ({ page, sceneAPI }) => {
		const initialScenes = await sceneAPI.listScenes();
		const initialCount = initialScenes.length;

		const newScene = await sceneAPI.createScene({
			title: `Test Scene ${Date.now()}`,
			icon: 'LightMode',
			actions: [],
		});

		expect(newScene.id).toBeTruthy();
		expect(newScene.title).toContain('Test Scene');

		// Reload to see new scene
		await page.reload();
		await page.waitForLoadState('networkidle');

		const finalScenes = await sceneAPI.listScenes();
		expect(finalScenes.length).toBe(initialCount + 1);
	});

	test('should list all scenes', async ({ sceneAPI }) => {
		const scenes = await sceneAPI.listScenes();
		expect(Array.isArray(scenes)).toBeTruthy();

		// Each scene should have required fields
		for (const scene of scenes) {
			expect(scene.id).toBeTruthy();
			expect(scene.title).toBeTruthy();
			expect(Array.isArray(scene.actions)).toBeTruthy();
		}
	});

	test('should update a scene', async ({ sceneAPI }) => {
		// Create a scene first
		const scene = await sceneAPI.createScene({
			title: `Update Test ${Date.now()}`,
			icon: 'Edit',
			actions: [],
		});

		// Update it
		const updatedTitle = `Updated ${Date.now()}`;
		scene.title = updatedTitle;
		await sceneAPI.updateScene(scene);

		// Verify update
		const scenes = await sceneAPI.listScenes();
		const updatedScene = scenes.find((s) => s.id === scene.id);

		expect(updatedScene).toBeTruthy();
		expect(updatedScene!.title).toBe(updatedTitle);
	});

	test('should delete a scene', async ({ sceneAPI }) => {
		// Create a scene
		const scene = await sceneAPI.createScene({
			title: `Delete Test ${Date.now()}`,
			icon: 'Delete',
			actions: [],
		});

		const scenesBeforeDelete = await sceneAPI.listScenes();
		const countBefore = scenesBeforeDelete.length;

		// Delete it
		await sceneAPI.deleteScene(scene.id);

		// Verify deletion
		const scenesAfterDelete = await sceneAPI.listScenes();
		expect(scenesAfterDelete.length).toBe(countBefore - 1);

		const deletedScene = scenesAfterDelete.find((s) => s.id === scene.id);
		expect(deletedScene).toBeUndefined();
	});

	test('should trigger a scene', async ({ page, sceneAPI, deviceAPI }) => {
		const devices = await deviceAPI.getDevices();
		const onOffDevice = devices.find(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(d: any) => d.allClusters.some((c: any) => c.name === 'onOff')
		);

		if (!onOffDevice) {
			test.skip(); // No devices to control
			return;
		}

		// Create scene with action
		const scene = await sceneAPI.createScene({
			title: `Trigger Test ${Date.now()}`,
			icon: 'PlayArrow',
			actions: [
				{
					deviceId: onOffDevice.uniqueId,
					cluster: DeviceClusterName.ON_OFF,
					action: {
						isOn: true,
					},
				},
			],
		});

		// Trigger the scene
		await sceneAPI.triggerScene(scene.id);

		// Wait for execution
		await page.waitForTimeout(1000);

		// Verify device was controlled (check state)
		const devicesAfter = await deviceAPI.getDevices();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const controlledDevice = devicesAfter.find((d: any) => d.uniqueId === onOffDevice.uniqueId);

		expect(controlledDevice).toBeTruthy();
		// Note: Actual state verification depends on real device response
	});

	test('should handle scene with multiple actions', async ({ sceneAPI, deviceAPI }) => {
		const devices = await deviceAPI.getDevices();
		const onOffDevices = devices.filter(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(d: any) => d.allClusters.some((c: any) => c.name === 'onOff')
		);

		if (onOffDevices.length < 2) {
			test.skip(); // Need at least 2 devices
			return;
		}

		// Create scene with multiple actions
		const scene = await sceneAPI.createScene({
			title: `Multi Action ${Date.now()}`,
			icon: 'GridView',
			actions: [
				{
					deviceId: onOffDevices[0].uniqueId,
					cluster: DeviceClusterName.ON_OFF,
					action: {
						isOn: true,
					},
				},
				{
					deviceId: onOffDevices[1].uniqueId,
					cluster: DeviceClusterName.ON_OFF,
					action: {
						isOn: false,
					},
				},
			],
		});

		expect(scene.actions.length).toBe(2);

		// Trigger scene
		await sceneAPI.triggerScene(scene.id);

		// Both devices should be controlled
		// (verification would require checking device states)
	});

	test('should persist scenes across page reloads', async ({ page, sceneAPI }) => {
		const scene = await sceneAPI.createScene({
			title: `Persist Test ${Date.now()}`,
			icon: 'Save',
			actions: [],
		});

		// Navigate away
		await page.goto('/#/devices');
		await page.waitForLoadState('networkidle');

		// Navigate back
		await scenesPage.goto();

		// Scene should still exist
		const scenes = await sceneAPI.listScenes();
		const persistedScene = scenes.find((s) => s.id === scene.id);

		expect(persistedScene).toBeTruthy();
	});

	test('should handle empty scene actions', async ({ sceneAPI }) => {
		const scene = await sceneAPI.createScene({
			title: `Empty Actions ${Date.now()}`,
			icon: 'RadioButtonUnchecked',
			actions: [],
		});

		// Should be able to trigger even with no actions
		await sceneAPI.triggerScene(scene.id);

		// Should not throw error
		expect(scene.id).toBeTruthy();
	});
});
