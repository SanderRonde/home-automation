import { JSONSwitches } from './components/json-switches';
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
		<JSONSwitches
			initialJson={JSON.parse(
				document.getElementById('root')!.getAttribute('json')!
			)}
		/>
	</React.StrictMode>
);

void registerServiceworker();
