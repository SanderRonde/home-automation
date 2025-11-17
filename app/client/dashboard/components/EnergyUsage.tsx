import {
	Box,
	Card,
	CardContent,
	Typography,
	Grid,
	Button,
	TextField,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Chip,
} from '@mui/material';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { staggerContainer, staggerItem } from '../../lib/animations';
import { Settings as SettingsIcon } from '@mui/icons-material';
import { apiPost } from '../../lib/fetch';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useDevices } from './Devices';

export const EnergyUsage = (): JSX.Element => {
	const [configDialogOpen, setConfigDialogOpen] = useState(false);
	const [ip, setIp] = useState('');
	const [token, setToken] = useState('');

	const { devices } = useDevices();

	const energies = React.useMemo(() => {
		try {
			const energies = [];
			for (const device of devices ?? []) {
				let totalPower = 0;
				let totalEnergy = 0;
				for (const cluster of device.flatAllClusters ?? []) {
					if (cluster.name === DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT) {
						totalPower += cluster.activePower;
					}
					if (cluster.name === DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT) {
						totalEnergy += Number(cluster.totalEnergy);
					}
				}
				if (totalPower > 0 || totalEnergy > 0) {
					energies.push({
						name: device.name,
						energy: totalEnergy,
						power: totalPower,
					});
				}
			}
			return energies.sort((a, b) => {
				// Sort by highest energy first; if equal, then by highest power
				if (b.energy !== a.energy) {
					return b.energy - a.energy;
				}
				return b.power - a.power;
			});
		} catch (error) {
			console.error('Failed to load energy:', error);
			return [];
		}
	}, [devices]);

	const handleSaveConfig = async () => {
		try {
			const response = await apiPost(
				'homewizard',
				'/config',
				{},
				{
					ip: ip,
					token: token,
				}
			);
			if (response.ok) {
				setConfigDialogOpen(false);
			} else {
				console.error('Failed to save config');
			}
		} catch (error) {
			console.error('Failed to save config:', error);
		}
	};

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

				<motion.div variants={staggerContainer} initial="initial" animate="animate">
					<Grid container spacing={3}>
						{energies.length === 0 ? (
							<Grid size={12}>
								<Typography
									variant="body1"
									color="text.secondary"
									sx={{ textAlign: 'center', py: 4 }}
								>
									No energy data available. Make sure your HomeWizard Energy
									device is configured.
								</Typography>
							</Grid>
						) : (
							energies.map((energy, index) => (
								<Grid key={energy.name + index} size={{ xs: 12, md: 6, lg: 4 }}>
									<motion.div variants={staggerItem}>
										<Card
											sx={{
												borderRadius: 3,
												boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
												background:
													energy.power > 0
														? 'linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, rgba(252, 211, 77, 0.05) 100%)'
														: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(52, 211, 153, 0.05) 100%)',
												border:
													energy.power > 0
														? '1px solid rgba(251, 191, 36, 0.1)'
														: '1px solid rgba(16, 185, 129, 0.1)',
												height: '100%',
												display: 'flex',
												flexDirection: 'column',
											}}
										>
											<CardContent sx={{ flexGrow: 1 }}>
												<Box
													sx={{
														display: 'flex',
														flexDirection: 'column',
														gap: 2,
													}}
												>
													{/* Device Name */}
													<Box>
														<Typography
															variant="h6"
															sx={{ fontWeight: 600, mb: 0.5 }}
														>
															{energy.name}
														</Typography>
														<Chip
															label="Live"
															size="small"
															variant="outlined"
															sx={{ fontSize: '0.7rem' }}
														/>
													</Box>

													{/* Power Display */}
													{energy.power > 0 && (
														<Box
															sx={{
																display: 'flex',
																justifyContent: 'space-between',
																alignItems: 'center',
															}}
														>
															<Typography
																variant="body2"
																color="text.secondary"
															>
																Current Power
															</Typography>
															<Box
																sx={{
																	display: 'flex',
																	alignItems: 'baseline',
																	gap: 0.5,
																}}
															>
																<Typography
																	variant="h4"
																	sx={{
																		color: '#f59e0b',
																		fontWeight: 700,
																		letterSpacing: '-0.03em',
																	}}
																>
																	{energy.power.toFixed(0)}
																</Typography>
																<Typography
																	variant="body1"
																	sx={{
																		color: '#f59e0b',
																		fontWeight: 500,
																	}}
																>
																	W
																</Typography>
															</Box>
														</Box>
													)}

													{/* Energy Display */}
													{energy.energy > 0 && (
														<Box
															sx={{
																display: 'flex',
																justifyContent: 'space-between',
																alignItems: 'center',
															}}
														>
															<Typography
																variant="body2"
																color="text.secondary"
															>
																Total Energy
															</Typography>
															<Box
																sx={{
																	display: 'flex',
																	alignItems: 'baseline',
																	gap: 0.5,
																}}
															>
																<Typography
																	variant="h4"
																	sx={{
																		color: '#10b981',
																		fontWeight: 700,
																		letterSpacing: '-0.03em',
																	}}
																>
																	{energy.energy.toFixed(1)}
																</Typography>
																<Typography
																	variant="body1"
																	sx={{
																		color: '#10b981',
																		fontWeight: 500,
																	}}
																>
																	kWh
																</Typography>
															</Box>
														</Box>
													)}
												</Box>
											</CardContent>
										</Card>
									</motion.div>
								</Grid>
							))
						)}
					</Grid>
				</motion.div>
			</Box>

			{/* Configuration Dialog */}
			<Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)}>
				<DialogTitle>Configure HomeWizard</DialogTitle>
				<DialogContent>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
						<Box>
							<Typography variant="subtitle2" gutterBottom>
								Instructions:
							</Typography>
							<Box component="ol" sx={{ pl: 2, m: 0 }}>
								{[
									'1. Open the HomeWizard Energy app on your phone',
									'2. Go to Settings > API',
									'3. Enable "Local API"',
									'4. Note the IP address shown (e.g., 192.168.1.100)',
									'5. The API token is not required for local API access',
									'6. Enter the IP address in the configuration below',
								].map((instruction, index) => (
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
									href={
										'https://api-documentation.homewizard.com/docs/category/api-v2'
									}
									target="_blank"
									rel="noopener noreferrer"
								>
									{
										'https://api-documentation.homewizard.com/docs/category/api-v2'
									}
								</a>
							</Typography>
						</Box>
						<TextField
							label="IP Address"
							value={ip}
							onChange={(e) => setIp(e.target.value)}
							placeholder="192.168.1.100"
							fullWidth
							helperText="Enter the IP address of your HomeWizard Energy device"
						/>
						<TextField
							label="Token"
							value={token}
							onChange={(e) => setToken(e.target.value)}
							placeholder="1234567890"
							fullWidth
							helperText="Enter the token of your HomeWizard Energy device"
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
