export enum NotificationType {
	DOOR_SENSOR_NO_DEVICE = 'door_sensor_no_device',
}

export interface PushSubscription {
	id: string;
	endpoint: string;
	keys: {
		p256dh: string;
		auth: string;
	};
	enabled: boolean;
	createdAt: number;
	userAgent?: string;
}

export interface NotificationSettings {
	[NotificationType.DOOR_SENSOR_NO_DEVICE]: boolean;
}
