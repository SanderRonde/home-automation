import { AppLayout } from './components/layout/AppLayout';
import { KeyValEditor } from './components/KeyvalEditor';
import { WelcomePage } from './components/WelcomePage';
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';


function ConfigApp() {
	// Get initial tab from URL hash or default to settings
	const [currentTab, setCurrentTab] = useState(() => {
		const hash = window.location.hash.slice(1); // Remove the # symbol
		return hash || 'settings';
	});

	// Update URL when tab changes
	useEffect(() => {
		window.location.hash = currentTab;
	}, [currentTab]);

	// Listen for URL changes (back/forward navigation)
	useEffect(() => {
		const handleHashChange = () => {
			const hash = window.location.hash.slice(1);
			if (hash) {
				setCurrentTab(hash);
			}
		};

		window.addEventListener('hashchange', handleHashChange);
		return () => window.removeEventListener('hashchange', handleHashChange);
	}, []);

	return (
		<AppLayout currentTab={currentTab} onTabChange={setCurrentTab}>
			{currentTab === 'settings' ? <WelcomePage /> : <KeyValEditor />}
		</AppLayout>
	);
}

const root = createRoot(document.getElementById('root')!);
root.render(
	<React.StrictMode>
		<ConfigApp />
	</React.StrictMode>
);
