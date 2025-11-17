import { SettablePromise } from '../../lib/settable-promise';
import { PushNotificationManager } from './push-manager';
import type { NotificationDB } from './push-manager';
import { Database } from '../../lib/db';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';

export const Notification = new (class Notification extends ModuleMeta {
	private readonly _pushManager = new SettablePromise<PushNotificationManager>();

	public name = 'notification';

	public init() {
		const db = new Database<NotificationDB>('notifications.json');

		// Initialize with defaults if needed
		if (!db.current().subscriptions) {
			db.update((old) => ({
				...old,
				subscriptions: [],
				settings: {
					door_sensor_no_device: true,
				},
			}));
		}

		const pushManager = new PushNotificationManager(db);
		this._pushManager.set(pushManager);

		return {
			serve: initRouting(pushManager),
		};
	}

	public async getPushManager(): Promise<PushNotificationManager> {
		return await this._pushManager.value;
	}

	public async sendNotification(title: string, body: string): Promise<void> {
		const pushManager = await this.getPushManager();
		await pushManager.sendNotification(title, body);
	}
})();
