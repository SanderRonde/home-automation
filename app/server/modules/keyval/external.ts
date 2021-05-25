import { KeyVal } from '.';
import { createExternalClass } from '../../lib/external';
import { LogObj } from '../../lib/logger';
import { APIHandler } from './api';
import { addListener, removeListener } from './get-set-listener';

export class ExternalHandler extends createExternalClass(true) {
	private static _apiHandler: APIHandler | null = null;

	static async init({
		apiHandler,
	}: {
		apiHandler: APIHandler;
	}): Promise<void> {
		this._apiHandler = apiHandler;
		await super.init();
	}

	async set(key: string, value: string, notify = true): Promise<boolean> {
		return this.runRequest(async (res, source) => {
			return ExternalHandler._apiHandler!.set(
				res,
				{
					key,
					value,
					update: notify,
					auth: await this._getKey(res, KeyVal),
				},
				source
			);
		});
	}

	async get(key: string): Promise<string> {
		return this.runRequest(async (res, source) => {
			return ExternalHandler._apiHandler!.get(
				res,
				{
					key,
					auth: await this._getKey(res, KeyVal),
				},
				source
			);
		});
	}

	async toggle(key: string): Promise<void> {
		const value = await this.get(key);
		const newValue = value === '1' ? '0' : '1';
		await this.set(key, newValue);
	}

	async onChange(
		key: string,
		callback: (value: string, logObj: LogObj) => void,
		options: { once?: boolean; notifyOnInitial?: boolean } = {}
	): Promise<{ remove(): void }> {
		return this.runRequest(() => {
			const listener = addListener(key, callback, options);
			return {
				remove() {
					removeListener(listener);
				},
			};
		});
	}
}
