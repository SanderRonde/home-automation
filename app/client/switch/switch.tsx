import { SwitchSwitches } from './components/switch-switches';
import React from 'react';
import { createRoot } from 'react-dom/client';

async function registerServiceworker() {
	if ('serviceWorker' in navigator) {
		await navigator.serviceWorker.register('/switch/serviceworker.js', {
			scope: '/switch/',
		});
	}
}

void registerServiceworker();

const root = createRoot(document.getElementById('root')!);
root.render(
	<React.StrictMode>
		<SwitchSwitches />
	</React.StrictMode>
);
