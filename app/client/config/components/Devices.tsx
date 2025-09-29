import {
	Card,
	CardContent,
	Typography,
	Box,
	Chip,
	Stack,
	Accordion,
	AccordionSummary,
	AccordionDetails,
	Divider,
	TextField,
	Button,
	Alert,
	Grid,
	CardActionArea,
	CircularProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { ReturnTypeForApi } from '../../lib/fetch';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

interface EndpointVisualizationProps {
	endpoint: ReturnTypeForApi<
		'config',
		'/getDevices',
		'GET'
	>['ok']['devices'][number]['endpoints'][number];
	level: number;
	title?: string;
}

const EndpointVisualization: React.FC<EndpointVisualizationProps> = (props) => {
	const hasContent =
		props.endpoint.clusters.length > 0 ||
		props.endpoint.endpoints.length > 0;

	if (!hasContent) {
		return null;
	}

	return (
		<Box sx={{ ml: props.level * 2, mt: props.level > 0 ? 1 : 0 }}>
			{props.title && (
				<Typography
					variant="subtitle2"
					sx={{ mb: 1, fontWeight: 'bold' }}
				>
					{props.title}
				</Typography>
			)}

			{props.endpoint.clusters.length > 0 && (
				<Box sx={{ mb: 2 }}>
					<Typography
						variant="body2"
						sx={{ mb: 1, color: 'text.secondary' }}
					>
						Clusters:
					</Typography>
					<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
						{props.endpoint.clusters.map((cluster, idx) => (
							<Chip
								key={idx}
								label={`${cluster.emoji} ${cluster.name}`}
								size="small"
								variant="outlined"
								sx={{ fontSize: '0.75rem' }}
							/>
						))}
					</Box>
				</Box>
			)}

			{props.endpoint.endpoints.length > 0 && (
				<Box sx={{ ml: 1 }}>
					{props.endpoint.endpoints.map((subEndpoint, idx) => (
						<Box key={idx} sx={{ mb: 1 }}>
							<EndpointVisualization
								endpoint={subEndpoint}
								level={props.level + 1}
								title={`Endpoint ${idx + 1}`}
							/>
							{idx < props.endpoint.endpoints.length - 1 && (
								<Divider sx={{ my: 1, opacity: 0.3 }} />
							)}
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
};

export const Devices: React.FC = () => {
	const [devices, setDevices] = useState<
		ReturnTypeForApi<'config', '/getDevices', 'GET'>['ok']['devices']
	>([]);
	const [pairingCode, setPairingCode] = useState('');
	const [pairingLoading, setPairingLoading] = useState(false);
	const [pairingMessage, setPairingMessage] = useState<{
		type: 'success' | 'error';
		text: string;
	} | null>(null);
	const [expandedDevices, setExpandedDevices] = useState<Set<string>>(
		new Set()
	);
	const [loadingDevices, setLoadingDevices] = useState(false);

	const fetchDevices = async (showLoading = false) => {
		try {
			if (showLoading) {
				setLoadingDevices(true);
			}
			const response = await apiGet('config', '/getDevices', {});

			if (!response.ok) {
				throw new Error(
					`Failed to fetch devices: ${await response.text()}`
				);
			}

			const data = await response.json();
			// Sort devices first by source, then alphabetically by name
			const sortedDevices = data.devices.sort((a, b) => {
				if (a.source.name !== b.source.name) {
					return a.source.name.localeCompare(b.source.name);
				}
				return a.name.localeCompare(b.name);
			});

			setDevices(sortedDevices);
		} catch (error) {
			console.error('Failed to fetch devices:', error);
		} finally {
			if (showLoading) {
				setLoadingDevices(false);
			}
		}
	};

	const handlePair = async () => {
		if (!pairingCode.trim()) {
			return;
		}

		setPairingLoading(true);
		setPairingMessage(null);

		try {
			const response = await apiPost('config', '/pair/:code', {
				code: pairingCode,
			});

			if (!response.ok) {
				throw new Error(
					`Failed to pair device: ${await response.text()}`
				);
			}

			const pairedDevices = await response.json();
			setPairingMessage({
				type: 'success',
				text: `Device pairing initiated successfully. ${pairedDevices.devices.length} device${pairedDevices.devices.length !== 1 ? 's' : ''} paired.`,
			});
			setPairingCode('');

			// Refresh the device list immediately and clear message after delay
			await fetchDevices(true);
			setTimeout(() => setPairingMessage(null), 3000);
		} catch (error) {
			console.error('Failed to pair Matter device:', error);
			setPairingMessage({
				type: 'error',
				text:
					error instanceof Error
						? error.message
						: 'Failed to pair device',
			});

			// Clear error message after delay
			setTimeout(() => setPairingMessage(null), 5000);
		} finally {
			setPairingLoading(false);
		}
	};

	const toggleDeviceExpansion = (deviceId: string) => {
		setExpandedDevices((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(deviceId)) {
				newSet.delete(deviceId);
			} else {
				newSet.add(deviceId);
			}
			return newSet;
		});
	};

	useEffect(() => {
		void fetchDevices();
		// Poll for updates every 30 seconds
		const interval = setInterval(fetchDevices, 30000);
		return () => clearInterval(interval);
	}, []);

	return (
		<Box>
			<Typography variant="h5" gutterBottom>
				Devices
			</Typography>

			<Grid container spacing={3}>
				{/* Left Column - Devices List */}
				<Grid size={8}>
					<Box
						sx={{
							maxHeight: 'calc(100vh - 200px)',
							overflow: 'auto',
							pr: 1,
							'&::-webkit-scrollbar': {
								width: '6px',
							},
							'&::-webkit-scrollbar-track': {
								background: 'rgba(0,0,0,0.1)',
								borderRadius: '3px',
							},
							'&::-webkit-scrollbar-thumb': {
								background: 'rgba(0,0,0,0.3)',
								borderRadius: '3px',
								'&:hover': {
									background: 'rgba(0,0,0,0.5)',
								},
							},
						}}
					>
						<Stack spacing={2}>
							{loadingDevices && (
								<Box
									sx={{
										display: 'flex',
										justifyContent: 'center',
										py: 2,
									}}
								>
									<CircularProgress size={24} />
								</Box>
							)}
							{devices.map((device) => {
								const isExpanded = expandedDevices.has(
									device.uniqueId
								);
								const allEmojis = device.allClusters
									.map((c) => c.emoji)
									.join(' ');

								return (
									<Card key={device.uniqueId} elevation={1}>
										<CardActionArea
											onClick={() =>
												toggleDeviceExpansion(
													device.uniqueId
												)
											}
										>
											<CardContent sx={{ py: 2 }}>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														gap: 2,
													}}
												>
													<Typography
														variant="h6"
														sx={{
															fontWeight: 'bold',
															flex: 1,
														}}
													>
														{device.name}
													</Typography>
													{allEmojis && (
														<Typography
															variant="h6"
															sx={{
																fontSize:
																	'1.2rem',
															}}
														>
															{allEmojis}
														</Typography>
													)}
													<ExpandMoreIcon
														sx={{
															transform:
																isExpanded
																	? 'rotate(180deg)'
																	: 'rotate(0deg)',
															transition:
																'transform 0.2s',
														}}
													/>
												</Box>
												<Typography
													color="text.secondary"
													variant="body2"
													sx={{ mt: 0.5 }}
												>
													{device.source.emoji} Device
													ID: {device.uniqueId}
												</Typography>
											</CardContent>
										</CardActionArea>

										{isExpanded && (
											<CardContent
												sx={{
													pt: 0,
													borderTop: '1px solid',
													borderColor: 'divider',
												}}
											>
												{device.allClusters.length >
													0 && (
													<Box sx={{ mb: 3 }}>
														<Typography
															variant="subtitle1"
															sx={{ mb: 1 }}
														>
															All Device Clusters
														</Typography>
														<Box
															sx={{
																display: 'flex',
																flexWrap:
																	'wrap',
																gap: 1,
															}}
														>
															{device.allClusters.map(
																(
																	cluster,
																	idx
																) => (
																	<Chip
																		key={
																			idx
																		}
																		label={`${cluster.emoji} ${cluster.name}`}
																		size="small"
																		color="primary"
																		variant="outlined"
																	/>
																)
															)}
														</Box>
													</Box>
												)}

												<Accordion>
													<AccordionSummary
														expandIcon={
															<ExpandMoreIcon />
														}
														sx={{
															'& .MuiAccordionSummary-content':
																{
																	alignItems:
																		'center',
																},
														}}
													>
														<Typography variant="subtitle1">
															Endpoint Structure
														</Typography>
														<Chip
															label={`${device.endpoints.length} endpoint${device.endpoints.length !== 1 ? 's' : ''}`}
															size="small"
															sx={{ ml: 2 }}
														/>
													</AccordionSummary>
													<AccordionDetails>
														<EndpointVisualization
															endpoint={device}
															level={0}
															title="Root Device"
														/>
													</AccordionDetails>
												</Accordion>
											</CardContent>
										)}
									</Card>
								);
							})}
							{devices.length === 0 && (
								<Box sx={{ textAlign: 'center', py: 4 }}>
									<Typography color="text.secondary">
										No devices found
									</Typography>
								</Box>
							)}
						</Stack>
					</Box>
				</Grid>

				{/* Right Column - Controls */}
				<Grid size={4}>
					{/* Pairing Section */}
					<Card sx={{ mb: 3 }}>
						<CardContent>
							<Typography variant="h6" gutterBottom>
								Pair New Matter Device
							</Typography>
							<Box
								sx={{
									display: 'flex',
									flexDirection: 'column',
									gap: 2,
								}}
							>
								<TextField
									label="Matter Pairing Code"
									value={pairingCode}
									onChange={(e) =>
										setPairingCode(e.target.value)
									}
									disabled={pairingLoading}
									placeholder="Enter Matter pairing code"
									fullWidth
									size="small"
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											void handlePair();
										}
									}}
								/>
								<Button
									variant="contained"
									onClick={handlePair}
									disabled={
										pairingLoading || !pairingCode.trim()
									}
									fullWidth
								>
									{pairingLoading
										? 'Pairing...'
										: 'Pair Matter Device'}
								</Button>
							</Box>
							{pairingMessage && (
								<Alert
									severity={pairingMessage.type}
									sx={{ mt: 2 }}
								>
									{pairingMessage.text}
								</Alert>
							)}
						</CardContent>
					</Card>
				</Grid>
			</Grid>
		</Box>
	);
};
