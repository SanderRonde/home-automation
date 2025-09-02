import { EweLinkConfig } from './components/EweLinkConfig';
import { AppLayout } from './components/layout/AppLayout';
import { SidebarTab } from './components/layout/Sidebar';
import { NotFoundPage } from './components/NotFoundPage';
import { KeyValEditor } from './components/KeyvalEditor';
import { WelcomePage } from './components/WelcomePage';
import { WLEDConfig } from './components/WLEDConfig';
import React, { useState, useEffect } from 'react';
import { Devices } from './components/Devices';
import { createRoot } from 'react-dom/client';

function ConfigApp() {
	// Get initial tab from URL hash or default to settings
	const [currentTab, setCurrentTab] = useState<string | SidebarTab>(() => {
		const hash = window.location.hash.slice(1); // Remove the # symbol
		return hash || SidebarTab.SETTINGS;
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

	const handleReturnToSettings = () => {
		setCurrentTab(SidebarTab.SETTINGS);
	};

	const renderContent = () => {
		switch (currentTab) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
			case SidebarTab.SETTINGS:
				return <WelcomePage />;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
			case SidebarTab.DEVICES:
				return <Devices />;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
			case SidebarTab.KEYVAL:
				return <KeyValEditor />;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
			case SidebarTab.EWELINK:
				return <EweLinkConfig />;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
			case SidebarTab.WLED:
				return <WLEDConfig />;
			default:
				return (
					<NotFoundPage onReturnToSettings={handleReturnToSettings} />
				);
		}
	};

	return (
		<AppLayout currentTab={currentTab} onTabChange={setCurrentTab}>
			{renderContent()}
		</AppLayout>
	);
}

const root = createRoot(document.getElementById('root')!);
root.render(
	<React.StrictMode>
		<ConfigApp />
	</React.StrictMode>
);
