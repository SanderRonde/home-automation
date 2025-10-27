import {
	AWAY_MIN_CONSECUTIVE_PINGS,
	CHANGE_PING_INTERVAL,
	HOME_PING_INTERVAL,
	AWAY_PING_INTERVAL,
	AWAY_GRACE_PERIOD,
} from './constants';
import { logDev } from '../../lib/logging/log-dev';
import type { Database } from '../../lib/db';
import type { HomeDetectorDB } from '.';
import type { Host } from './routing';
import { HOME_STATE } from './types';
import * as ping from 'ping';

function wait(time: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, time);
	});
}

class Pinger {
	private _state: HOME_STATE | null = null;
	private _stopped: boolean = false;
	public leftAt: Date = new Date(1970, 0, 0, 0, 0, 0, 0);
	public joinedAt: Date = new Date(1970, 0, 0, 0, 0, 0, 0);
	private _awayDetectedAt: Date | null = null;
	private _inGracePeriod: boolean = false;
	private _initialStateConfirmed: boolean = false;

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
		private readonly _onChange: (newState: HOME_STATE) => void | Promise<void>
	) {
		void this._init();
	}

	public stop(): void {
		this._stopped = true;
	}

	private async _ping(ip: string) {
		const { alive } = await ping.promise.probe(ip, {
			timeout: 5,
		});
		return {
			state: alive ? HOME_STATE.HOME : HOME_STATE.AWAY,
		};
	}

	private async _pingAll(): Promise<
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
			this._config.ips.map((ip) => {
				return ping.promise.probe(ip, {
					timeout: 5,
				});
			})
		);
		for (const ping of pings) {
			if (ping.alive) {
				return {
					ip: ping.host,
					state: HOME_STATE.HOME,
				};
			}
		}
		return {
			state: HOME_STATE.AWAY,
		};
	}

	private async _fastPing(ip: string) {
		const pings: Promise<{
			ip?: string;
			state: HOME_STATE;
		}>[] = [];

		for (let i = 0; i < AWAY_MIN_CONSECUTIVE_PINGS; i++) {
			pings.push(this._ping(ip));
			await wait(CHANGE_PING_INTERVAL * 1000);
		}

		const results = await Promise.all(pings);
		logDev('device', this.name, 'fast ping results:', results);
		return results.some((v) => v.state === HOME_STATE.HOME) ? HOME_STATE.HOME : HOME_STATE.AWAY;
	}

	private async _stateChange(
		newState:
			| {
					ip: string;
					state: HOME_STATE.HOME;
			  }
			| {
					ip?: string | undefined;
					state: HOME_STATE.AWAY;
			  }
	) {
		this._db.update((old) => ({
			...old,
			[this._config.name]: newState.state,
		}));
		if (newState.state === HOME_STATE.HOME) {
			return this._fastPing(newState.ip);
		} else {
			return (
				await Promise.all(
					this._config.ips.map((ip) => {
						return this._fastPing(ip);
					})
				)
			).some((v) => v === HOME_STATE.HOME)
				? HOME_STATE.HOME
				: HOME_STATE.AWAY;
		}
	}

	private async _pingLoop() {
		while (!this._stopped) {
			const newState = await this._pingAll();
			logDev('device', this.name, 'ping loop started (new state:', newState, ')');

			// Handle state transitions
			if (newState.state !== this._state) {
				if (newState.state === HOME_STATE.HOME) {
					logDev('device', this.name, 'is home');
					// Device came back home - cancel any grace period and update immediately
					this._awayDetectedAt = null;
					this._inGracePeriod = false;
					this.joinedAt = new Date();
					const shouldUpdate = this._initialStateConfirmed;
					this._state = HOME_STATE.HOME;
					this._initialStateConfirmed = true;
					// Save HOME state to database
					this._db.update((old) => ({
						...old,
						[this._config.name]: HOME_STATE.HOME,
					}));
					if (shouldUpdate) {
						await this._onChange(HOME_STATE.HOME);
					}
					await wait(CHANGE_PING_INTERVAL);
				} else {
					logDev('device', this.name, 'is away');
					// Device appears to be away
					const finalState: HOME_STATE = await this._stateChange(newState);
					logDev('device', this.name, 'is away (final state:', finalState, ')');

					if (finalState === HOME_STATE.AWAY && this._state === HOME_STATE.HOME) {
						// Start grace period - device went away from home
						if (!this._inGracePeriod) {
							logDev('device', this.name, 'is away (grace period started)');
							this._awayDetectedAt = new Date();
							this._inGracePeriod = true;
						} else {
							logDev('device', this.name, 'is away (grace period already started)');
						}
						// Don't update state yet, keep checking
						await wait(CHANGE_PING_INTERVAL * 1000);
					} else if (finalState === HOME_STATE.AWAY && this._state === HOME_STATE.AWAY) {
						logDev('device', this.name, 'is away (already away)');
						// Already away, no grace period needed
						this._initialStateConfirmed = true;
						await wait(AWAY_PING_INTERVAL * 1000);
					}
				}
			} else {
				// State hasn't changed
				if (this._inGracePeriod && this._awayDetectedAt) {
					// Check if grace period has expired
					const elapsed = (new Date().getTime() - this._awayDetectedAt.getTime()) / 1000;
					if (elapsed >= AWAY_GRACE_PERIOD) {
						logDev('device', this.name, 'is away (grace period expired)');
						// Grace period expired, mark as away
						this._inGracePeriod = false;
						this.leftAt = new Date();
						const shouldUpdate = this._initialStateConfirmed;
						this._state = HOME_STATE.AWAY;
						this._initialStateConfirmed = true;
						this._db.update((old) => ({
							...old,
							[this._config.name]: HOME_STATE.AWAY,
						}));
						if (shouldUpdate) {
							await this._onChange(HOME_STATE.AWAY);
						}
						await wait(CHANGE_PING_INTERVAL * 1000);
					} else {
						logDev('device', this.name, 'is normal (still in grace period)');
						// Still in grace period, keep checking frequently
						await wait(CHANGE_PING_INTERVAL * 1000);
					}
				} else {
					logDev('device', this.name, 'is normal (state:', this._state, ')');
					// Normal operation, no grace period
					this._initialStateConfirmed = true;
					await wait(
						(this._state === HOME_STATE.HOME
							? HOME_PING_INTERVAL
							: AWAY_PING_INTERVAL) * 1000
					);
				}
			}
		}
	}

	private async _init() {
		this._state = this._db.current()[this._config.name] ?? HOME_STATE.AWAY;
		await this._pingLoop();
	}
}

export interface HostConfig {
	name: string;
	ips: string[];
}

export interface HostsConfigDB {
	hosts: Record<string, HostConfig>;
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
	private _pingers: Map<string, Pinger> = new Map();

	public constructor({
		db,
		hostsDb,
	}: {
		db: Database<HomeDetectorDB>;
		hostsDb: Database<HostsConfigDB>;
	}) {
		this._db = db;
		this._hostsDb = hostsDb;
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
						}
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
			}
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
			}
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
}
