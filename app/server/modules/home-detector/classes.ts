import {
	AWAY_MIN_CONSECUTIVE_PINGS,
	CHANGE_PING_INTERVAL,
	HOME_PING_INTERVAL,
	AWAY_PING_INTERVAL,
} from './constants';
import type { Database } from '../../lib/db';
import homeIps from '../../config/home-ips';
import type { HomeDetectorDB } from '.';
import { getEnv } from '../../lib/io';
import { HOME_STATE } from './types';
import * as ping from 'ping';

function wait(time: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, time);
	});
}

class Pinger {
	private _state: HOME_STATE | null = null;
	public leftAt: Date = new Date(1970, 0, 0, 0, 0, 0, 0);
	public joinedAt: Date = new Date(1970, 0, 0, 0, 0, 0, 0);

	public get state() {
		return this._state!;
	}

	public constructor(
		private readonly _config: {
			name: string;
			ips: string[];
		},
		private readonly _db: Database<HomeDetectorDB>,
		private readonly _onChange: (
			newState: HOME_STATE
		) => void | Promise<void>
	) {
		void this._init();
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
		return results.some((v) => v.state === HOME_STATE.HOME)
			? HOME_STATE.HOME
			: HOME_STATE.AWAY;
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
		for (;;) {
			const newState = await this._pingAll();
			if (newState.state !== this._state) {
				let finalState: HOME_STATE = newState.state;
				if (newState.state !== HOME_STATE.HOME) {
					finalState = await this._stateChange(newState);
				} else {
					// A ping definitely landed, device is home
				}
				if (finalState !== this._state && this._state !== null) {
					await this._onChange(finalState);
				}
				if (finalState === HOME_STATE.AWAY) {
					this.leftAt = new Date();
				} else {
					this.joinedAt = new Date();
				}
				this._state = finalState;
				await wait(CHANGE_PING_INTERVAL);
			} else {
				await wait(
					(this._state === HOME_STATE.HOME
						? HOME_PING_INTERVAL
						: AWAY_PING_INTERVAL) * 1000
				);
			}
		}
	}

	private async _init() {
		this._state = this._db.current()[this._config.name] ?? HOME_STATE.AWAY;
		await this._pingLoop();
	}
}

export class Detector {
	private static _listeners: {
		name: string | null;
		callback: (newState: HOME_STATE, name: string) => void | Promise<void>;
	}[] = [];
	private readonly _db: Database<HomeDetectorDB>;
	private _pingers: Map<string, Pinger> = new Map();

	public constructor({ db }: { db: Database<HomeDetectorDB> }) {
		this._db = db;
		this._initPingers();
	}

	public static addListener(
		name: string | null,
		callback: (newState: HOME_STATE, name: string) => void | Promise<void>
	): void {
		this._listeners.push({
			name,
			callback,
		});
	}

	private async _onChange(changeName: string, newState: HOME_STATE) {
		for (const { name, callback } of Detector._listeners) {
			if (name === null || changeName === name) {
				await callback(newState, changeName);
			}
		}
	}

	private _initPingers() {
		const config = {
			...homeIps,
			base: {
				...homeIps.base,
				self: [getEnv('SELF_IP', true)],
			},
		} as {
			base: {
				[key: string]: string[];
			};
		};
		for (const { key, data } of (Object.keys(config.base ?? {}) || []).map(
			(n) => ({
				key: n,
				data: config.base[n],
			})
		)) {
			this._pingers.set(
				key,
				new Pinger(
					{
						name: key,
						ips: data,
					},
					this._db,
					async (newState) => {
						await this._onChange(key, newState);
					}
				)
			);
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
}
