/// <reference lib="webworker" />

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
	'/',
	'/manifest.json',
	'/static/favicon.ico',
	'/static/icons/icon-192.png',
	'/static/icons/icon-512.png',
];

// API endpoints to cache for offline access (Home page essentials)
const CACHEABLE_API_ENDPOINTS = ['/device/list', '/device/scenes/list', '/device/palettes/list'];

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

	// Check if this is a cacheable API endpoint
	const isCacheableAPI = CACHEABLE_API_ENDPOINTS.some((endpoint) =>
		url.pathname.startsWith(endpoint)
	);

	if (isCacheableAPI) {
		// API: Network-first, fallback to cache
		event.respondWith(
			(async () => {
				try {
					// eslint-disable-next-line no-restricted-globals
					const response = await fetch(event.request);
					if (response.ok) {
						const cache = await caches.open(API_CACHE);
						await cache.put(event.request, response.clone());
					}
					return response;
				} catch (error) {
					// Network failed, try cache
					const cachedResponse = await caches.match(event.request);
					if (cachedResponse) {
						return cachedResponse;
					}
					// Return a basic error response
					return new Response(JSON.stringify({ error: 'Offline' }), {
						status: 503,
						headers: { 'Content-Type': 'application/json' },
					});
				}
			})()
		);
	} else {
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
				} catch (error) {
					return new Response('Offline', { status: 503 });
				}
			})()
		);
	}
});
