import type {
	NukiSmartlockDetails,
	NukiSmartlockListItem,
	NukiSmartlockAction,
	NukiOpenerAction,
} from '../types';
import {
	NUKI_ACTION_LOCK,
	NUKI_ACTION_UNLOCK,
	NUKI_ACTION_UNLATCH,
	NUKI_OPENER_ACTION_OPEN,
} from '../types';

const NUKI_API_BASE = 'https://api.nuki.io';

export class NukiAPIError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly body?: string
	) {
		super(message);
		this.name = 'NukiAPIError';
	}
}

export class NukiAPIClient {
	constructor(private readonly token: string) {}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const url = `${NUKI_API_BASE}${path}`;
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.token}`,
			Accept: 'application/json',
		};
		if (body !== undefined) {
			headers['Content-Type'] = 'application/json';
		}
		// eslint-disable-next-line no-restricted-globals
		const res = await fetch(url, {
			method,
			headers,
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
		const text = await res.text();
		if (!res.ok) {
			throw new NukiAPIError(
				`Nuki API ${method} ${path}: ${res.status} ${res.statusText}`,
				res.status,
				text
			);
		}
		if (text.length === 0) {
			return undefined as T;
		}
		try {
			return JSON.parse(text) as T;
		} catch {
			return text as unknown as T;
		}
	}

	/** List all smartlocks. */
	async getSmartlocks(): Promise<NukiSmartlockListItem[]> {
		return this.request<NukiSmartlockListItem[]>('GET', '/smartlock');
	}

	/** Get single smartlock details. */
	async getSmartlock(smartlockId: number): Promise<NukiSmartlockDetails> {
		return this.request<NukiSmartlockDetails>('GET', `/smartlock/${smartlockId}`);
	}

	/** Execute lock action. */
	async smartlockAction(smartlockId: number, action: NukiSmartlockAction): Promise<void> {
		await this.request('POST', `/smartlock/${smartlockId}/action`, { action });
	}

	/** Lock the door. */
	async lock(smartlockId: number): Promise<void> {
		await this.smartlockAction(smartlockId, NUKI_ACTION_LOCK);
	}

	/** Unlock the door. */
	async unlock(smartlockId: number): Promise<void> {
		await this.smartlockAction(smartlockId, NUKI_ACTION_UNLOCK);
	}

	/** Unlatch the door. */
	async unlatch(smartlockId: number): Promise<void> {
		await this.smartlockAction(smartlockId, NUKI_ACTION_UNLATCH);
	}

	/**
	 * List openers. Web API has no separate /opener list; openers are returned by
	 * GET /smartlock with type=2 (opener). Same Smartlock shape, we treat type 2 as opener.
	 */
	async getOpeners(): Promise<NukiSmartlockListItem[]> {
		return this.request<NukiSmartlockListItem[]>('GET', '/smartlock?type=2');
	}

	/**
	 * Execute opener action. Web API has no POST /opener/{id}/action; openers use
	 * the same smartlock action endpoint (see https://api.nuki.io/#/Opener).
	 */
	async openerAction(openerId: number, action: NukiOpenerAction): Promise<void> {
		await this.request('POST', `/smartlock/${openerId}/action`, { action });
	}

	/** Open (activate ring / open door) for opener. */
	async openerOpen(openerId: number): Promise<void> {
		await this.openerAction(openerId, NUKI_OPENER_ACTION_OPEN);
	}
}
