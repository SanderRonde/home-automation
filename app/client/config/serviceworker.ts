// Basic service worker for config module
self.addEventListener('install', (event) => {
	console.log('Config service worker installed');
});

self.addEventListener('activate', (event) => {
	console.log('Config service worker activated');
});

export {};
