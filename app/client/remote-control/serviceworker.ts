import { ServiceworkerSelf } from '../../../types/serviceworker';

declare const self: ServiceworkerSelf;

const CACHE_NAME = 'remote-control';
const CACHE_STATIC = [
	'/remote-control/favicon.ico',
	'/remote-control/manifest.json',
	'/remote-control/page.css',
	'/remote-control/page.js',
	'/remote-control/paper-ripple.min.css',
	'/remote-control/paper-ripple.min.js',
	'/remote-control/',
];

self.addEventListener('install', (event) => {
	self.skipWaiting();

	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			await Promise.all(
				[...CACHE_STATIC].map((url) => {
					return cache.add(url).catch((err) => {
						console.log('Failed to fetch', url, err);
					});
				})
			);
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

function race<T>(...promises: Promise<T | undefined>[]): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		promises.forEach((promise) => {
			promise
				.then((result) => {
					if (result !== undefined) {
						resolve(result);
					}
				})
				.catch(() => {});
		});
		if (promises.length === 0) {
			resolve();
		} else if (promises.length === 1) {
			promises[0]
				.then((result) => {
					resolve(result);
				})
				.catch(() => {
					reject(new Error('All requests failed'));
				});
		} else {
			promises
				.reduce((a, b) => a.catch(() => b))
				.catch(() => reject(new Error('All requests failed')));
		}
	});
}

async function fastest(req: Request) {
	return race(
		caches.match(req),
		fetch(req, {
			credentials: 'include',
		})
	);
}

self.addEventListener('fetch', (event) => {
	const { pathname, hostname } = new URL(event.request.url);
	if (
		hostname !== location.hostname ||
		pathname.indexOf('serviceworker.js') > -1
	) {
		event.respondWith(
			fetch(event.request, {
				credentials: 'include',
			})
		);
		return;
	}

	switch (pathname) {
		default:
			event.respondWith(fastest(event.request));
			break;
	}
});
