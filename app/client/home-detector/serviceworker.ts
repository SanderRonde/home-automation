import { ServiceworkerSelf } from '../../../types/serviceworker';

declare const self: ServiceworkerSelf;

const CACHE_NAME = 'home-detector';
const CACHE_STATIC = [
	'/home-detector/components/home-detector-display/home-detector-display.js',
	'/home-detector/components/home-detector-display/home-detector-display.html.js',
	'/home-detector/components/home-detector-display/home-detector-display.css.js',
	
	'/shared/server-comm/server-comm.js',
	'/home-detector/favicon.ico',
	'/home-detector/home-detector.js'
];

self.addEventListener('install', (event) => {
	self.skipWaiting();

	event.waitUntil((async () => {
		const cache = await caches.open(CACHE_NAME);
		await Promise.all([
			...CACHE_STATIC
		].map((url) => {
			return cache.add(url).catch((err) => {
				console.log('Failed to fetch', url, err);
			});
		}));
	})());
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

function indexPage() {
	return new Response(`
		<!DOCTYPE HTML>
		<html style="background-color: rgb(40, 40, 40);">
		<head>
			<link rel="icon" href="/home-detector/favicon.ico" type="image/x-icon" />
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<title>Who is home</title>
		</head>
		<body style="margin: 0">
			<home-detector-display></home-detector-display>
			<script type="module" src="/home-detector/home-detector.js"></script>
		</body>
	</html>`, {
		headers: {
			'Content-Type': 'text/html'
		},
		status: 200
	});
}

function race<T>(...promises: Promise<T|undefined>[]): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		promises.forEach((promise) => {
			promise.then((result) => {
				if (result !== undefined) {
					resolve(result);
				}
			}).catch(() => {});
		});
		if (promises.length === 0) {
			resolve();
		} else if (promises.length === 1) {
			promises[0].then((result) => {
				resolve(result);
			}).catch(() => {
				reject(new Error('All requests failed'));
			});
		} else {
			promises.reduce((a, b) => a.catch(() => b))
				.catch(() => reject(new Error('All requests failed')));
		}
	});
}

async function fastest(req: Request) {
	return race(caches.match(req), fetch(req, {
		credentials: 'include'
	}));
}

self.addEventListener('fetch', (event) => {
	const { pathname, hostname } = new URL(event.request.url);
	if (hostname !== location.hostname || pathname.indexOf('serviceworker.js') > -1) {
		event.respondWith(fetch(event.request, {
			credentials: 'include'
		}));
		return;
	}

	switch (pathname) {
		case '/home-detector':
		case '/home-detector/':
		case '/whoishome':
		case '/whoishome/':
		case '/whoshome':
		case '/whoshome/':
			event.respondWith(indexPage());
			break;
		default:
			event.respondWith(fastest(event.request));
			break;
	}
});