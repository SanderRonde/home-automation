import { MockDatabase, createMockSQL, MockDevice, MockOnOffCluster } from '../../lib/test-utils';
import { describe, test, expect, beforeEach } from 'bun:test';
import type { MockSQL } from '../../lib/test-utils';
import { DeviceSource } from './device';
import { DeviceAPI } from './api';
import type { DeviceDB } from '.';

describe('DeviceAPI', () => {
	let db: MockDatabase<DeviceDB>;
	let sqlDB: MockSQL;
	let api: DeviceAPI;

	beforeEach(() => {
		db = new MockDatabase<DeviceDB>({
			device_registry: {},
		});
		sqlDB = createMockSQL();
		// @ts-expect-error - Using mocks in tests
		api = new DeviceAPI(db, sqlDB);
	});

	describe('setDevices', () => {
		test('should add devices from a source', () => {
			const device1 = new MockDevice('device1', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);
			const device2 = new MockDevice('device2', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);

			api.setDevices([device1, device2], DeviceSource.MATTER);

			const devices = api.devices.current();
			expect(Object.keys(devices)).toHaveLength(2);
			expect(devices['device1']).toBe(device1);
			expect(devices['device2']).toBe(device2);
		});

		test('should replace devices from the same source', () => {
			const device1 = new MockDevice('device1', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);
			const device2 = new MockDevice('device2', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);
			const device3 = new MockDevice('device3', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);

			api.setDevices([device1, device2], DeviceSource.MATTER);
			api.setDevices([device3], DeviceSource.MATTER);

			const devices = api.devices.current();
			expect(Object.keys(devices)).toHaveLength(1);
			expect(devices['device3']).toBe(device3);
			expect(devices['device1']).toBeUndefined();
			expect(devices['device2']).toBeUndefined();
		});

		test('should keep devices from different sources', () => {
			const matterDevice = new MockDevice('matter1', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);
			const wledDevice = new MockDevice('wled1', DeviceSource.WLED, [new MockOnOffCluster()]);

			api.setDevices([matterDevice], DeviceSource.MATTER);
			api.setDevices([wledDevice], DeviceSource.WLED);

			const devices = api.devices.current();
			expect(Object.keys(devices)).toHaveLength(2);
			expect(devices['matter1']).toBe(matterDevice);
			expect(devices['wled1']).toBe(wledDevice);
		});

		test('should update device registry with online status', () => {
			const device = new MockDevice('device1', DeviceSource.MATTER, [new MockOnOffCluster()]);

			api.setDevices([device], DeviceSource.MATTER);

			const registry = api.getStoredDevices();
			expect(registry['device1']).toBeDefined();
			expect(registry['device1'].status).toBe('online');
			expect(registry['device1'].lastSeen).toBeGreaterThan(0);
		});

		test('should mark previously online devices as offline', () => {
			const device1 = new MockDevice('device1', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);
			const device2 = new MockDevice('device2', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);

			api.setDevices([device1, device2], DeviceSource.MATTER);
			api.setDevices([device1], DeviceSource.MATTER);

			const registry = api.getStoredDevices();
			expect(registry['device1'].status).toBe('online');
			expect(registry['device2'].status).toBe('offline');
		});
	});

	describe('updateDeviceName', () => {
		test('should update device name', () => {
			const device = new MockDevice('device1', DeviceSource.MATTER, [new MockOnOffCluster()]);
			api.setDevices([device], DeviceSource.MATTER);

			const success = api.updateDeviceName('device1', 'My Light');

			expect(success).toBe(true);
			const registry = api.getStoredDevices();
			expect(registry['device1'].name).toBe('My Light');
		});

		test('should return false for unknown device', () => {
			const success = api.updateDeviceName('unknown', 'Name');

			expect(success).toBe(false);
		});

		test('should persist name change to database', () => {
			const device = new MockDevice('device1', DeviceSource.MATTER, [new MockOnOffCluster()]);
			api.setDevices([device], DeviceSource.MATTER);

			db.resetWrites();
			api.updateDeviceName('device1', 'My Light');

			expect(db.getWriteCount()).toBeGreaterThan(0);
			const lastWrite = db.writes[db.writes.length - 1];
			expect(lastWrite.device_registry?.['device1']?.name).toBe('My Light');
		});
	});

	describe('updateDeviceRoom', () => {
		test('should assign device to room', () => {
			const device = new MockDevice('device1', DeviceSource.MATTER, [new MockOnOffCluster()]);
			api.setDevices([device], DeviceSource.MATTER);

			const success = api.updateDeviceRoom('device1', 'Living Room');

			expect(success).toBe(true);
			const registry = api.getStoredDevices();
			expect(registry['device1'].room).toBe('Living Room');
		});

		test('should assign device to room with icon', () => {
			const device = new MockDevice('device1', DeviceSource.MATTER, [new MockOnOffCluster()]);
			api.setDevices([device], DeviceSource.MATTER);

			const success = api.updateDeviceRoom('device1', 'Living Room', 'Weekend');

			expect(success).toBe(true);
			const dbData = db.current();
			expect(dbData.room_icons?.['Living Room']).toBe('Weekend');
		});

		test('should remove device from room', () => {
			const device = new MockDevice('device1', DeviceSource.MATTER, [new MockOnOffCluster()]);
			api.setDevices([device], DeviceSource.MATTER);
			api.updateDeviceRoom('device1', 'Living Room');

			const success = api.updateDeviceRoom('device1', undefined);

			expect(success).toBe(true);
			const registry = api.getStoredDevices();
			expect(registry['device1'].room).toBeUndefined();
		});

		test('should return false for unknown device', () => {
			const success = api.updateDeviceRoom('unknown', 'Bedroom');

			expect(success).toBe(false);
		});
	});

	describe('getRooms', () => {
		test('should return empty object when no rooms', () => {
			const rooms = api.getRooms(api.getStoredDevices());

			expect(Object.keys(rooms)).toHaveLength(0);
		});

		test('should list all rooms with devices', () => {
			const device1 = new MockDevice('device1', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);
			const device2 = new MockDevice('device2', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);

			api.setDevices([device1, device2], DeviceSource.MATTER);
			api.updateDeviceRoom('device1', 'Living Room');
			api.updateDeviceRoom('device2', 'Bedroom');

			const rooms = api.getRooms(api.getStoredDevices());

			expect(Object.keys(rooms)).toHaveLength(2);
			expect(rooms['Living Room']).toBeDefined();
			expect(rooms['Bedroom']).toBeDefined();
			expect(rooms['Living Room'].name).toBe('Living Room');
			expect(rooms['Bedroom'].name).toBe('Bedroom');
		});

		test('should include room colors', () => {
			const device = new MockDevice('device1', DeviceSource.MATTER, [new MockOnOffCluster()]);
			api.setDevices([device], DeviceSource.MATTER);
			api.updateDeviceRoom('device1', 'Kitchen');

			const rooms = api.getRooms(api.getStoredDevices());

			expect(rooms['Kitchen'].color).toMatch(/^#[0-9A-F]{6}$/i);
		});

		test('should include room icons if set', () => {
			const device = new MockDevice('device1', DeviceSource.MATTER, [new MockOnOffCluster()]);
			api.setDevices([device], DeviceSource.MATTER);
			api.updateDeviceRoom('device1', 'Kitchen', 'Restaurant');

			const rooms = api.getRooms(api.getStoredDevices());

			expect(rooms['Kitchen'].icon).toBe('Restaurant');
		});

		test('should not duplicate rooms with multiple devices', () => {
			const device1 = new MockDevice('device1', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);
			const device2 = new MockDevice('device2', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);

			api.setDevices([device1, device2], DeviceSource.MATTER);
			api.updateDeviceRoom('device1', 'Living Room');
			api.updateDeviceRoom('device2', 'Living Room');

			const rooms = api.getRooms(api.getStoredDevices());

			expect(Object.keys(rooms)).toHaveLength(1);
			expect(rooms['Living Room']).toBeDefined();
		});
	});

	describe('updateDeviceStatus', () => {
		test('should mark online devices', () => {
			const device = new MockDevice('device1', DeviceSource.MATTER, [new MockOnOffCluster()]);
			api.setDevices([device], DeviceSource.MATTER);

			api.updateDeviceStatus(['device1'], []);

			const registry = api.getStoredDevices();
			expect(registry['device1'].status).toBe('online');
			expect(registry['device1'].lastSeen).toBeGreaterThan(0);
		});

		test('should mark devices that went offline', () => {
			const device1 = new MockDevice('device1', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);
			const device2 = new MockDevice('device2', DeviceSource.MATTER, [
				new MockOnOffCluster(),
			]);

			api.setDevices([device1, device2], DeviceSource.MATTER);
			const initialLastSeen = api.getStoredDevices()['device2'].lastSeen;

			// Wait a bit to ensure timestamp would change
			const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
			void waitFor(10);

			api.updateDeviceStatus(['device1'], ['device1', 'device2']);

			const registry = api.getStoredDevices();
			expect(registry['device1'].status).toBe('online');
			expect(registry['device2'].status).toBe('offline');
			// Offline device's lastSeen should not be updated
			expect(registry['device2'].lastSeen).toBe(initialLastSeen);
		});

		test('should handle new devices', () => {
			api.updateDeviceStatus(['newdevice'], []);

			const registry = api.getStoredDevices();
			expect(registry['newdevice']).toBeDefined();
			expect(registry['newdevice'].status).toBe('online');
		});
	});

	describe('getStoredDevices', () => {
		test('should return empty object when no devices', () => {
			const devices = api.getStoredDevices();

			expect(devices).toEqual({});
		});

		test('should return device registry', () => {
			const device = new MockDevice('device1', DeviceSource.MATTER, [new MockOnOffCluster()]);
			api.setDevices([device], DeviceSource.MATTER);

			const devices = api.getStoredDevices();

			expect(Object.keys(devices)).toHaveLength(1);
			expect(devices['device1']).toBeDefined();
		});
	});
});
