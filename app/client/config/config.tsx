import { HelloWorld } from './components/hello-world';
import { createRoot } from 'react-dom/client';
import React from 'react';

async function registerServiceworker() {
	if ('serviceWorker' in navigator) {
		await navigator.serviceWorker.register('/config/serviceworker.js', {
			scope: '/config/',
			updateViaCache: 'none',
		});
	}
}

const root = createRoot(document.getElementById('root')!);
root.render(
	<React.StrictMode>
		<HelloWorld />
	</React.StrictMode>
);

void registerServiceworker();
