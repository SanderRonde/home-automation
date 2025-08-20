import { KeyvalSwitches } from './components/keyval-switches';
import { createRoot } from 'react-dom/client';
import React from 'react';

async function registerServiceworker() {
	if ('serviceWorker' in navigator) {
		await navigator.serviceWorker.register('/keyval/serviceworker.js', {
			scope: '/keyval/',
			updateViaCache: 'none',
		});
	}
}

const root = createRoot(document.getElementById('root')!);
root.render(
	<React.StrictMode>
		<KeyvalSwitches />
	</React.StrictMode>
);

void registerServiceworker();