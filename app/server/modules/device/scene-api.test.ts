import {
	createMockSQL,
	MockDatabase,
	MockDevice,
	MockOnOffCluster,
	MockWindowCoveringCluster,
	waitForCondition,
} from '../../lib/test-utils';
import { SceneTriggerType, SceneConditionType } from '../../../../types/scene';
import type { Scene, SceneTrigger } from '../../../../types/scene';
import { describe, test, expect, beforeEach } from 'bun:test';
import { DeviceClusterName } from './cluster';
import { DeviceSource } from './device';
import { SceneAPI } from './scene-api';
import { Data } from '../../lib/data';
import type { DeviceDB } from '.';

describe('SceneAPI', () => {
	let db: MockDatabase<DeviceDB>;
	let devices: Data<{ [deviceId: string]: MockDevice }>;
	let api: SceneAPI;

	beforeEach(() => {
		db = new MockDatabase<DeviceDB>({
			device_registry: {},
			scenes: {},
		});
		devices = new Data<{ [deviceId: string]: MockDevice }>({});
		// Mock modules for SceneAPI
		const mockModules = Promise.resolve({
			homeDetector: {
				getDetector: () => ({
					get: () => '?',
				}),
			},
		});
		const mockSQL = createMockSQL();
		api = new SceneAPI(
			// @ts-expect-error - Using mocks in tests
			db,
			devices as unknown as typeof devices,
			undefined,
			undefined,
			mockModules,
			mockSQL
		);
	});

	describe('listScenes', () => {
		test('should return empty array when no scenes', () => {
			const scenes = api.listScenes();

			expect(scenes).toEqual([]);
		});

		test('should return all scenes', () => {
			const scene1: Scene = {
				id: 'scene1',
				title: 'Good Morning',
				icon: 'WbSunny',
				actions: [],
			};
			const scene2: Scene = {
				id: 'scene2',
				title: 'Good Night',
				icon: 'WbSunny',
				actions: [],
			};

			db.set({
				scenes: {
					scene1,
					scene2,
				},
			});

			const scenes = api.listScenes();

			expect(scenes).toHaveLength(2);
			expect(scenes).toContainEqual(scene1);
			expect(scenes).toContainEqual(scene2);
		});
	});

	describe('getScene', () => {
		test('should return undefined for non-existent scene', () => {
			const scene = api.getScene('nonexistent');

			expect(scene).toBeUndefined();
		});

		test('should return scene by id', () => {
			const scene: Scene = {
				id: 'scene1',
				title: 'Test Scene',
				icon: 'Home',
				actions: [],
			};

			db.set({
				scenes: {
					scene1: scene,
				},
			});

			const result = api.getScene('scene1');

			expect(result).toEqual(scene);
		});
	});

	describe('createScene', () => {
		test('should create a new scene', () => {
			const sceneId = api.createScene({
				title: 'New Scene',
				icon: 'Star',
				actions: [],
			});

			expect(sceneId).toMatch(/^scene_/);

			const scene = api.getScene(sceneId);
			expect(scene).toBeDefined();
			expect(scene?.title).toBe('New Scene');
			expect(scene?.icon).toBe('Star');
		});

		test('should persist scene to database', () => {
			const sceneId = api.createScene({
				title: 'New Scene',
				icon: 'Star',
				actions: [],
			});

			const dbData = db.current();
			expect(dbData.scenes?.[sceneId]).toBeDefined();
			expect(dbData.scenes?.[sceneId].title).toBe('New Scene');
		});

		test('should generate unique IDs', () => {
			const id1 = api.createScene({
				title: 'Scene 1',
				icon: 'Star',
				actions: [],
			});
			const id2 = api.createScene({
				title: 'Scene 2',
				icon: 'Star',
				actions: [],
			});

			expect(id1).not.toBe(id2);
		});

		test('should create scene with triggers', () => {
			const trigger: SceneTrigger = {
				type: SceneTriggerType.OCCUPANCY,
				deviceId: 'sensor1',
			};

			const sceneId = api.createScene({
				title: 'Motion Scene',
				icon: 'Sensors',
				actions: [],
				triggers: [{ trigger }],
			});

			const scene = api.getScene(sceneId);
			expect(scene?.triggers).toEqual([{ trigger }]);
		});
	});

	describe('updateScene', () => {
		test('should update existing scene', () => {
			const sceneId = api.createScene({
				title: 'Original',
				icon: 'Star',
				actions: [],
			});

			const success = api.updateScene(sceneId, {
				title: 'Updated',
				icon: 'Settings',
				actions: [],
			});

			expect(success).toBe(true);

			const scene = api.getScene(sceneId);
			expect(scene?.title).toBe('Updated');
			expect(scene?.icon).toBe('Settings');
		});

		test('should return false for non-existent scene', () => {
			const success = api.updateScene('nonexistent', {
				title: 'Test',
				icon: 'Star',
				actions: [],
			});

			expect(success).toBe(false);
		});

		test('should preserve scene ID', () => {
			const sceneId = api.createScene({
				title: 'Original',
				icon: 'Star',
				actions: [],
			});

			api.updateScene(sceneId, {
				title: 'Updated',
				icon: 'Settings',
				actions: [],
			});

			const scene = api.getScene(sceneId);
			expect(scene?.id).toBe(sceneId);
		});
	});

	describe('deleteScene', () => {
		test('should delete existing scene', () => {
			const sceneId = api.createScene({
				title: 'To Delete',
				icon: 'Balcony',
				actions: [],
			});

			const success = api.deleteScene(sceneId);

			expect(success).toBe(true);
			expect(api.getScene(sceneId)).toBeUndefined();
		});

		test('should return false for non-existent scene', () => {
			const success = api.deleteScene('nonexistent');

			expect(success).toBe(false);
		});

		test('should persist deletion to database', () => {
			const sceneId = api.createScene({
				title: 'To Delete',
				icon: 'Balcony',
				actions: [],
			});

			api.deleteScene(sceneId);

			const dbData = db.current();
			expect(dbData.scenes?.[sceneId]).toBeUndefined();
		});
	});

	describe('triggerScene', () => {
		test('should return false for non-existent scene', async () => {
			const success = await api.triggerScene('nonexistent');

			expect(success).toBe(false);
		});

		test('should trigger OnOff action', async () => {
			const onOffCluster = new MockOnOffCluster();
			const device = new MockDevice('light1', DeviceSource.MATTER, [onOffCluster]);

			devices.set({ light1: device });

			const sceneId = api.createScene({
				title: 'Turn On Light',
				icon: 'Lightbulb',
				actions: [
					{
						deviceId: 'light1',
						cluster: DeviceClusterName.ON_OFF,
						action: {
							isOn: true,
						},
					},
				],
			});

			const success = await api.triggerScene(sceneId);

			expect(success).toBe(true);
			expect(onOffCluster.isOn.current()).toBe(true);
		});

		test('should trigger WindowCovering action', async () => {
			const coveringCluster = new MockWindowCoveringCluster();
			const device = new MockDevice('blinds1', DeviceSource.MATTER, [coveringCluster]);

			devices.set({ blinds1: device });

			const sceneId = api.createScene({
				title: 'Open Blinds',
				icon: 'Window',
				actions: [
					{
						deviceId: 'blinds1',
						cluster: DeviceClusterName.WINDOW_COVERING,
						action: {
							targetPositionLiftPercentage: 25,
						},
					},
				],
			});

			const success = await api.triggerScene(sceneId);

			expect(success).toBe(true);
			expect(coveringCluster.targetPositionLiftPercentage.current()).toBe(25);
		});

		test('should handle multiple actions', async () => {
			const onOffCluster1 = new MockOnOffCluster();
			const onOffCluster2 = new MockOnOffCluster();
			const device1 = new MockDevice('light1', DeviceSource.MATTER, [onOffCluster1]);
			const device2 = new MockDevice('light2', DeviceSource.MATTER, [onOffCluster2]);

			devices.set({
				light1: device1,
				light2: device2,
			});

			const sceneId = api.createScene({
				title: 'All Lights On',
				icon: 'Lightbulb',
				actions: [
					{
						deviceId: 'light1',
						cluster: DeviceClusterName.ON_OFF,
						action: { isOn: true },
					},
					{
						deviceId: 'light2',
						cluster: DeviceClusterName.ON_OFF,
						action: { isOn: true },
					},
				],
			});

			const success = await api.triggerScene(sceneId);

			expect(success).toBe(true);
			expect(onOffCluster1.isOn.current()).toBe(true);
			expect(onOffCluster2.isOn.current()).toBe(true);
		});

		test('should return false if device not found', async () => {
			const sceneId = api.createScene({
				title: 'Missing Device',
				icon: 'Home',
				actions: [
					{
						deviceId: 'nonexistent',
						cluster: DeviceClusterName.ON_OFF,
						action: { isOn: true },
					},
				],
			});

			const success = await api.triggerScene(sceneId);

			expect(success).toBe(false);
		});

		test('should return false if cluster not found on device', async () => {
			const device = new MockDevice('device1', DeviceSource.MATTER, []); // No clusters

			devices.set({ device1: device });

			const sceneId = api.createScene({
				title: 'Missing Cluster',
				icon: 'Home',
				actions: [
					{
						deviceId: 'device1',
						cluster: DeviceClusterName.ON_OFF,
						action: { isOn: true },
					},
				],
			});

			const success = await api.triggerScene(sceneId);

			expect(success).toBe(false);
		});
	});

	describe('onTrigger', () => {
		test('should trigger scenes with matching occupancy trigger', async () => {
			const onOffCluster = new MockOnOffCluster();
			const device = new MockDevice('light1', DeviceSource.MATTER, [onOffCluster]);

			devices.set({ light1: device });

			api.createScene({
				title: 'Motion Activated',
				icon: 'Sensors',
				actions: [
					{
						deviceId: 'light1',
						cluster: DeviceClusterName.ON_OFF,
						action: { isOn: true },
					},
				],
				triggers: [
					{
						trigger: {
							type: SceneTriggerType.OCCUPANCY,
							deviceId: 'sensor1',
						},
					},
				],
			});

			await api.onTrigger({
				type: SceneTriggerType.OCCUPANCY,
				deviceId: 'sensor1',
			});

			// Give some time for async operations
			await waitForCondition(() => onOffCluster.isOn.current() === true);

			expect(onOffCluster.isOn.current()).toBe(true);
		});

		test('should not trigger scenes with different deviceId', async () => {
			const onOffCluster = new MockOnOffCluster();
			const device = new MockDevice('light1', DeviceSource.MATTER, [onOffCluster]);

			devices.set({ light1: device });

			api.createScene({
				title: 'Motion Activated',
				icon: 'Sensors',
				actions: [
					{
						deviceId: 'light1',
						cluster: DeviceClusterName.ON_OFF,
						action: { isOn: true },
					},
				],
				triggers: [
					{
						trigger: {
							type: SceneTriggerType.OCCUPANCY,
							deviceId: 'sensor1',
						},
					},
				],
			});

			await api.onTrigger({
				type: SceneTriggerType.OCCUPANCY,
				deviceId: 'sensor2', // Different sensor
			});

			// Wait a bit to ensure it doesn't trigger
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(onOffCluster.isOn.current()).toBe(false);
		});

		test('should trigger multiple scenes with same trigger', async () => {
			const onOffCluster1 = new MockOnOffCluster();
			const onOffCluster2 = new MockOnOffCluster();
			const device1 = new MockDevice('light1', DeviceSource.MATTER, [onOffCluster1]);
			const device2 = new MockDevice('light2', DeviceSource.MATTER, [onOffCluster2]);

			devices.set({
				light1: device1,
				light2: device2,
			});

			api.createScene({
				title: 'Scene 1',
				icon: 'Star',
				actions: [
					{
						deviceId: 'light1',
						cluster: DeviceClusterName.ON_OFF,
						action: { isOn: true },
					},
				],
				triggers: [
					{
						trigger: {
							type: SceneTriggerType.OCCUPANCY,
							deviceId: 'sensor1',
						},
					},
				],
			});

			api.createScene({
				title: 'Scene 2',
				icon: 'Star',
				actions: [
					{
						deviceId: 'light2',
						cluster: DeviceClusterName.ON_OFF,
						action: { isOn: true },
					},
				],
				triggers: [
					{
						trigger: {
							type: SceneTriggerType.OCCUPANCY,
							deviceId: 'sensor1',
						},
					},
				],
			});

			await api.onTrigger({
				type: SceneTriggerType.OCCUPANCY,
				deviceId: 'sensor1',
			});

			// Give some time for async operations
			await waitForCondition(
				() => onOffCluster1.isOn.current() === true && onOffCluster2.isOn.current() === true
			);

			expect(onOffCluster1.isOn.current()).toBe(true);
			expect(onOffCluster2.isOn.current()).toBe(true);
		});

		test('should not trigger scenes without triggers', async () => {
			const onOffCluster = new MockOnOffCluster();
			const device = new MockDevice('light1', DeviceSource.MATTER, [onOffCluster]);

			devices.set({ light1: device });

			api.createScene({
				title: 'Manual Scene',
				icon: 'Home',
				actions: [
					{
						deviceId: 'light1',
						cluster: DeviceClusterName.ON_OFF,
						action: { isOn: true },
					},
				],
				// No triggers
			});

			await api.onTrigger({
				type: SceneTriggerType.OCCUPANCY,
				deviceId: 'sensor1',
			});

			// Wait a bit to ensure it doesn't trigger
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(onOffCluster.isOn.current()).toBe(false);
		});

		test('should support multiple triggers (OR logic)', async () => {
			const onOffCluster = new MockOnOffCluster();
			const device = new MockDevice('light1', DeviceSource.MATTER, [onOffCluster]);

			devices.set({ light1: device });

			api.createScene({
				title: 'Multi Trigger Scene',
				icon: 'Home',
				actions: [
					{
						deviceId: 'light1',
						cluster: DeviceClusterName.ON_OFF,
						action: { isOn: true },
					},
				],
				triggers: [
					{
						trigger: {
							type: SceneTriggerType.OCCUPANCY,
							deviceId: 'sensor1',
						},
					},
					{
						trigger: {
							type: SceneTriggerType.BUTTON_PRESS,
							deviceId: 'button1',
							buttonIndex: 0,
						},
					},
				],
			});

			// Trigger via occupancy (first trigger)
			await api.onTrigger({
				type: SceneTriggerType.OCCUPANCY,
				deviceId: 'sensor1',
			});

			await waitForCondition(() => onOffCluster.isOn.current() === true);
			expect(onOffCluster.isOn.current()).toBe(true);

			// Reset
			onOffCluster.isOn.set(false);

			// Trigger via button press (second trigger)
			await api.onTrigger({
				type: SceneTriggerType.BUTTON_PRESS,
				deviceId: 'button1',
				buttonIndex: 0,
			});

			await waitForCondition(() => onOffCluster.isOn.current() === true);
			expect(onOffCluster.isOn.current()).toBe(true);
		});

		test('should evaluate conditions (AND logic)', async () => {
			const onOffCluster = new MockOnOffCluster();
			const device = new MockDevice('light1', DeviceSource.MATTER, [onOffCluster]);
			const sensorDevice = new MockDevice('sensor1', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);

			devices.set({
				light1: device,
				sensor1: sensorDevice,
			});

			// Create scene with trigger and device-on condition
			api.createScene({
				title: 'Conditional Scene',
				icon: 'Home',
				actions: [
					{
						deviceId: 'light1',
						cluster: DeviceClusterName.ON_OFF,
						action: { isOn: true },
					},
				],
				triggers: [
					{
						trigger: {
							type: SceneTriggerType.OCCUPANCY,
							deviceId: 'motion1',
						},
						conditions: [
							{
								type: SceneConditionType.DEVICE_ON,
								deviceId: 'sensor1',
								shouldBeOn: true,
							},
						],
					},
				],
			});

			// Trigger when condition is NOT met (sensor is off)
			await api.onTrigger({
				type: SceneTriggerType.OCCUPANCY,
				deviceId: 'motion1',
			});

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Should not have triggered
			expect(onOffCluster.isOn.current()).toBe(false);

			// Turn sensor on (condition now met)
			(sensorDevice.getClusterByType(MockOnOffCluster) as MockOnOffCluster).isOn.set(true);

			// Trigger again
			await api.onTrigger({
				type: SceneTriggerType.OCCUPANCY,
				deviceId: 'motion1',
			});

			await waitForCondition(() => onOffCluster.isOn.current() === true);

			// Should have triggered this time
			expect(onOffCluster.isOn.current()).toBe(true);
		});

		test('should handle empty triggers array as no automation', async () => {
			const onOffCluster = new MockOnOffCluster();
			const device = new MockDevice('light1', DeviceSource.MATTER, [onOffCluster]);

			devices.set({ light1: device });

			api.createScene({
				title: 'Empty Triggers Scene',
				icon: 'Home',
				actions: [
					{
						deviceId: 'light1',
						cluster: DeviceClusterName.ON_OFF,
						action: { isOn: true },
					},
				],
				triggers: [],
			});

			await api.onTrigger({
				type: SceneTriggerType.OCCUPANCY,
				deviceId: 'sensor1',
			});

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Should not trigger
			expect(onOffCluster.isOn.current()).toBe(false);
		});
	});
});
