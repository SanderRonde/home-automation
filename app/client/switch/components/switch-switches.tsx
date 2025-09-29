import type {
	SwitchConfigWithValues,
	SwitchItemWithValue,
} from '../../../server/modules/switch/routing';
import {
	Box,
	CircularProgress,
	Switch,
	Tooltip,
	Typography,
} from '@mui/material';
import useWebsocket from '../../shared/lib/resilient-socket';
import WarningIcon from '@mui/icons-material/Warning';
import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

interface SwitchSwitchesProps {
	initialConfig?: SwitchConfigWithValues;
}

export const SwitchSwitches: React.FC<SwitchSwitchesProps> = (props) => {
	const [config, setConfig] = useState<SwitchConfigWithValues>(
		props.initialConfig ?? { groups: [] }
	);
	const [loadingItems, setLoadingItems] = useState<string[]>([]);

	const toggleDevice = async (deviceIds: string[]) => {
		const itemKey = deviceIds.join(',');
		setLoadingItems((prev) => [...prev, itemKey]);
		try {
			const response = await apiPost(
				'switch',
				'/device/toggle',
				{},
				{
					deviceIds,
				}
			);
			if (response.ok) {
				await refreshConfig();
			}
		} catch (err) {
			console.error('Failed to toggle device:', err);
		} finally {
			setLoadingItems((prev) => prev.filter((id) => id !== itemKey));
		}
	};

	const onWsMessage = React.useCallback((message: SwitchConfigWithValues) => {
		setConfig(message);
	}, []);
	useWebsocket<never, SwitchConfigWithValues>('/switch/ws', {
		onMessage: onWsMessage,
	});

	const refreshConfig = async () => {
		try {
			const response = await apiGet('switch', '/config', {});
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
	}, []);

	const renderSwitch = (item: SwitchItemWithValue) => {
		const itemKey = item.deviceIds.join(',');
		const isLoading = loadingItems.includes(itemKey);
		return (
			<Box sx={{ display: 'flex', alignItems: 'center' }}>
				{isLoading && <CircularProgress size={16} sx={{ mr: 1 }} />}
				{item.value === null ? (
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							bgcolor: 'rgba(255, 193, 7, 0.12)',
							px: 1,
							py: 0.5,
							borderRadius: 1,
						}}
					>
						<Tooltip title="Value is unavailable">
							<Box sx={{ display: 'flex', alignItems: 'center' }}>
								<WarningIcon
									fontSize="small"
									sx={{ color: 'warning.main', mr: 0.5 }}
								/>
								<Typography
									variant="body2"
									sx={{ color: 'warning.main' }}
								>
									Unavailable
								</Typography>
							</Box>
						</Tooltip>
					</Box>
				) : (
					<Switch checked={item.value} disabled={isLoading} />
				)}
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
