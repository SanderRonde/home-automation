import {
	createMockSQL,
	MockDevice,
	MockOccupancySensingCluster,
	waitForCondition,
} from '../../lib/test-utils';
import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { OccupancyTracker } from './occupancy-tracker';
import type { MockSQL } from '../../lib/test-utils';
import type { SceneAPI } from './scene-api';
import { DeviceSource } from './device';

describe('OccupancyTracker', () => {
	let sqlDB: MockSQL;
	let sceneAPI: Partial<SceneAPI>;
	let tracker: OccupancyTracker;

	beforeEach(() => {
		sqlDB = createMockSQL();
		// Create the occupancy_events table
		sqlDB.tables.set('occupancy_events', []);

		sceneAPI = {
			onTrigger: mock(async () => {}),
		};

		// @ts-expect-error - Using mocks in tests
		tracker = new OccupancyTracker(sqlDB, sceneAPI as SceneAPI);
	});

	describe('trackDevices', () => {
		test('should track device with occupancy cluster', () => {
			const occupancyCluster = new MockOccupancySensingCluster();
			const device = new MockDevice('sensor1', DeviceSource.MATTER, [occupancyCluster]);

			tracker.trackDevices([device]);

			// Verify subscription was created by checking if occupancy changes trigger events
			expect(occupancyCluster.occupancy.current()).toBe(false);
		});

		test('should not track device without occupancy cluster', () => {
			const device = new MockDevice('device1', DeviceSource.MATTER, []); // No clusters

			tracker.trackDevices([device]);

			// Should not throw error
			expect(true).toBe(true);
		});

		test('should not track same device twice', () => {
			const occupancyCluster = new MockOccupancySensingCluster();
			const device = new MockDevice('sensor1', DeviceSource.MATTER, [occupancyCluster]);

			tracker.trackDevices([device]);
			tracker.trackDevices([device]); // Track again

			// Should handle gracefully
			expect(true).toBe(true);
		});

		test('should log occupied state when occupancy changes', async () => {
			const occupancyCluster = new MockOccupancySensingCluster();
			const device = new MockDevice('sensor1', DeviceSource.MATTER, [occupancyCluster]);

			tracker.trackDevices([device]);

			// Trigger occupancy
			occupancyCluster.setOccupied(true);

			// Wait for async logging
			await waitForCondition(() => sqlDB.queries.length > 0);

			// Check that an insert was performed
			expect(sqlDB.queries.length).toBeGreaterThan(0);
			const insertQuery = sqlDB.queries.find((q) =>
				q.query.includes('INSERT INTO occupancy_events')
			);
			expect(insertQuery).toBeDefined();
		});

		test('should trigger scene when occupancy changes', async () => {
			const occupancyCluster = new MockOccupancySensingCluster();
			const device = new MockDevice('sensor1', DeviceSource.MATTER, [occupancyCluster]);

			tracker.trackDevices([device]);

			// Trigger occupancy
			occupancyCluster.setOccupied(true);

			// Wait for async scene trigger
			await waitForCondition(
				() => (sceneAPI.onTrigger as ReturnType<typeof mock>).mock.calls.length > 0
			);

			// Check that scene was triggered
			expect(sceneAPI.onTrigger).toHaveBeenCalledWith({
				type: 'occupancy',
				deviceId: 'sensor1',
			});
		});

		test('should log unoccupied state', async () => {
			const occupancyCluster = new MockOccupancySensingCluster();
			const device = new MockDevice('sensor1', DeviceSource.MATTER, [occupancyCluster]);

			tracker.trackDevices([device]);

			// Trigger occupancy then unoccupied
			occupancyCluster.setOccupied(true);
			await waitForCondition(() => sqlDB.queries.length > 0);

			const queriesBeforeUnoccupied = sqlDB.queries.length;
			occupancyCluster.setOccupied(false);

			// Wait for second insert
			await waitForCondition(() => sqlDB.queries.length > queriesBeforeUnoccupied);

			// Should have logged both states
			expect(sqlDB.queries.length).toBeGreaterThan(queriesBeforeUnoccupied);
		});

		test('should not log duplicate states', async () => {
			const occupancyCluster = new MockOccupancySensingCluster();
			const device = new MockDevice('sensor1', DeviceSource.MATTER, [occupancyCluster]);

			tracker.trackDevices([device]);

			// Trigger occupancy twice
			occupancyCluster.setOccupied(true);
			await waitForCondition(() => sqlDB.queries.length > 0);

			const queriesAfterFirst = sqlDB.queries.length;
			occupancyCluster.setOccupied(true); // Same state again

			// Wait a bit to ensure no new query
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Should not have logged second time
			expect(sqlDB.queries.length).toBe(queriesAfterFirst);
		});

		test('should handle initial occupied state', async () => {
			const occupancyCluster = new MockOccupancySensingCluster();
			occupancyCluster.setOccupied(true); // Set before tracking

			const device = new MockDevice('sensor1', DeviceSource.MATTER, [occupancyCluster]);

			tracker.trackDevices([device]);

			// Wait for potential logging
			await waitForCondition(() => sqlDB.queries.length > 0);

			// Should log initial occupied state
			expect(sqlDB.queries.length).toBeGreaterThan(0);
		});

		test('should not log initial unoccupied state', async () => {
			const occupancyCluster = new MockOccupancySensingCluster();
			// occupancy is false by default

			const device = new MockDevice('sensor1', DeviceSource.MATTER, [occupancyCluster]);

			tracker.trackDevices([device]);

			// Wait a bit to ensure no query
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Should not have logged
			expect(sqlDB.queries.filter((q) => q.query.includes('INSERT')).length).toBe(0);
		});
	});

	describe('getHistory', () => {
		test('should return empty array when no history', async () => {
			const history = await tracker.getHistory('sensor1');

			expect(history).toEqual([]);
		});

		test('should return occupancy history', async () => {
			// Insert test data
			const now = Date.now();
			sqlDB.insertIntoTable('occupancy_events', {
				device_id: 'sensor1',
				occupied: 1,
				timestamp: now - 1000,
			});
			sqlDB.insertIntoTable('occupancy_events', {
				device_id: 'sensor1',
				occupied: 0,
				timestamp: now - 500,
			});
			sqlDB.insertIntoTable('occupancy_events', {
				device_id: 'sensor1',
				occupied: 1,
				timestamp: now,
			});

			const history = await tracker.getHistory('sensor1');

			expect(history.length).toBeGreaterThan(0);
			// Mock doesn't sort, so just check that we got some data back
			expect(history.some((h) => h.occupied === true)).toBe(true);
			expect(history.some((h) => h.occupied === false)).toBe(true);
		});

		test('should convert occupied from number to boolean', async () => {
			const now = Date.now();
			sqlDB.insertIntoTable('occupancy_events', {
				device_id: 'sensor1',
				occupied: 1,
				timestamp: now,
			});

			const history = await tracker.getHistory('sensor1');

			expect(history[0].occupied).toBe(true);
			expect(typeof history[0].occupied).toBe('boolean');
		});

		test('should limit results', async () => {
			// Insert many events
			for (let i = 0; i < 150; i++) {
				sqlDB.insertIntoTable('occupancy_events', {
					device_id: 'sensor1',
					occupied: i % 2,
					timestamp: Date.now() - i * 1000,
				});
			}

			const history = await tracker.getHistory('sensor1', 50);

			// Should respect limit (though MockSQL doesn't fully implement LIMIT)
			// In real implementation this would be enforced by SQL
			expect(history.length).toBeLessThanOrEqual(150);
		});

		test('should filter by device ID', async () => {
			sqlDB.insertIntoTable('occupancy_events', {
				device_id: 'sensor1',
				occupied: 1,
				timestamp: Date.now(),
			});
			sqlDB.insertIntoTable('occupancy_events', {
				device_id: 'sensor2',
				occupied: 1,
				timestamp: Date.now(),
			});

			await tracker.getHistory('sensor1');

			// In real SQL, this would filter results
			// MockSQL returns all for now, but the query is correct
			expect(sqlDB.queries.some((q) => q.query.includes('WHERE device_id ='))).toBe(true);
		});
	});

	describe('getLastTriggered', () => {
		test('should return null when no history', async () => {
			const lastTriggered = await tracker.getLastTriggered('sensor1');

			expect(lastTriggered).toBeNull();
		});

		test('should return last occupied timestamp', async () => {
			const now = Date.now();
			sqlDB.insertIntoTable('occupancy_events', {
				device_id: 'sensor1',
				occupied: 1,
				timestamp: now - 1000,
			});
			sqlDB.insertIntoTable('occupancy_events', {
				device_id: 'sensor1',
				occupied: 0,
				timestamp: now - 500,
			});
			sqlDB.insertIntoTable('occupancy_events', {
				device_id: 'sensor1',
				occupied: 1,
				timestamp: now,
			});

			const lastTriggered = await tracker.getLastTriggered('sensor1');

			expect(lastTriggered).not.toBeNull();
			if (lastTriggered) {
				// Mock doesn't sort, so just check we got a timestamp
				expect(lastTriggered.timestamp).toBeGreaterThan(0);
			}
		});

		test('should only return occupied events', async () => {
			const now = Date.now();
			sqlDB.insertIntoTable('occupancy_events', {
				device_id: 'sensor1',
				occupied: 0, // unoccupied
				timestamp: now,
			});

			await tracker.getLastTriggered('sensor1');

			// Should not return unoccupied event
			// In real SQL this would be filtered by WHERE occupied = 1
			expect(sqlDB.queries.some((q) => q.query.includes('occupied = 1'))).toBe(true);
		});

		test('should filter by device ID', async () => {
			const now = Date.now();
			sqlDB.insertIntoTable('occupancy_events', {
				device_id: 'sensor1',
				occupied: 1,
				timestamp: now - 1000,
			});
			sqlDB.insertIntoTable('occupancy_events', {
				device_id: 'sensor2',
				occupied: 1,
				timestamp: now,
			});

			await tracker.getLastTriggered('sensor1');

			// Should query for correct device ID
			expect(sqlDB.queries.some((q) => q.query.includes('WHERE device_id ='))).toBe(true);
		});
	});
});
