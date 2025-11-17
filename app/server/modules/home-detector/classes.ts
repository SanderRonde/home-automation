import {
	AWAY_MIN_CONSECUTIVE_PINGS,
	CHANGE_PING_INTERVAL,
	HOME_PING_INTERVAL,
	AWAY_PING_INTERVAL,
	GRACE_PERIOD_PINGS,
} from './constants';
import { DeviceBooleanStateCluster, DeviceOccupancySensingCluster } from '../device/cluster';
import type { Device as DeviceInterface } from '../device/device';
import { SceneTriggerType } from '../../../../types/scene';
import { logTag } from '../../lib/logging/logger';
import type { Database } from '../../lib/db';
import type { AllModules } from '../modules';
import type { HomeDetectorDB } from '.';
import type { Host } from './routing';
import { HOME_STATE } from './types';
import type { SQL } from 'bun';
import * as ping from 'ping';

function wait(time: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, time);
	});
}

class Pinger {
	private _state: HOME_STATE | null = null;
	private _lastState: HOME_STATE | null = null;
	private _stopped: boolean = false;
	public leftAt: Date | undefined = undefined;
	public joinedAt: Date | undefined = undefined;

	public get state() {
		return this._state!;
	}

	public get name() {
		return this._config.name;
	}

	public get ips() {
		return this._config.ips;
	}

	public constructor(
		private readonly _config: {
			name: string;
			ips: string[];
		},
		private readonly _db: Database<HomeDetectorDB>,
		private readonly _onChange: (newState: HOME_STATE) => void | Promise<void>,
		private readonly _sqlDB?: SQL
	) {
		void this._init();
	}

	public stop(): void {
		this._stopped = true;
	}

	public async manualCheck(): Promise<{
		success: boolean;
		state: HOME_STATE;
		ip?: string;
		error?: string;
	}> {
		try {
			const result = await this._pingLoopSingle(false);
			return {
				success: true,
				state: result.state,
				ip: result.ip,
			};
		} catch (error) {
			return {
				success: false,
				state: HOME_STATE.AWAY,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	private async _pingAll(
		multiPing: boolean,
		pingOnly?: string
	): Promise<
		| {
				ip: string;
				state: HOME_STATE.HOME;
		  }
		| {
				ip?: string;
				state: HOME_STATE.AWAY;
		  }
	> {
		const pings = await Promise.all(
			this._config.ips.flatMap(async (ip) => {
				if (pingOnly && ip !== pingOnly) {
					return Promise.resolve([]);
				}
				const ipPings = [];
				for (let i = 0; i < (multiPing ? AWAY_MIN_CONSECUTIVE_PINGS : 1); i++) {
					await wait(1000);
					ipPings.push(
						await ping.promise.probe(ip, {
							timeout: 5,
						})
					);
				}
				return ipPings;
			})
		);
		for (const ipPings of pings) {
			for (const ping of ipPings) {
				if (ping.alive) {
					return {
						ip: ping.host,
						state: HOME_STATE.HOME,
					};
				}
			}
		}
		return {
			state: HOME_STATE.AWAY,
		};
	}

	private async _pingLoopSingle(withGracePeriod: boolean) {
		let newState = await this._pingAll(false);

		if (newState.state === this._lastState) {
			return {
				...newState,
				waitFor:
					newState.state === HOME_STATE.HOME ? HOME_PING_INTERVAL : AWAY_PING_INTERVAL,
			};
		}

		newState = await this._pingAll(true, newState.ip);
		if (newState.state === this._lastState) {
			logTag('home-detector', 'yellow', this.name, 'Same state');
			return {
				...newState,
				waitFor:
					newState.state === HOME_STATE.HOME ? HOME_PING_INTERVAL : AWAY_PING_INTERVAL,
			};
		}

		this._lastState = newState.state;
		if (newState.state === HOME_STATE.HOME) {
			logTag('home-detector', 'yellow', this.name, 'Now home');
			this.joinedAt = new Date();
			this._state = HOME_STATE.HOME;
			this._db.update((old) => ({
				...old,
				[this._config.name]: HOME_STATE.HOME,
			}));
			await this._onChange(HOME_STATE.HOME);
			await this._logEvent(HOME_STATE.HOME);
			return {
				...newState,
				waitFor: CHANGE_PING_INTERVAL,
			};
		}

		this.leftAt = new Date();

		// Device appears to be away, start grace period
		if (withGracePeriod) {
			logTag('home-detector', 'yellow', this.name, 'Now away - starting grace period');
			for (let i = 0; i < GRACE_PERIOD_PINGS; i++) {
				await wait(1000);
				newState = await this._pingAll(false, newState.ip);
				if (newState.state === HOME_STATE.HOME) {
					// Is home after all
					logTag('home-detector', 'yellow', this.name, 'Now home - ending grace period');
					return {
						...newState,
						waitFor: CHANGE_PING_INTERVAL,
					};
				}
			}
			logTag('home-detector', 'yellow', this.name, 'Now away - grace period ended');
		}

		this._state = HOME_STATE.AWAY;
		this._db.update((old) => ({
			...old,
			[this._config.name]: HOME_STATE.AWAY,
		}));
		await this._onChange(HOME_STATE.AWAY);
		await this._logEvent(HOME_STATE.AWAY);
		return {
			...newState,
			waitFor: CHANGE_PING_INTERVAL,
		};
	}

	private async _pingLoop() {
		while (!this._stopped) {
			const result = await this._pingLoopSingle(true);
			await wait(result.waitFor);
		}
	}

	private async _logEvent(state: HOME_STATE): Promise<void> {
		if (!this._sqlDB) {
			return;
		}

		try {
			await this._sqlDB`
				INSERT INTO home_detection_events (host_name, state, timestamp, trigger_type)
				VALUES (${this._config.name}, ${state.toUpperCase()}, ${Date.now()}, 'ping')
			`;
		} catch (error) {
			logTag('home-detector', 'red', 'Failed to log event:', error);
		}
	}

	private async _init() {
		this._state = this._db.current()[this._config.name] ?? HOME_STATE.AWAY;
		this._lastState = this._state;
		await this._pingLoop();
	}
}

export interface HostConfig {
	name: string;
	ips: string[];
}

export interface HostsConfigDB {
	hosts: Record<string, HostConfig>;
	doorSensorIds?: string[];
	movementSensorIds?: string[];
}

export class Detector {
	private _listeners: {
		name: string | null;
		callback: (
			newState: HOME_STATE,
			name: string,
			fullState: Record<string, HOME_STATE>
		) => void | Promise<void>;
	}[] = [];
	private readonly _db: Database<HomeDetectorDB>;
	private readonly _hostsDb: Database<HostsConfigDB>;
	private readonly _sqlDB?: SQL;
	private readonly _modules: unknown;
	private _pingers: Map<string, Pinger> = new Map();

	public constructor({
		db,
		hostsDb,
		sqlDB,
		modules,
	}: {
		db: Database<HomeDetectorDB>;
		hostsDb: Database<HostsConfigDB>;
		sqlDB?: SQL;
		modules: unknown;
	}) {
		this._db = db;
		this._hostsDb = hostsDb;
		this._sqlDB = sqlDB;
		this._modules = modules;
		this._initPingers();
	}

	public addListener(
		name: string | null,
		callback: (
			newState: HOME_STATE,
			name: string,
			fullState: Record<string, HOME_STATE>
		) => void | Promise<void>
	): void {
		this._listeners.push({
			name,
			callback,
		});
	}

	private async _onChange(changeName: string, newState: HOME_STATE) {
		for (const { name, callback } of this._listeners) {
			if (name === null || changeName === name) {
				await callback(newState, changeName, this.getAll());
			}
		}
	}

	private _initPingers() {
		// Load hosts from database
		const hostsDb = this._hostsDb.current();
		for (const hostConfig of Object.values(hostsDb.hosts ?? {})) {
			if (hostConfig) {
				this._pingers.set(
					hostConfig.name,
					new Pinger(
						{
							name: hostConfig.name,
							ips: hostConfig.ips,
						},
						this._db,
						async (newState) => {
							await this._onChange(hostConfig.name, newState);
						},
						this._sqlDB
					)
				);
			}
		}
	}

	public getAll(): Record<string, HOME_STATE> {
		const obj: {
			[key: string]: HOME_STATE;
		} = {};
		this._pingers.forEach((pinger, key) => {
			obj[key] = pinger.state;
		});
		return obj;
	}

	public getPinger(name: string): Pinger | undefined {
		return this._pingers.get(name);
	}

	public get(name: string): HOME_STATE | '?' {
		const pinger = this._pingers.get(name);
		if (!pinger) {
			return '?';
		}
		return pinger.state;
	}

	public listHosts(): Host[] {
		const hostsConfig = this._hostsDb.current();
		const hosts: Host[] = [];

		for (const hostConfig of Object.values(hostsConfig.hosts ?? {})) {
			if (hostConfig) {
				const pinger = this._pingers.get(hostConfig.name);
				hosts.push({
					name: hostConfig.name,
					ips: hostConfig.ips,
					lastSeen: pinger?.state === HOME_STATE.HOME ? pinger.joinedAt : pinger?.leftAt,
				});
			}
		}

		return hosts;
	}

	public addHost(name: string, ips: string[]): string {
		if (ips.length === 0) {
			throw new Error('At least one IP address is required');
		}

		const hostConfig: HostConfig = {
			name,
			ips,
		};

		// Save to database
		this._hostsDb.update((old) => ({
			...old,
			hosts: {
				...old.hosts,
				[name]: hostConfig,
			},
		}));

		// Create pinger
		const pinger = new Pinger(
			{
				name,
				ips,
			},
			this._db,
			async (newState) => {
				await this._onChange(name, newState);
			},
			this._sqlDB
		);
		this._pingers.set(name, pinger);

		return name;
	}

	public updateHost(name: string, ips: string[]): boolean {
		const hostsConfig = this._hostsDb.current();
		if (!hostsConfig.hosts?.[name]) {
			return false;
		}

		if (ips.length === 0) {
			throw new Error('At least one IP address is required');
		}

		// Update database
		this._hostsDb.update((old) => ({
			...old,
			[name]: {
				name,
				ips,
			},
		}));

		// Stop old pinger
		const oldPinger = this._pingers.get(name);
		if (oldPinger) {
			oldPinger.stop();
		}

		// Create new pinger with updated config
		const pinger = new Pinger(
			{
				name,
				ips,
			},
			this._db,
			async (newState) => {
				await this._onChange(name, newState);
			},
			this._sqlDB
		);
		this._pingers.set(name, pinger);

		return true;
	}

	public removeHost(name: string): boolean {
		const hostsConfig = this._hostsDb.current();
		if (!hostsConfig.hosts?.[name]) {
			return false;
		}

		// Remove from database
		this._hostsDb.update((old) => {
			const newConfig = { ...old };
			delete newConfig.hosts?.[name];
			return newConfig;
		});

		// Stop and remove pinger
		const pinger = this._pingers.get(name);
		if (pinger) {
			pinger.stop();
			this._pingers.delete(name);
		}

		// Clean up state database
		this._db.update((old) => {
			const newState = { ...old };
			delete newState[name];
			return newState;
		});

		return true;
	}

	public async getEventHistory(limit = 100): Promise<
		Array<{
			id: number;
			host_name: string;
			state: string;
			timestamp: number;
			trigger_type?: string | null;
			scenes_triggered?: string | null;
		}>
	> {
		if (!this._sqlDB) {
			return [];
		}

		try {
			return await this._sqlDB<
				Array<{
					id: number;
					host_name: string;
					state: string;
					timestamp: number;
					trigger_type: string | null;
					scenes_triggered: string | null;
				}>
			>`
				SELECT id, host_name, state, timestamp, trigger_type, scenes_triggered
				FROM home_detection_events
				ORDER BY timestamp DESC
				LIMIT ${limit}
			`;
		} catch (error) {
			logTag('home-detector', 'red', 'Failed to get event history:', error);
			return [];
		}
	}

	public async logDoorSensorTrigger(): Promise<void> {
		if (!this._sqlDB) {
			return;
		}

		try {
			await this._sqlDB`
				INSERT INTO home_detection_events (host_name, state, timestamp, trigger_type)
				VALUES ('system', 'change', ${Date.now()}, 'door-sensor')
			`;
		} catch (error) {
			logTag('home-detector', 'red', 'Failed to log door sensor trigger:', error);
		}
	}

	public async logMovementSensorTrigger(): Promise<void> {
		if (!this._sqlDB) {
			return;
		}

		try {
			await this._sqlDB`
				INSERT INTO home_detection_events (host_name, state, timestamp, trigger_type)
				VALUES ('system', 'change', ${Date.now()}, 'movement-sensor')
			`;
		} catch (error) {
			logTag('home-detector', 'red', 'Failed to log movement sensor trigger:', error);
		}
	}

	public getDoorSensorIds(): string[] {
		return this._hostsDb.current().doorSensorIds ?? [];
	}

	public setDoorSensorIds(ids: string[]): void {
		this._hostsDb.update((old) => ({
			...old,
			doorSensorIds: ids,
		}));
	}

	public getMovementSensorIds(): string[] {
		return this._hostsDb.current().movementSensorIds ?? [];
	}

	public setMovementSensorIds(ids: string[]): void {
		this._hostsDb.update((old) => ({
			...old,
			movementSensorIds: ids,
		}));
	}

	public async triggerRapidPing(options?: {
		fireAnybodyHomeFirst?: boolean;
	}): Promise<void> {
		const allStates = this.getAll();
		const anyoneHome = Object.values(allStates).some((state) => state === HOME_STATE.HOME);
		const allHome = Object.values(allStates).every((state) => state === HOME_STATE.HOME);

		// If requested, fire ANYBODY_HOME first (if not already home)
		if (options?.fireAnybodyHomeFirst && !anyoneHome) {
			logTag(
				'home-detector',
				'yellow',
				'Movement detected - firing ANYBODY_HOME before rapid ping'
			);
			const deviceAPI = await (this._modules as AllModules).device.api.value;
			try {
				await deviceAPI.sceneAPI.onTrigger({
					type: SceneTriggerType.ANYBODY_HOME,
				});
			} catch (error) {
				logTag('home-detector', 'red', 'Failed to trigger anybody-home scenes:', error);
			}
		}

		if (allHome) {
			return;
		}

		const results = await Promise.all(
			[...this._pingers.values()].map(async (pinger: Pinger) => {
				for (let i = 0; i < 5 * 60; i++) {
					const result = await pinger.manualCheck();
					if (result.state === HOME_STATE.HOME) {
						return true;
					}
					await wait(1000);
				}
				return false;
			})
		);

		if (results.length === 0 || results.some((result) => result)) {
			return;
		}

		logTag(
			'home-detector',
			'yellow',
			'Sensor triggered but no one came home - sending notification and firing NOBODY_HOME'
		);
		try {
			const pushManager = await (this._modules as AllModules).notification.getPushManager();
			await pushManager.sendDoorSensorAlert();
		} catch (error) {
			logTag('home-detector', 'red', 'Failed to send door sensor alert:', error);
		}
		const deviceAPI = await (this._modules as AllModules).device.api.value;
		try {
			await deviceAPI.sceneAPI.onTrigger({
				type: SceneTriggerType.NOBODY_HOME_TIMEOUT,
			});
		} catch (error) {
			logTag('home-detector', 'red', 'Failed to trigger nobody-home-timeout scenes:', error);
		}
		// Also fire NOBODY_HOME if we had fired ANYBODY_HOME earlier
		if (options?.fireAnybodyHomeFirst && !anyoneHome) {
			try {
				await deviceAPI.sceneAPI.onTrigger({
					type: SceneTriggerType.NOBODY_HOME,
				});
			} catch (error) {
				logTag('home-detector', 'red', 'Failed to trigger nobody-home scenes:', error);
			}
		}
	}

	public async checkAllHosts(): Promise<
		Array<{
			name: string;
			ips: string[];
			result: {
				success: boolean;
				state: HOME_STATE;
				ip?: string;
				error?: string;
			};
		}>
	> {
		const results: Array<{
			name: string;
			ips: string[];
			result: {
				success: boolean;
				state: HOME_STATE;
				ip?: string;
				error?: string;
			};
		}> = [];

		for (const [name, pinger] of this._pingers.entries()) {
			const result = await pinger.manualCheck();
			results.push({
				name,
				ips: pinger.ips,
				result,
			});
		}

		return results;
	}
}

export class DoorSensorMonitor {
	private _subscriptions = new Map<string, () => void>();

	public constructor(
		private readonly _detector: Detector,
		private readonly _hostsDb: Database<HostsConfigDB>
	) {}

	public trackDevices(devices: DeviceInterface[]): void {
		// Get currently configured door sensor IDs
		const doorSensorIds = this._hostsDb.current().doorSensorIds ?? [];
		const doorSensorIdSet = new Set(doorSensorIds);

		// Clean up old subscriptions
		for (const [deviceId, unsubscribe] of this._subscriptions.entries()) {
			if (!doorSensorIdSet.has(deviceId)) {
				unsubscribe();
				this._subscriptions.delete(deviceId);
			}
		}

		// Subscribe to new door sensors
		for (const device of devices) {
			const deviceId = device.getUniqueId();

			// Only track devices that are in the configured list
			if (!doorSensorIdSet.has(deviceId)) {
				continue;
			}

			// Skip if already tracking
			if (this._subscriptions.has(deviceId)) {
				continue;
			}

			// Find boolean state cluster (door sensors)
			const booleanStateClusters = device.getAllClustersByType(DeviceBooleanStateCluster);
			if (!booleanStateClusters.length) {
				continue;
			}

			for (const booleanStateCluster of booleanStateClusters) {
				// Subscribe to door state changes
				const unsubscribe = booleanStateCluster.onStateChange.listen(async ({ state }) => {
					// Door opened (state changed to true/open)
					if (state) {
						logTag(
							'home-detector',
							'yellow',
							`Door sensor ${deviceId} triggered - starting rapid ping`
						);
						void this._detector.triggerRapidPing();
						await this._detector.logDoorSensorTrigger();
					}
				});

				this._subscriptions.set(deviceId, unsubscribe);
			}
		}
	}

	public destroy(): void {
		for (const unsubscribe of this._subscriptions.values()) {
			unsubscribe();
		}
		this._subscriptions.clear();
	}
}

export class MovementSensorMonitor {
	private _subscriptions = new Map<string, () => void>();

	public constructor(
		private readonly _detector: Detector,
		private readonly _hostsDb: Database<HostsConfigDB>
	) {}

	public trackDevices(devices: DeviceInterface[]): void {
		// Get currently configured movement sensor IDs
		const movementSensorIds = this._hostsDb.current().movementSensorIds ?? [];
		const movementSensorIdSet = new Set(movementSensorIds);

		// Clean up old subscriptions
		for (const [deviceId, unsubscribe] of this._subscriptions.entries()) {
			if (!movementSensorIdSet.has(deviceId)) {
				unsubscribe();
				this._subscriptions.delete(deviceId);
			}
		}

		// Subscribe to new movement sensors
		for (const device of devices) {
			const deviceId = device.getUniqueId();

			// Only track devices that are in the configured list
			if (!movementSensorIdSet.has(deviceId)) {
				continue;
			}

			// Skip if already tracking
			if (this._subscriptions.has(deviceId)) {
				continue;
			}

			// Find occupancy sensing cluster (movement sensors)
			const occupancyClusters = device.getAllClustersByType(DeviceOccupancySensingCluster);
			if (!occupancyClusters.length) {
				continue;
			}

				for (const occupancyCluster of occupancyClusters) {
				// Subscribe to occupancy changes
				const unsubscribe = occupancyCluster.onOccupied.listen(async ({ occupied }) => {
					// Movement detected (occupied changed to true)
					if (occupied) {
						logTag(
							'home-detector',
							'yellow',
							`Movement sensor ${deviceId} triggered - firing ANYBODY_HOME and starting rapid ping`
						);
						void this._detector.triggerRapidPing({ fireAnybodyHomeFirst: true });
						await this._detector.logMovementSensorTrigger();
					}
				});

				this._subscriptions.set(deviceId, unsubscribe);
			}
		}
	}

	public destroy(): void {
		for (const unsubscribe of this._subscriptions.values()) {
			unsubscribe();
		}
		this._subscriptions.clear();
	}
}
