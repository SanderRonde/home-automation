import { Box, CircularProgress, Switch, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';

interface KeyvalItem {
	name: string;
	icon?: string;
	deviceIds: string[];
	value?: boolean; // Will be fetched from device
}

interface KeyvalGroup {
	name: string;
	icon?: string;
	items: KeyvalItem[];
}

interface KeyvalConfig {
	groups: KeyvalGroup[];
}

interface KeyvalSwitchesProps {
	initialConfig?: KeyvalConfig;
}

export const KeyvalSwitches: React.FC<KeyvalSwitchesProps> = (props) => {
	const [config, setConfig] = useState<KeyvalConfig>(
		props.initialConfig ?? { groups: [] }
	);
	const [loadingItems, setLoadingItems] = useState<string[]>([]);

	const toggleDevice = async (deviceIds: string[]) => {
		const itemKey = deviceIds.join(',');
		setLoadingItems((prev) => [...prev, itemKey]);
		try {
			const response = await fetch('/keyval/device/toggle', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ deviceIds }),
			});
			if (response.ok) {
				await refreshConfig();
			}
		} catch (err) {
			console.error('Failed to toggle device:', err);
		} finally {
			setLoadingItems((prev) => prev.filter((id) => id !== itemKey));
		}
	};

	const refreshConfig = async () => {
		try {
			const response = await fetch('/keyval/config', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			});
			if (response.ok) {
				const newConfig = await response.json();
				setConfig(newConfig);
			}
		} catch (err) {
			console.error('Failed to refresh config:', err);
		}
	};

	useEffect(() => {
		void refreshConfig();

		// Set up refresh interval
		const interval = setInterval(() => {
			void refreshConfig();
		}, 1000 * 10); // Refresh every 10 seconds

		return () => clearInterval(interval);
	}, []);

	const renderSwitch = (item: KeyvalItem) => {
		const itemKey = item.deviceIds.join(',');
		const isLoading = loadingItems.includes(itemKey);
		return (
			<Box sx={{ display: 'flex', alignItems: 'center' }}>
				{isLoading && <CircularProgress size={16} sx={{ mr: 1 }} />}
				<Switch
					checked={item.value ?? false}
					disabled={isLoading}
					onChange={() => toggleDevice(item.deviceIds)}
				/>
			</Box>
		);
	};

	return (
		<Box
			sx={{
				p: 2.5,
				color: 'text.primary',
				maxWidth: '1200px',
				mx: 'auto',
				bgcolor: '#000000',
			}}
		>
			<Box
				sx={{
					display: 'flex',
					flexWrap: 'wrap',
					gap: 2.5,
					p: 1.25,
				}}
			>
				{config.groups.length ? (
					config.groups.map((group) => (
						<Box
							key={group.name}
							sx={{
								flex: '1 1 300px',
								bgcolor: '#121212',
								borderRadius: 2,
								p: 2.5,
								boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
							}}
						>
							<Typography
								variant="h6"
								sx={{
									mb: 2.5,
									pb: 1.5,
									borderBottom:
										'1px solid rgba(255,255,255,0.1)',
									fontWeight: 600,
									letterSpacing: 0.5,
									color: 'rgba(255,255,255,0.9)',
								}}
							>
								{group.icon} {group.name}
							</Typography>
							<Box
								sx={{
									display: 'flex',
									flexDirection: 'column',
									gap: 1.5,
								}}
							>
								{group.items.map((item) => (
									<Box
										key={item.deviceIds.join(',')}
										onClick={() =>
											toggleDevice(item.deviceIds)
										}
										sx={{
											display: 'flex',
											alignItems: 'center',
											bgcolor: '#1a1a1a',
											p: '12px 16px',
											borderRadius: 1,
											transition: 'all 0.2s ease',
											cursor: 'pointer',
											'&:hover': {
												bgcolor: '#222222',
												transform: 'translateX(4px)',
											},
										}}
									>
										<Typography
											sx={{
												mr: 2,
												flex: 1,
												whiteSpace: 'nowrap',
												fontSize: '1.1rem',
												fontWeight: 500,
												color: 'rgba(255,255,255,0.87)',
											}}
										>
											{item.icon} {item.name}
										</Typography>
										{renderSwitch(item)}
									</Box>
								))}
							</Box>
						</Box>
					))
				) : (
					<Typography color="text.secondary">
						No groups configured
					</Typography>
				)}
			</Box>
		</Box>
	);
};
