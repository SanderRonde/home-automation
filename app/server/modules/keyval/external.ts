import { addListener, removeListener } from './get-set-listener';
import { createExternalClass } from '../../lib/external';
import { LogObj } from '../../lib/logger';
import { APIHandler } from './api';
import { KeyVal } from '.';

export class ExternalHandler extends createExternalClass(true) {
	private static _apiHandler: APIHandler | null = null;

	public static async init({
		apiHandler,
	}: {
		apiHandler: APIHandler;
	}): Promise<void> {
		this._apiHandler = apiHandler;
		await super.init();
	}

	public async set(
		key: string,
		value: string,
		notify = true
	): Promise<boolean> {
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

	public async get(key: string): Promise<string> {
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

	public async toggle(key: string): Promise<string> {
		return this.runRequest(async (res, source) => {
			return ExternalHandler._apiHandler!.toggle(
				res,
				{
					key,
					auth: await this._getKey(res, KeyVal),
				},
				source
			);
		});
	}

	public async onChange(
		key: string | null,
		callback: (
			value: string,
			key: string,
			logObj: LogObj
		) => void | Promise<void>,
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
