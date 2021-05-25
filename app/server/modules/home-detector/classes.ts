import { HomeDetector } from './index';
import { Database } from '../../lib/db';
import { HOME_STATE } from './types';
import * as ping from 'ping';
import homeIps from '../../config/home-ips';
import {
	AWAY_MIN_CONSECUTIVE_PINGS,
	CHANGE_PING_INTERVAL,
	HOME_PING_INTERVAL,
	AWAY_PING_INTERVAL,
} from './constants';

function wait(time: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, time);
	});
}

class Pinger {
	private _state: HOME_STATE | null = null;
	public leftAt: Date = new Date(1970, 0, 0, 0, 0, 0, 0);
	public joinedAt: Date = new Date(1970, 0, 0, 0, 0, 0, 0);

	constructor(
		private _config: {
			name: string;
			ips: string[];
		},
		private _db: Database,
		private _onChange: (newState: HOME_STATE) => void
	) {
		void this._init();
	}

	private async _change(newState: HOME_STATE) {
		if (await HomeDetector.explainHook) {
			(await HomeDetector.explainHook)(
				`${this._config.name} state changed to ${newState}`,
				'time',
				null
			);
		}

		this._onChange(newState);
	}

	private async _ping(ip: string) {
		const { alive } = await ping.promise.probe(ip, {
			timeout: 2000,
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
					timeout: 2000,
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
					await this._change(finalState);
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
		this._state = this._db.get(this._config.name, HOME_STATE.AWAY);
		await this._pingLoop();
	}

	get state() {
		return this._state!;
	}
}

export class Detector {
	private _db: Database;
	private static _listeners: {
		name: string | null;
		callback: (newState: HOME_STATE, name: string) => void;
	}[] = [];
	private _basePingers: Map<string, Pinger> = new Map();
	private _extendedPingers: Map<string, Pinger> = new Map();

	constructor({ db }: { db: Database }) {
		this._db = db;
		this._initPingers();
	}

	private _onChange(changeName: string, newState: HOME_STATE) {
		Detector._listeners.forEach(({ name, callback }) => {
			if (name === null || changeName === name) {
				callback(newState, changeName);
			}
		});
	}

	private _initPingers() {
		for (const { key, data, extended } of [
			...(Object.keys(homeIps.base) || []).map((n) => ({
				key: n,
				data: homeIps.base[n],
				extended: false,
			})),
			...(Object.keys(homeIps.extended) || []).map((n) => ({
				key: n,
				data: homeIps.extended[n],
				extended: true,
			})),
		]) {
			this._extendedPingers.set(
				key,
				new Pinger(
					{
						name: key,
						ips: data,
					},
					this._db,
					(newState) => {
						this._onChange(key, newState);
					}
				)
			);
			if (!extended) {
				this._basePingers.set(key, this._extendedPingers.get(key)!);
			}
		}
	}

	getAll(extended = false): Record<string, HOME_STATE> {
		const obj: {
			[key: string]: HOME_STATE;
		} = {};
		if (extended) {
			this._extendedPingers.forEach((pinger, key) => {
				obj[key] = pinger.state;
			});
		} else {
			this._basePingers.forEach((pinger, key) => {
				obj[key] = pinger.state;
			});
		}
		return obj;
	}

	getPinger(name: string): Pinger | undefined {
		return this._extendedPingers.get(name);
	}

	get(name: string): HOME_STATE | '?' {
		const pinger = this._extendedPingers.get(name);
		if (!pinger) {
			return '?';
		}
		return pinger.state;
	}

	static addListener(
		name: string | null,
		callback: (newState: HOME_STATE, name: string) => void
	): void {
		this._listeners.push({ name, callback });
	}
}
