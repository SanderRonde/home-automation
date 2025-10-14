import {
	DeviceOnOffCluster,
	DeviceWindowCoveringCluster,
	DeviceOccupancySensingCluster,
} from '../modules/device/cluster';
import type { Device as DeviceInterface, DeviceSource } from '../modules/device/device';
import type { Cluster, DeviceClusterName } from '../modules/device/cluster';
import { EventEmitter } from './event-emitter';
import { mock } from 'bun:test';
import { Data } from './data';

/**
 * Mock implementation of OnOff cluster for testing
 */
export class MockOnOffCluster extends DeviceOnOffCluster {
	public isOn = new Data<boolean>(false);
	public onChange = new EventEmitter<void>();

	private _disposed = false;

	public async setOn(on: boolean): Promise<void> {
		this.isOn.set(on);
		this.onChange.emit();
		return Promise.resolve();
	}

	public async toggle(): Promise<void> {
		await this.setOn(!this.isOn.current());
	}

	public [Symbol.dispose](): void {
		this._disposed = true;
	}

	public isDisposed(): boolean {
		return this._disposed;
	}
}

/**
 * Mock implementation of WindowCovering cluster for testing
 */
export class MockWindowCoveringCluster extends DeviceWindowCoveringCluster {
	public targetPositionLiftPercentage = new Data<number>(0);
	public onChange = new EventEmitter<void>();

	private _disposed = false;

	public async close(): Promise<void> {
		this.targetPositionLiftPercentage.set(100);
		this.onChange.emit();
		return Promise.resolve();
	}

	public async open(): Promise<void> {
		this.targetPositionLiftPercentage.set(0);
		this.onChange.emit();
		return Promise.resolve();
	}

	public async goToLiftPercentage(args: { percentage: number }): Promise<void> {
		this.targetPositionLiftPercentage.set(args.percentage);
		this.onChange.emit();
		return Promise.resolve();
	}

	public [Symbol.dispose](): void {
		this._disposed = true;
	}

	public isDisposed(): boolean {
		return this._disposed;
	}
}

/**
 * Mock implementation of OccupancySensing cluster for testing
 */
export class MockOccupancySensingCluster extends DeviceOccupancySensingCluster {
	public occupancy = new Data<boolean>(false);
	public onChange = new EventEmitter<void>();

	private _disposed = false;

	public setOccupied(occupied: boolean): void {
		this.occupancy.set(occupied);
		this.onChange.emit();
	}

	public [Symbol.dispose](): void {
		this._disposed = true;
	}

	public isDisposed(): boolean {
		return this._disposed;
	}
}

/**
 * Mock device for testing
 */
export class MockDevice implements DeviceInterface {
	public readonly clusters: Cluster[];
	public readonly endpoints: MockDevice[] = [];
	public onChange = new EventEmitter<void>();

	private _disposed = false;
	private _name: string;

	public constructor(
		private readonly _id: string,
		private readonly _source: DeviceSource,
		clusters: Cluster[],
		name?: string
	) {
		this.clusters = clusters;
		this._name = name || `Mock Device ${_id}`;
	}

	public getUniqueId(): string {
		return this._id;
	}

	public getSource(): DeviceSource {
		return this._source;
	}

	public async getDeviceName(): Promise<string> {
		return Promise.resolve(this._name);
	}

	public setDeviceName(name: string): void {
		this._name = name;
	}

	public getClusterByType<T extends typeof Cluster & { clusterName: DeviceClusterName }>(
		type: T
	): InstanceType<T> | null {
		for (const cluster of this.clusters) {
			if (
				(cluster.constructor as unknown as { clusterName: DeviceClusterName })
					.clusterName === type.clusterName
			) {
				return cluster as unknown as InstanceType<T>;
			}
		}
		return null;
	}

	public getAllClustersByType<T extends typeof Cluster & { clusterName: DeviceClusterName }>(
		type: T
	): InstanceType<T>[] {
		return this.clusters.filter(
			(cluster) =>
				(cluster.constructor as unknown as { clusterName: DeviceClusterName })
					.clusterName === type.clusterName
		) as unknown as InstanceType<T>[];
	}

	public get allEndpoints(): MockDevice[] {
		return [this, ...this.endpoints.flatMap((e) => e.allEndpoints)];
	}

	public get allClusters(): Cluster[] {
		return [...this.clusters, ...this.endpoints.flatMap((e) => e.allClusters)];
	}

	public [Symbol.dispose](): void {
		this._disposed = true;
		for (const cluster of this.clusters) {
			cluster[Symbol.dispose]();
		}
		for (const endpoint of this.endpoints) {
			endpoint[Symbol.dispose]();
		}
	}

	public isDisposed(): boolean {
		return this._disposed;
	}
}

/**
 * Mock database for testing
 */
export class MockDatabase<T> extends Data<Partial<T>> {
	public writes: Partial<T>[] = [];
	public readonly fileName: string;

	public constructor(initialValue: Partial<T> = {}, fileName: string = 'test.db') {
		super(initialValue);
		this.fileName = fileName;
	}

	public override set(value: Partial<T>): void {
		super.set(value);
		this.writes.push({ ...value });
	}

	public override update(updater: (old: Partial<T>) => Partial<T>): void {
		super.update(updater);
		this.writes.push({ ...this.current() });
	}

	public resetWrites(): void {
		this.writes = [];
	}

	public getWriteCount(): number {
		return this.writes.length;
	}
}

/**
 * Mock SQL database for testing
 */
export interface MockSQLQueryResult<T = unknown> extends Array<T> {
	lastInsertRowid: number;
	changes: number;
}

export interface MockSQL {
	<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): MockSQLQueryResult<T>;
	queries: { query: string; params: unknown[] }[];
	tables: Map<string, unknown[]>;
	insertIntoTable(tableName: string, data: unknown): void;
	getTableData(tableName: string): unknown[];
	resetQueries(): void;
}

/**
 * Create a mock SQL instance that can be called as a template literal
 */
export function createMockSQL(): MockSQL {
	const queries: { query: string; params: unknown[] }[] = [];
	const tables = new Map<string, unknown[]>();

	const mockSQL = function <T = unknown>(
		strings: TemplateStringsArray,
		...values: unknown[]
	): MockSQLQueryResult<T> {
		const query = strings.reduce(
			(acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''),
			''
		);
		queries.push({ query, params: values });

		// Simulate basic query handling
		const result: MockSQLQueryResult<T> = [] as unknown as MockSQLQueryResult<T>;
		result.lastInsertRowid = queries.length;
		result.changes = 0;

		// Handle CREATE TABLE
		if (query.includes('CREATE TABLE')) {
			const match = /CREATE TABLE (\w+)/i.exec(query);
			if (match) {
				const tableName = match[1];
				if (!tables.has(tableName)) {
					tables.set(tableName, []);
				}
			}
			return result;
		}

		// Handle SELECT
		if (query.includes('SELECT')) {
			const match = /FROM (\w+)/i.exec(query);
			if (match) {
				const tableName = match[1];
				const tableData = tables.get(tableName) || [];
				// Create result array with proper typing
				const resultData = [...tableData] as unknown as MockSQLQueryResult<T>;
				resultData.lastInsertRowid = queries.length;
				resultData.changes = 0;
				return resultData;
			}
			return result;
		}

		// Handle INSERT
		if (query.includes('INSERT INTO')) {
			const match = /INSERT INTO (\w+)/i.exec(query);
			if (match) {
				const tableName = match[1];
				const tableData = tables.get(tableName) || [];
				const newRow = { id: tableData.length + 1 };
				tableData.push(newRow);
				tables.set(tableName, tableData);
				result.lastInsertRowid = tableData.length;
				result.changes = 1;
			}
			return result;
		}

		return result;
	} as MockSQL;

	mockSQL.queries = queries;
	mockSQL.tables = tables;
	mockSQL.insertIntoTable = (tableName: string, data: unknown) => {
		const table = tables.get(tableName) || [];
		table.push(data);
		tables.set(tableName, table);
	};
	mockSQL.getTableData = (tableName: string) => {
		return tables.get(tableName) || [];
	};
	mockSQL.resetQueries = () => {
		queries.length = 0;
	};

	return mockSQL;
}

/**
 * Create a mock WebSocket publish function
 */
export function createMockWSPublish(): (topic: string, data: unknown) => Promise<void> {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	return mock(async (_topic: string, _data: unknown) => {
		// Mock implementation - does nothing but can be spied on
	});
}

/**
 * Helper to wait for async operations
 */
export function waitFor(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to wait for a condition to become true
 */
export async function waitForCondition(
	condition: () => boolean,
	timeout = 1000,
	interval = 10
): Promise<void> {
	const start = Date.now();
	while (!condition()) {
		if (Date.now() - start > timeout) {
			throw new Error('Timeout waiting for condition');
		}
		await waitFor(interval);
	}
}
