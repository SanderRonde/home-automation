import { LEDSourcesConfig } from './components/LEDSourcesConfig';
import { WakelightConfig } from './components/WakelightConfig';
import { Notifications } from './components/Notifications';
import { EweLinkConfig } from './components/EweLinkConfig';
import { AppLayout } from './components/layout/AppLayout';
import { SidebarTab } from './components/layout/Sidebar';
import { NotFoundPage } from './components/NotFoundPage';
import { HomeDetector } from './components/HomeDetector';
import { OfflineProvider } from '../lib/offline-context';
import React, { useState, useEffect } from 'react';
import { Webhooks } from './components/Webhooks';
import { Palettes } from './components/Palettes';
import { AIConfig } from './components/AIConfig';
import { Devices } from './components/Devices';
import { createRoot } from 'react-dom/client';
import { Scenes } from './components/Scenes';
import { Groups } from './components/Groups';
import { Home } from './components/Home';
import { apiGet } from '../lib/fetch';

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/service-worker.js').catch((error) => {
			console.error('Service Worker registration failed:', error);
		});
	});
}

function DashboardApp() {
	const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

	// Check authentication on mount
	useEffect(() => {
		const checkAuthentication = async () => {
			try {
				const response = await apiGet('auth', '/me', {});
				if (response.ok) {
					setIsAuthenticated(true);
				} else {
					setIsAuthenticated(false);
					// Redirect to login page with current URL as redirect target
					const currentPath = window.location.pathname + window.location.hash;
					window.location.href = `/auth/login-page?redirect=${encodeURIComponent(currentPath)}`;
				}
			} catch (error) {
				console.error('Authentication check failed:', error);
				setIsAuthenticated(false);
				window.location.href = `/auth/login-page?redirect=${encodeURIComponent(window.location.pathname + window.location.hash)}`;
			}
		};

		void checkAuthentication();
	}, []);

	// Get initial tab from URL hash or default to home
	const [currentTab, setCurrentTab] = useState<string | SidebarTab>(() => {
		const hash = window.location.hash.slice(1); // Remove the # symbol
		// Extract only the base tab name (before any query parameters)
		const baseTab = hash.split('?')[0];
		return baseTab || SidebarTab.HOME;
	});

	// Update URL when tab changes
	useEffect(() => {
		// Preserve query parameters if staying on the same tab
		const currentHash = window.location.hash.slice(1);
		const currentBaseTab = currentHash.split('?')[0];

		// Only update if the base tab has changed
		if (currentBaseTab !== currentTab) {
			window.location.hash = currentTab;
		}
	}, [currentTab]);

	// Listen for URL changes (back/forward navigation)
	useEffect(() => {
		const handleHashChange = () => {
			const hash = window.location.hash.slice(1);
			// Extract only the base tab name (before any query parameters)
			const baseTab = hash.split('?')[0];
			if (baseTab && baseTab !== currentTab) {
				setCurrentTab(baseTab);
			}
		};

		window.addEventListener('hashchange', handleHashChange);
		return () => window.removeEventListener('hashchange', handleHashChange);
	}, [currentTab]);

	// Don't render anything while checking authentication
	if (isAuthenticated === null) {
		return null;
	}

	// If not authenticated, the useEffect will redirect
	if (!isAuthenticated) {
		return null;
	}

	const handleReturnToSettings = () => {
		setCurrentTab(SidebarTab.HOME);
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
			case SidebarTab.WEBHOOKS:
				return <Webhooks />;
			case SidebarTab.HOME_DETECTOR:
				return <HomeDetector />;
			case SidebarTab.WAKELIGHT:
				return <WakelightConfig />;
			case SidebarTab.NOTIFICATIONS:
				return <Notifications />;
			case SidebarTab.DEVICES:
				return <Devices />;
			case SidebarTab.EWELINK:
				return <EweLinkConfig />;
			case SidebarTab.LED_SOURCES:
				return <LEDSourcesConfig />;
			case SidebarTab.AI:
				return <AIConfig />;
			default:
				return <NotFoundPage onReturnToSettings={handleReturnToSettings} />;
		}
	};

	return (
		<OfflineProvider>
			<AppLayout currentTab={currentTab} onTabChange={setCurrentTab}>
				{renderContent()}
			</AppLayout>
		</OfflineProvider>
	);
}

const root = createRoot(document.getElementById('root')!);
root.render(<DashboardApp />);
