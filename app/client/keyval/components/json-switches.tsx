import type { KeyvalConfigWithValues } from '../../../server/modules/keyval/routing';
import { Box, CircularProgress, Switch, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { isValSame } from '../lib/util';

interface JSONSwitchesProps {
	initialJson?: KeyvalConfigWithValues;
}

export const JSONSwitches: React.FC<JSONSwitchesProps> = (props) => {
	const [json, setJson] = useState<KeyvalConfigWithValues>(
		props.initialJson ?? { groups: [] }
	);
	const [loadingKeys, setLoadingKeys] = useState<string[]>([]);

	const sendValChange = async (key: string, value: string) => {
		try {
			const response = await fetch(
				`${location.origin}/keyval/${key}/${value}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
				}
			);
			if (!response.ok) {
				throw new Error('Failed to update value');
			}
			return true;
		} catch (err) {
			console.error('Failed to update value:', err);
			return false;
		}
	};

	const refreshJSON = async () => {
		try {
			const response = await fetch(`${location.origin}/keyval/all`, {
				headers: {
					'Content-Type': 'application/json',
				},
				method: 'POST',
			});
			if (!response.ok) {
				return false;
			}
			const newJson = await response.json();
			if (!isValSame(newJson, json)) {
				setJson(newJson);
			}
			return true;
		} catch (err) {
			console.error('Failed to refresh:', err);
			return false;
		}
	};

	const changeValue = async (key: string, toValue: string) => {
		setLoadingKeys((prev) => [...prev, key]);
		try {
			await sendValChange(key, toValue);
			await refreshJSON();
		} finally {
			setLoadingKeys((prev) => prev.filter((k) => k !== key));
		}
	};

	useEffect(() => {
		void refreshJSON();

		// Set up refresh interval
		const interval = setInterval(() => {
			void refreshJSON();
		}, 1000 * 60);

		return () => clearInterval(interval);
	}, []);

	const renderSwitch = (key: string, value: string) => {
		const isLoading = loadingKeys.includes(key);
		return (
			<Box sx={{ display: 'flex', alignItems: 'center' }}>
				{isLoading && <CircularProgress size={16} sx={{ mr: 1 }} />}
				<Switch
					checked={value === '1'}
					disabled={isLoading}
					onChange={(e) => {
						void changeValue(key, e.target.checked ? '1' : '0');
					}}
				/>
			</Box>
		);
	};

	const renderGroup = (config: KeyvalConfigWithValues): JSX.Element => {
		return (
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
									textTransform: 'capitalize',
									color: 'rgba(255,255,255,0.9)',
								}}
							>
								{group.name}
							</Typography>
							<Box
								sx={{
									display: 'flex',
									flexDirection: 'column',
									gap: 1.5,
								}}
							>
								{group.items.map((item) => {
									const isChecked = item.value ? '1' : '0';
									return (
										<Box
											key={item.name}
											onClick={() => {
												void changeValue(
													item.name,
													isChecked === '1'
														? '0'
														: '1'
												);
											}}
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
													transform:
														'translateX(4px)',
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
											{renderSwitch(item.name, isChecked)}
										</Box>
									);
								})}
							</Box>
						</Box>
					))
				) : (
					<Typography color="text.primary">No groups</Typography>
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
			{renderGroup(json)}
		</Box>
	);
};
