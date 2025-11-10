/// <reference lib="webworker" />

import type { NotificationData } from '../../server/modules/notification/push-manager';

// Minimal service worker: no caching, just install and activate to enable PWA.
const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', (event: ExtendableEvent) => {
	// Immediately activate the new service worker
	event.waitUntil(sw.skipWaiting());
});

sw.addEventListener('activate', (event: ExtendableEvent) => {
	// Take control of uncontrolled clients once activated
	event.waitUntil(sw.clients.claim());
});

// Handle push notifications
sw.addEventListener('push', (event: PushEvent) => {
	const data = event.data;
	if (!data) {
		return;
	}

	const [title, options] = (() => {
		try {
			const json = data.json() as NotificationData;
			return [
				json.title,
				{
					body: json.body,
					icon: json.icon || '/icon-192.png',
					badge: json.badge || '/icon-192.png',
					tag: json.tag,
				} satisfies NotificationOptions,
			];
		} catch {
			return [
				'Notification',
				{
					body: data.text(),
					icon: '/icon-192.png',
					badge: '/icon-192.png',
				} satisfies NotificationOptions,
			];
		}
	})();

	return event.waitUntil(sw.registration.showNotification(title, options));
});

// Handle notification clicks
sw.addEventListener('notificationclick', (event: NotificationEvent) => {
	event.notification.close();

	// Navigate to the app when notification is clicked
	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			// If a window is already open, focus it
			for (const client of clientList) {
				if ('focus' in client) {
					return client.focus();
				}
			}
			// Otherwise open a new window
			if (sw.clients.openWindow) {
				return sw.clients.openWindow('/');
			}
			return Promise.resolve(null);
		})
	);
});

// No fetch handler is registered: all requests go straight to the network.
