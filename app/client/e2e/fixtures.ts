import type { DeviceListWithValuesResponse } from '../../server/modules/device/routing';
import { test as base, expect, type Page } from '@playwright/test';
import type { Scene } from '../../../types/scene';

/**
 * E2E test fixtures for common setup and utilities
 */
export type TestFixtures = {
	authenticatedPage: Page;
	deviceAPI: DeviceAPIFixture;
	sceneAPI: SceneAPIFixture;
};

/**
 * Device API fixture for E2E tests
 */
export class DeviceAPIFixture {
	public constructor(private readonly page: Page) {}

	public async getDevices(): Promise<DeviceListWithValuesResponse> {
		const response = await this.page.request.get('/api/device/list');
		expect(response.ok()).toBeTruthy();
		return response.json();
	}

	public async renameDevice(deviceId: string, newName: string): Promise<void> {
		const response = await this.page.request.post('/api/device/rename', {
			data: { uniqueId: deviceId, name: newName },
		});
		expect(response.ok()).toBeTruthy();
	}

	public async assignRoom(deviceId: string, room: string, icon?: string): Promise<void> {
		const response = await this.page.request.post('/api/device/assign-room', {
			data: { uniqueId: deviceId, room, icon },
		});
		expect(response.ok()).toBeTruthy();
	}

	public async controlOnOff(deviceId: string, isOn: boolean): Promise<void> {
		const response = await this.page.request.post('/api/device/control/onoff', {
			data: { uniqueId: deviceId, isOn },
		});
		expect(response.ok()).toBeTruthy();
	}

	public async controlWindowCovering(deviceId: string, position: number): Promise<void> {
		const response = await this.page.request.post('/api/device/control/window-covering', {
			data: { uniqueId: deviceId, targetPosition: position },
		});
		expect(response.ok()).toBeTruthy();
	}
}

/**
 * Scene API fixture for E2E tests
 */
export class SceneAPIFixture {
	public constructor(private readonly page: Page) {}

	public async listScenes(): Promise<Scene[]> {
		const response = await this.page.request.get('/api/scene/list');
		expect(response.ok()).toBeTruthy();
		return response.json();
	}

	public async createScene(scene: Omit<Scene, 'id'>): Promise<Scene> {
		const response = await this.page.request.post('/api/scene/create', {
			data: scene,
		});
		expect(response.ok()).toBeTruthy();
		return response.json();
	}

	public async updateScene(scene: Scene): Promise<void> {
		const response = await this.page.request.post(`/api/scene/update/${scene.id}`, {
			data: scene,
		});
		expect(response.ok()).toBeTruthy();
	}

	public async deleteScene(sceneId: string): Promise<void> {
		const response = await this.page.request.delete(`/api/scene/delete/${sceneId}`);
		expect(response.ok()).toBeTruthy();
	}

	public async triggerScene(sceneId: string): Promise<void> {
		const response = await this.page.request.post(`/api/scene/trigger/${sceneId}`);
		expect(response.ok()).toBeTruthy();
	}
}

/**
 * Extended test with custom fixtures
 */
export const test = base.extend<TestFixtures>({
	authenticatedPage: async ({ page }, use) => {
		// For now, assume no authentication required or use test credentials
		// In future, add login flow here if authentication is implemented
		await page.goto('/');
		await use(page);
	},

	deviceAPI: async ({ page }, use) => {
		await use(new DeviceAPIFixture(page));
	},

	sceneAPI: async ({ page }, use) => {
		await use(new SceneAPIFixture(page));
	},
});

export { expect };
