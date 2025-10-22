import { LEDSourcesConfig } from './components/LEDSourcesConfig';
import { EweLinkConfig } from './components/EweLinkConfig';
import { AppLayout } from './components/layout/AppLayout';
import { SidebarTab } from './components/layout/Sidebar';
import { NotFoundPage } from './components/NotFoundPage';
import { WelcomePage } from './components/WelcomePage';
import { TuyaConfig } from './components/TuyaConfig';
import { MCPConfig } from './components/MCPConfig';
import React, { useState, useEffect } from 'react';
import { Palettes } from './components/Palettes';
import { Devices } from './components/Devices';
import { createRoot } from 'react-dom/client';
import { Scenes } from './components/Scenes';
import { Groups } from './components/Groups';
import { Home } from './components/Home';

function DashboardApp() {
	// Get initial tab from URL hash or default to home
	const [currentTab, setCurrentTab] = useState<string | SidebarTab>(() => {
		const hash = window.location.hash.slice(1); // Remove the # symbol
		return hash || SidebarTab.HOME;
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
			case SidebarTab.HOME:
				return <Home />;
			case SidebarTab.SCENES:
				return <Scenes />;
			case SidebarTab.GROUPS:
				return <Groups />;
			case SidebarTab.PALETTES:
				return <Palettes />;
			case SidebarTab.SETTINGS:
				return <WelcomePage />;
			case SidebarTab.DEVICES:
				return <Devices />;
			case SidebarTab.EWELINK:
				return <EweLinkConfig />;
			case SidebarTab.TUYA:
				return <TuyaConfig />;
			case SidebarTab.LED_SOURCES:
				return <LEDSourcesConfig />;
			case SidebarTab.MCP:
				return <MCPConfig />;
			default:
				return <NotFoundPage onReturnToSettings={handleReturnToSettings} />;
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
		<DashboardApp />
	</React.StrictMode>
);
