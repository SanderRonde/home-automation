/// <reference lib="webworker" />

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
	'/app/client/dashboard/manifest.json',
	'/dashboard/static/favicon.svg',
	'/dashboard/static/favicon.ico',
	'/dashboard/static/icons/icon-192.png',
	'/dashboard/static/icons/icon-512.png',
];

const sw = self as unknown as ServiceWorkerGlobalScope;

// Install event - cache static assets
sw.addEventListener('install', (event: ExtendableEvent) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(STATIC_CACHE);
			try {
				await cache.addAll(STATIC_ASSETS);
			} catch (error) {
				console.warn('Failed to cache some static assets:', error);
			}
			// Force the waiting service worker to become the active service worker
			await sw.skipWaiting();
		})()
	);
});

// Activate event - clean up old caches
sw.addEventListener('activate', (event: ExtendableEvent) => {
	event.waitUntil(
		(async () => {
			const cacheNames = await caches.keys();
			await Promise.all(
				cacheNames.map((cacheName) => {
					if (
						cacheName !== STATIC_CACHE &&
						cacheName !== API_CACHE &&
						(cacheName.startsWith('static-') || cacheName.startsWith('api-'))
					) {
						return caches.delete(cacheName);
					}
					return Promise.resolve();
				})
			);
			// Take control of all clients immediately
			await sw.clients.claim();
		})()
	);
});

// Fetch event - handle caching strategies
sw.addEventListener('fetch', (event: FetchEvent) => {
	const url = new URL(event.request.url);

	// Only handle same-origin requests
	if (url.origin !== location.origin) {
		return;
	}

	// Skip non-GET requests for caching
	if (event.request.method !== 'GET') {
		return;
	}

	// Static assets: Cache-first, fallback to network
	event.respondWith(
		(async () => {
			const cachedResponse = await caches.match(event.request);
			if (cachedResponse) {
				return cachedResponse;
			}

			try {
				// eslint-disable-next-line no-restricted-globals
				const response = await fetch(event.request);
				if (response.ok && url.pathname.startsWith('/static/')) {
					const cache = await caches.open(STATIC_CACHE);
					await cache.put(event.request, response.clone());
				}
				return response;
			} catch {
				return new Response('Offline', { status: 503 });
			}
		})()
	);
});
