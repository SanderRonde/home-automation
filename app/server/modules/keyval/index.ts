import { ResDummy } from '../../lib/logging/response-logger';
import { SettablePromise } from '../../lib/settable-promise';
import { LogObj } from '../../lib/logging/lob-obj';
import groups from '../../config/keyval-groups';
import { initAggregates } from './aggregates';
import { KEYVAL_GROUP_EFFECT } from './types';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { APIHandler } from './api';

export const KeyVal = new (class KeyVal extends ModuleMeta {
	private _apiHandler: SettablePromise<APIHandler> = new SettablePromise();
	private _db: SettablePromise<Database> = new SettablePromise();
	private readonly _listeners: Map<
		number,
		{
			key: string | null;
			listener: (
				value: string,
				key: string,
				logObj: LogObj
			) => void | Promise<void>;
			once: boolean;
		}
	> = new Map();
	private _lastIndex = 0;

	public name = 'keyval';

	public init(config: ModuleConfig<KeyVal>) {
		const { db } = config;
		this._db.set(db);
		const apiHandler = new APIHandler({ db, keyval: this });
		this._apiHandler.set(apiHandler);
		initAggregates(db, this);

		initRouting(this, { ...config, apiHandler });
	}

	public addListener(
		logObj: LogObj,
		key: string | null,
		listener: (
			value: string,
			key: string,
			logObj: LogObj
		) => void | Promise<void>,
		{
			once = false,
			notifyOnInitial = false,
		}: { once?: boolean; notifyOnInitial?: boolean } = {}
	): number {
		if (notifyOnInitial && key !== null) {
			void this.get(logObj, key).then((value) => {
				return listener(value, key, logObj);
			});
		}
		const index = this._lastIndex++;
		this._listeners.set(index, {
			key,
			listener,
			once,
		});
		return index;
	}

	public removeListener(index: number): void {
		this._listeners.delete(index);
	}

	private triggerGroups(
		key: string,
		value: string,
		logObj: LogObj,
		db: Database
	): void {
		if (!(key in groups)) {
			logObj.attachMessage('No groups');
			return;
		}

		const group = groups[key];
		for (const key in group) {
			const effect = group[key];

			const newValue = (() => {
				const opposite = value === '1' ? '0' : '1';
				switch (effect) {
					case KEYVAL_GROUP_EFFECT.SAME_ALWAYS:
						return value;
					case KEYVAL_GROUP_EFFECT.INVERT_ALWAYS:
						return opposite;
					case KEYVAL_GROUP_EFFECT.SAME_ON_TRUE:
						return value === '1' ? value : undefined;
					case KEYVAL_GROUP_EFFECT.SAME_ON_FALSE:
						return value === '0' ? value : undefined;
					case KEYVAL_GROUP_EFFECT.INVERT_ON_TRUE:
						return value === '1' ? opposite : undefined;
					case KEYVAL_GROUP_EFFECT.INVERT_ON_FALSE:
						return value === '0' ? opposite : undefined;
				}
			})();

			if (newValue === undefined) {
				continue;
			}

			logObj.attachMessage(`Setting "${key}" to "${newValue}" (db only)`);
			db.setVal(key, newValue);
		}
	}

	public async update(
		key: string,
		value: string,
		logObj: LogObj,
		db: Database
	): Promise<number> {
		let updated = 0;
		const updatedKeyParts = key.split('.');

		const matchingListeners = Array.from(this._listeners).filter(
			([, { key: listenerKey }]) => {
				if (listenerKey === null) {
					return true;
				}

				const listenerParts = listenerKey.split('.');
				for (
					let i = 0;
					i < Math.min(updatedKeyParts.length, listenerParts.length);
					i++
				) {
					if (updatedKeyParts[i] !== listenerParts[i]) {
						return false;
					}
				}
				return true;
			}
		);

		for (const [index, { listener, once }] of matchingListeners) {
			await listener(value, key, logObj);
			updated++;
			if (once) {
				this._listeners.delete(index);
			}
		}

		this.triggerGroups(
			key,
			value,
			logObj.attachMessage('Triggering groups'),
			db
		);

		return updated;
	}

	public async set<KeyType extends string>(
		logObj: LogObj,
		key: KeyType,
		value: string,
		notify = true
	): Promise<boolean> {
		const api = await this._apiHandler.value;
		const resDummy = new ResDummy();
		const returned = api.set(resDummy, {
			key,
			value,
			update: notify,
			auth: (await this.modules).auth.getSecretKey(),
		});
		LogObj.fromRes(resDummy).transferTo(logObj);
		return returned;
	}

	public async get<KeyType extends string>(
		logObj: LogObj,
		key: KeyType
	): Promise<string> {
		const api = await this._apiHandler.value;
		const resDummy = new ResDummy();
		const returned = api.get(resDummy, {
			key,
			auth: (await this.modules).auth.getSecretKey(),
		});
		LogObj.fromRes(resDummy).transferTo(logObj);
		return returned;
	}

	public async toggle<KeyType extends string>(
		logObj: LogObj,
		key: KeyType
	): Promise<string> {
		const api = await this._apiHandler.value;
		const resDummy = new ResDummy();
		const returned = api.toggle(resDummy, {
			key,
			auth: (await this.modules).auth.getSecretKey(),
		});
		LogObj.fromRes(resDummy).transferTo(logObj);
		return returned;
	}

	public onChange<KeyType extends string>(
		logObj: LogObj,
		key: KeyType | null,
		callback: (
			value: string,
			key: string,
			logObj: LogObj
		) => void | Promise<void>,
		options: { once?: boolean; notifyOnInitial?: boolean } = {}
	): { remove(): void } {
		const listener = this.addListener(logObj, key, callback, options);
		return {
			remove: () => {
				this.removeListener(listener);
			},
		};
	}
})();
