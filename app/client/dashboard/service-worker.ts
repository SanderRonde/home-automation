/// <reference lib="webworker" />

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

// No fetch handler is registered: all requests go straight to the network.
