import {
	TrendingUp as TrendingUpIcon,
	TrendingDown as TrendingDownIcon,
	Remove as RemoveIcon,
	BoltRounded as BoltRoundedIcon,
	Settings as SettingsIcon,
} from '@mui/icons-material';
import {
	Box,
	Card,
	CardContent,
	Typography,
	CircularProgress,
	Grid,
	Button,
	TextField,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Chip,
} from '@mui/material';
import { staggerContainer, staggerItem } from '../../lib/animations';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import { motion } from 'framer-motion';

interface HomeWizardConfig {
	ip: string | null;
	hasToken: boolean;
}

interface Device {
	uniqueId: string;
	name: string;
	flatAllClusters?: Array<{
		name: string;
		activePower?: number;
	}>;
}

interface Instructions {
	instructions: string[];
	apiDocs: string;
}

export const EnergyUsage = (): JSX.Element => {
	const [loading, setLoading] = useState(true);
	const [config, setConfig] = useState<HomeWizardConfig | null>(null);
	const [currentPower, setCurrentPower] = useState<number | null>(null);
	const [totalEnergy, setTotalEnergy] = useState<number | null>(null);
	const [configDialogOpen, setConfigDialogOpen] = useState(false);
	const [ip, setIp] = useState('');
	const [instructions, setInstructions] = useState<Instructions | null>(null);

	const loadEnergyData = React.useCallback(async () => {
		try {
			setLoading(true);

			// Fetch HomeWizard config
			const configResponse = await apiGet('homewizard', '/config', {});
			if (configResponse.ok) {
				const configData = (await configResponse.json()) as HomeWizardConfig;
				setConfig(configData);

				// Fetch devices to get energy data
				const devicesResponse = await apiGet('device', '/listWithValues', {});
				if (devicesResponse.ok) {
					const devicesData = (await devicesResponse.json()) as { devices: Device[] };
					
					// Find HomeWizard device
					const homeWizardDevice = devicesData.devices?.find((d) =>
						d.uniqueId.startsWith('homewizard-')
					);

					if (homeWizardDevice) {
						// Get power measurement
						const powerCluster = homeWizardDevice.flatAllClusters?.find(
							(c) => c.name === 'ElectricalPowerMeasurement'
						);
						if (powerCluster?.activePower !== undefined) {
							setCurrentPower(powerCluster.activePower);
						}

						// Get energy measurement from device API
						const energyResponse = await apiGet(
							'device',
							'/device/:uniqueId/cluster/ElectricalEnergyMeasurement',
							{ uniqueId: homeWizardDevice.uniqueId }
						);
						if (energyResponse.ok) {
							const energyData = (await energyResponse.json()) as {
								totalEnergy?: string;
							};
							if (energyData.totalEnergy) {
								// Convert Wh to kWh
								setTotalEnergy(Number(energyData.totalEnergy) / 1000);
							}
						}
					}
				}
			}

			// Fetch instructions
			const instructionsResponse = await apiGet('homewizard', '/instructions', {});
			if (instructionsResponse.ok) {
				const instructionsData = (await instructionsResponse.json()) as Instructions;
				setInstructions(instructionsData);
			}
		} catch (error) {
			console.error('Failed to load energy data:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadEnergyData();

		// Refresh every 15 seconds
		const interval = setInterval(() => {
			void loadEnergyData();
		}, 15000);

		return () => clearInterval(interval);
	}, [loadEnergyData]);

	const handleSaveConfig = async () => {
		try {
			const response = await apiPost('homewizard', '/config', { ip: ip || undefined });
			if (response.ok) {
				setConfigDialogOpen(false);
				await loadEnergyData();
			} else {
				console.error('Failed to save config');
			}
		} catch (error) {
			console.error('Failed to save config:', error);
		}
	};

	if (loading) {
		return (
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '100%',
					p: 3,
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
				{/* Header */}
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						flexWrap: 'wrap',
						gap: 2,
					}}
				>
					<Typography variant="h5">Energy Usage</Typography>
					<Button
						variant="outlined"
						startIcon={<SettingsIcon />}
						onClick={() => {
							setIp(config?.ip || '');
							setConfigDialogOpen(true);
						}}
					>
						Configure
					</Button>
				</Box>

				{/* Description */}
				<Typography variant="body2" color="text.secondary">
					Monitor real-time energy usage from your HomeWizard Energy device.
				</Typography>

				{/* Energy Display */}
				{!config?.ip ? (
					<Card>
						<CardContent
							sx={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								py: 6,
								gap: 2,
							}}
						>
							<BoltRoundedIcon
								sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }}
							/>
							<Typography variant="h6" color="text.secondary">
								HomeWizard not configured
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Configure your HomeWizard Energy device to monitor energy usage.
							</Typography>
							<Button
								variant="contained"
								startIcon={<SettingsIcon />}
								onClick={() => setConfigDialogOpen(true)}
								sx={{ mt: 2 }}
							>
								Configure Now
							</Button>
						</CardContent>
					</Card>
				) : (
					<motion.div variants={staggerContainer} initial="initial" animate="animate">
						<Grid container spacing={3}>
							{/* Current Power */}
							<Grid size={{ xs: 12, md: 6 }}>
								<motion.div variants={staggerItem}>
									<Card
										sx={{
											borderRadius: 3,
											boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
											background:
												'linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, rgba(252, 211, 77, 0.05) 100%)',
											border: '1px solid rgba(251, 191, 36, 0.1)',
											height: '100%',
											display: 'flex',
											flexDirection: 'column',
										}}
									>
										<CardContent sx={{ flexGrow: 1 }}>
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'flex-start',
													mb: 2,
												}}
											>
												<Box>
													<Typography
														variant="h6"
														sx={{ fontWeight: 600, mb: 0.5 }}
													>
														Current Power
													</Typography>
													<Chip
														label="Live"
														size="small"
														variant="outlined"
														sx={{ fontSize: '0.7rem' }}
													/>
												</Box>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														gap: 1,
													}}
												>
													<Typography
														variant="h3"
														sx={{
															color: '#f59e0b',
															fontWeight: 700,
															letterSpacing: '-0.03em',
														}}
													>
														{currentPower !== null
															? `${currentPower.toFixed(0)}`
															: '--'}
													</Typography>
													<Typography
														variant="h6"
														sx={{ color: '#f59e0b', fontWeight: 500 }}
													>
														W
													</Typography>
												</Box>
											</Box>
										</CardContent>
									</Card>
								</motion.div>
							</Grid>

							{/* Total Energy */}
							<Grid size={{ xs: 12, md: 6 }}>
								<motion.div variants={staggerItem}>
									<Card
										sx={{
											borderRadius: 3,
											boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
											background:
												'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(52, 211, 153, 0.05) 100%)',
											border: '1px solid rgba(16, 185, 129, 0.1)',
											height: '100%',
											display: 'flex',
											flexDirection: 'column',
										}}
									>
										<CardContent sx={{ flexGrow: 1 }}>
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'flex-start',
													mb: 2,
												}}
											>
												<Box>
													<Typography
														variant="h6"
														sx={{ fontWeight: 600, mb: 0.5 }}
													>
														Total Energy
													</Typography>
													<Chip
														label="Cumulative"
														size="small"
														variant="outlined"
														sx={{ fontSize: '0.7rem' }}
													/>
												</Box>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														gap: 1,
													}}
												>
													<Typography
														variant="h3"
														sx={{
															color: '#10b981',
															fontWeight: 700,
															letterSpacing: '-0.03em',
														}}
													>
														{totalEnergy !== null
															? `${totalEnergy.toFixed(1)}`
															: '--'}
													</Typography>
													<Typography
														variant="h6"
														sx={{ color: '#10b981', fontWeight: 500 }}
													>
														kWh
													</Typography>
												</Box>
											</Box>
										</CardContent>
									</Card>
								</motion.div>
							</Grid>
						</Grid>
					</motion.div>
				)}
			</Box>

			{/* Configuration Dialog */}
			<Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)}>
				<DialogTitle>Configure HomeWizard</DialogTitle>
				<DialogContent>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
						{instructions && (
							<Box>
								<Typography variant="subtitle2" gutterBottom>
									Instructions:
								</Typography>
								<Box component="ol" sx={{ pl: 2, m: 0 }}>
									{instructions.instructions.map((instruction, index) => (
										<Typography
											component="li"
											key={index}
											variant="body2"
											color="text.secondary"
											sx={{ mb: 0.5 }}
										>
											{instruction}
										</Typography>
									))}
								</Box>
								<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
									For more details, visit{' '}
									<a
										href={instructions.apiDocs}
										target="_blank"
										rel="noopener noreferrer"
									>
										{instructions.apiDocs}
									</a>
								</Typography>
							</Box>
						)}
						<TextField
							label="IP Address"
							value={ip}
							onChange={(e) => setIp(e.target.value)}
							placeholder="192.168.1.100"
							fullWidth
							helperText="Enter the IP address of your HomeWizard Energy device"
						/>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
					<Button onClick={handleSaveConfig} variant="contained">
						Save
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};
