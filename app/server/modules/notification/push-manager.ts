import type { PushSubscription, NotificationSettings } from '../../../../types/notification';
import { NotificationType } from '../../../../types/notification';
import { logTag } from '../../lib/logging/logger';
import type { Database } from '../../lib/db';
import * as webpush from 'web-push';
import { Logs } from '../logs';

export interface NotificationDB {
	subscriptions: PushSubscription[];
	settings: NotificationSettings;
	vapidKeys?: {
		publicKey: string;
		privateKey: string;
	};
}

export interface NotificationData {
	title: string;
	body: string;
	icon: string;
	badge: string;
	tag?: string;
	timestamp: number;
}

export class PushNotificationManager {
	public constructor(private readonly _db: Database<NotificationDB>) {
		this._initVapidKeys();
	}

	private _initVapidKeys(): void {
		const current = this._db.current();

		// Generate VAPID keys if they don't exist
		if (!current.vapidKeys) {
			logTag('notification', 'yellow', 'Generating VAPID keys...');
			const vapidKeys = webpush.generateVAPIDKeys();

			this._db.update((old) => ({
				...old,
				vapidKeys: {
					publicKey: vapidKeys.publicKey,
					privateKey: vapidKeys.privateKey,
				},
			}));

			logTag('notification', 'green', 'VAPID keys generated successfully');
		}

		const keys = this._db.current().vapidKeys!;
		webpush.setVapidDetails(
			'mailto:admin@homeautomation.local',
			keys.publicKey,
			keys.privateKey
		);
	}

	public getVapidPublicKey(): string {
		return this._db.current().vapidKeys!.publicKey;
	}

	public addSubscription(
		subscription: Omit<PushSubscription, 'id' | 'createdAt' | 'enabled'>
	): PushSubscription {
		const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const newSubscription: PushSubscription = {
			...subscription,
			id,
			enabled: true,
			createdAt: Date.now(),
		};

		this._db.update((old) => ({
			...old,
			subscriptions: [...(old.subscriptions || []), newSubscription],
		}));

		logTag('notification', 'green', `New push subscription registered: ${id}`);
		return newSubscription;
	}

	public updateSubscriptionName(id: string, name: string): boolean {
		const current = this._db.current();
		const index = (current.subscriptions || []).findIndex((sub) => sub.id === id);

		if (index === -1) {
			return false;
		}

		this._db.update((old) => ({
			...old,
			subscriptions: old.subscriptions?.map((sub) =>
				sub.id === id ? { ...sub, name } : sub
			),
		}));

		logTag('notification', 'cyan', `Updated subscription name: ${id} -> ${name}`);
		return true;
	}

	public removeSubscription(id: string): boolean {
		const current = this._db.current();
		const index = (current.subscriptions || []).findIndex((sub) => sub.id === id);

		if (index === -1) {
			return false;
		}

		this._db.update((old) => ({
			...old,
			subscriptions: old.subscriptions?.filter((sub) => sub.id !== id),
		}));

		logTag('notification', 'cyan', `Push subscription removed: ${id}`);
		return true;
	}

	public listSubscriptions(): PushSubscription[] {
		return this._db.current().subscriptions || [];
	}

	public updateSubscriptionEnabled(id: string, enabled: boolean): boolean {
		const current = this._db.current();
		const index = (current.subscriptions || []).findIndex((sub) => sub.id === id);

		if (index === -1) {
			return false;
		}

		this._db.update((old) => ({
			...old,
			subscriptions: old.subscriptions?.map((sub) =>
				sub.id === id ? { ...sub, enabled } : sub
			),
		}));

		return true;
	}

	public getSettings(): NotificationSettings {
		return (
			this._db.current().settings || {
				[NotificationType.DOOR_SENSOR_NO_DEVICE]: true,
			}
		);
	}

	public updateSettings(settings: Partial<NotificationSettings>): void {
		this._db.update((old) => ({
			...old,
			settings: {
				...this.getSettings(),
				...settings,
			},
		}));
	}

	public async sendDoorSensorAlert(): Promise<void> {
		const settings = this.getSettings();
		if (!settings[NotificationType.DOOR_SENSOR_NO_DEVICE]) {
			logTag('notification', 'gray', 'Door sensor alerts are disabled');
			return;
		}

		await this.sendNotification(
			'Door Sensor Triggered',
			'Door sensor was triggered but no recognized devices came home.',
			'door-sensor-alert'
		);
	}

	public async sendNotification(
		title: string,
		body: string,
		tag?: string,
		subscriptionId?: string
	): Promise<boolean> {
		const subscriptions = this.listSubscriptions().filter(
			(sub) => sub.enabled && (subscriptionId ? sub.id === subscriptionId : true)
		);

		if (subscriptions.length === 0) {
			logTag('notification', 'yellow', 'No active subscriptions to send notification to');
			return false;
		}

		const payload = JSON.stringify({
			title,
			body: body,
			icon: '/icon-192.png',
			badge: '/icon-192.png',
			tag: tag,
			timestamp: Date.now(),
		} satisfies NotificationData);

		let successCount = 0;
		let failCount = 0;

		for (const subscription of subscriptions) {
			try {
				await webpush.sendNotification(
					{
						endpoint: subscription.endpoint,
						keys: subscription.keys,
					},
					payload
				);
				successCount++;
			} catch (error) {
				failCount++;
				logTag(
					'notification',
					'red',
					`Failed to send notification to ${subscription.id}:`,
					error
				);

				// If subscription is no longer valid, remove it
				if (error && typeof error === 'object' && 'statusCode' in error) {
					const statusCode = (error as { statusCode: number }).statusCode;
					if (statusCode === 410 || statusCode === 404) {
						logTag(
							'notification',
							'yellow',
							`Removing invalid subscription: ${subscription.id}`
						);
						this.removeSubscription(subscription.id);
					}
					return false;
				}
			}
		}

		logTag(
			'notification',
			'cyan',
			`Sent notification: ${successCount} successful, ${failCount} failed`
		);

		// Log notification to activity log
		try {
			const activityLog = await Logs.activityLog.value;
			await activityLog.logNotification(title, body, successCount > 0, subscriptions.length);
		} catch (error) {
			// Don't let logging errors break notifications
			console.error('Failed to log notification:', error);
		}

		return true;
	}

	public async sendTestNotification(subscriptionId: string): Promise<boolean> {
		return this.sendNotification(
			'Test Notification',
			'This is a test notification from your home automation system.',
			undefined,
			subscriptionId
		);
	}
}
