import type { ServiceworkerSelf } from '../../../types/serviceworker';

declare const self: ServiceworkerSelf;

const CACHE_NAME = 'switch';
const CACHE_STATIC = [
	'/switch/favicon.ico',
	'/switch/switch.js',
	'/switch/static/manifest.json',
	'/switch/static/images/48.png',
	'/switch/static/images/72.png',
	'/switch/static/images/96.png',
	'/switch/static/images/128.png',
	'/switch/static/images/144.png',
	'/switch/static/images/168.png',
	'/switch/static/images/192.png',
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

function indexPage() {
	return new Response(
		`
		<!DOCTYPE HTML>
		<html style="background-color: #000;">
		<head>
			<link rel="icon" href="/switch/favicon.ico" type="image/x-icon" />
			<link rel="manifest" href="/switch/static/manifest.json">
			<link rel="apple-touch-icon" href="/switch/static/apple-touch-icon.png">
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<link rel="stylesheet" href="/switch/antd.dark.css" />
			<title>Switch Control</title>
		</head>
		<body style="margin: 0;overflow-x: hidden;">
			<div id="root">Javascript should be enabled</div>
			<script type="module" src="/switch/switch.js"></script>
		</body>
	</html>`,
		{
			headers: {
				'Content-Type': 'text/html',
			},
			status: 200,
		}
	);
}

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
			resolve(void 0 as unknown as T);
		} else if (promises.length === 1) {
			promises[0]
				.then((result) => {
					resolve(result as T);
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
		case '/switch':
		case '/switch/':
			event.respondWith(indexPage());
			break;
		default:
			event.respondWith(fastest(event.request));
			break;
	}
});
