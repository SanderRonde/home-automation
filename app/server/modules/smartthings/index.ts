import { SmartApp, SmartAppContext } from '@smartthings/smartapp';
import { Device, DeviceSource } from '../device/device';
import { getSmartThingsDevice } from './client/device';
import { logTag } from '../../lib/logging/logger';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { Data } from '../../lib/data';
import { ModuleMeta } from '../meta';

/** Stored context for the single linked SmartThings installation (SDK writes on INSTALL/UPDATE). */
export interface StoredContext {
	installedAppId: string;
	locationId: string;
	config?: Record<string, unknown>;
	locale?: string;
	authToken?: string;
	refreshToken?: string;
}

export interface SmartThingsDB {
	clientId?: string;
	clientSecret?: string;
	/** Single linked installation; only one SmartThings instance is ever linked. */
	installation?: StoredContext | null;
}

/** Context store adapter for the SDK: single installation stored in DB. */
function createContextStore(db: Database<SmartThingsDB>) {
	const store = {
		async get(installedAppId: string): Promise<StoredContext | undefined> {
			const inst = db.current().installation;
			if (!inst) {
				return undefined;
			}
			if (inst.installedAppId !== installedAppId) {
				return undefined;
			}
			return inst;
		},
		async put(record: StoredContext): Promise<void> {
			db.update((d) => ({ ...d, installation: record }));
		},
		async update(installedAppId: string, authData: Partial<StoredContext>): Promise<void> {
			db.update((d) => {
				const inst = d.installation;
				if (!inst || inst.installedAppId !== installedAppId) {
					return d;
				}
				return { ...d, installation: { ...inst, ...authData } };
			});
		},
		async delete(installedAppId: string): Promise<void> {
			db.update((d) => {
				if (d.installation?.installedAppId !== installedAppId) {
					return d;
				}
				return { ...d, installation: null };
			});
		},
	};
	// SDK types expect get() to return ContextRecord (no undefined) and only get/put; cast to satisfy.
	return store as unknown as import('@smartthings/smartapp').ContextStore;
}

/** Creates a configured SmartApp instance when credentials exist in DB. */
function createSmartApp(
	db: Database<SmartThingsDB>,
	contextStore: ReturnType<typeof createContextStore>,
	updateDevices: (devices: DevicesEndpoint, ctx: SmartAppContext) => Promise<void>
): InstanceType<typeof SmartApp> | null {
	const { clientId, clientSecret } = db.current();
	if (!clientId || !clientSecret) {
		return null;
	}

	const smartapp = new SmartApp({ clientId, clientSecret })
		.contextStore(contextStore)
		.page('mainPage', (_context, page) => {
			page.name('Home Automation');
			page.section('devices', (section) => {
				section.name('Devices');
				section
					.deviceSetting('smartFridges')
					.name('Smart fridges')
					.description('Tap to set')
					.permissions('rx')
					.multiple(true)
					.capability('custom.fridgeMode');
				section
					.deviceSetting('washers')
					.name('Washers')
					.description('Tap to set')
					.permissions('rx')
					.multiple(true)
					.capability('custom.dryerDryLevel');
			});
		})
		.updated(async (context) => {
			// After SDK persists config/tokens, fetch and log device list
			try {
				logTag('smartthings', 'green', 'Updating devices');
				const devices = await context.api.devices.list({ includeStatus: true });
				await updateDevices(devices, context);
			} catch (err) {
				logTag('smartthings', 'red', 'Failed to list devices:', err);
			}
		})
		.uninstalled(() => {
			logTag('smartthings', 'yellow', 'SmartThings app uninstalled');
		});

	return smartapp;
}

type DevicesEndpoint = Awaited<
	ReturnType<
		Awaited<ReturnType<InstanceType<typeof SmartApp>['withContext']>>['api']['devices']['list']
	>
>;

export const SmartThings = new (class SmartThings extends ModuleMeta {
	public name = 'smartthings';

	private _devices: Data<Record<string, Device>> = new Data({});

	private async _updateDevices(
		deviceList: DevicesEndpoint,
		config: ModuleConfig,
		ctx: SmartAppContext
	) {
		const newDevices: Record<string, Device> = {
			...this._devices.current(),
		};
		for (const device of deviceList) {
			const smartThingsDevice = getSmartThingsDevice(device, ctx);
			if (smartThingsDevice) {
				newDevices[smartThingsDevice.getUniqueId()] = smartThingsDevice;
			}
		}
		this._devices.set(newDevices);
		(await config.modules.device.api.value).setDevices(
			Object.values(newDevices),
			DeviceSource.SMARTTHINGS
		);
	}

	public init(config: ModuleConfig) {
		const db = config.db as Database<SmartThingsDB>;
		const contextStore = createContextStore(db);

		// Log devices on init when already linked
		const inst = db.current().installation;
		if (inst?.installedAppId && db.current().clientId && db.current().clientSecret) {
			const smartapp = createSmartApp(db, contextStore, (devices, ctx) =>
				this._updateDevices(devices, config, ctx)
			);
			if (smartapp) {
				void smartapp.withContext(inst.installedAppId).then((ctx) => {
					ctx.api.devices
						.list({ includeStatus: true })
						.then((devices) => {
							logTag('smartthings', 'green', 'Got devices');
							this._updateDevices(devices, config, ctx);
						})
						.catch((err) => {
							logTag('smartthings', 'red', 'Failed to list devices on init:', err);
						});
				});
			}
		}

		logTag('smartthings', 'green', 'SmartThings module initialized');

		return {
			serve: initRouting(config, db, contextStore, createSmartApp),
		};
	}
})();

export { createContextStore, createSmartApp };
