import React from 'react';

interface OfflineContextValue {
	isOnline: boolean;
}

const OfflineContext = React.createContext<OfflineContextValue>({
	isOnline: true,
});

export const useOffline = (): OfflineContextValue => {
	return React.useContext(OfflineContext);
};

interface OfflineProviderProps {
	children: React.ReactNode;
}

export const OfflineProvider = (props: OfflineProviderProps): JSX.Element => {
	const [isOnline, setIsOnline] = React.useState<boolean>(
		typeof navigator !== 'undefined' ? navigator.onLine : true
	);

	React.useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, []);

	return <OfflineContext.Provider value={{ isOnline }}>{props.children}</OfflineContext.Provider>;
};
