import {
	Add as AddIcon,
	Delete as DeleteIcon,
	Edit as EditIcon,
	Router as RouterIcon,
} from '@mui/icons-material';
import {
	Box,
	Card,
	CardContent,
	Typography,
	IconButton,
	Button,
	CircularProgress,
	Chip,
} from '@mui/material';
import type { HomeDetectorWebsocketServerMessage } from '../../../server/modules/home-detector/routing';
import type { Host } from '../../../server/modules/home-detector/routing';
import { HOME_STATE } from '../../../server/modules/home-detector/types';
import useWebsocket from '../../shared/resilient-socket';
import { HomeDetectorModal } from './HomeDetectorModal';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

export const HomeDetector = (): JSX.Element => {
	const [hosts, setHosts] = useState<Host[]>([]);
	const [hostsState, setHostsState] = useState<Record<string, HOME_STATE>>({});
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingHost, setEditingHost] = useState<Host | undefined>(undefined);

	const loadHosts = async () => {
		try {
			const response = await apiGet('home-detector', '/list', {});
			if (response.ok) {
				const data = await response.json();
				setHosts(data.hosts);
			}
		} catch (error) {
			console.error('Failed to load hosts:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadHosts();
	}, []);

	// WebSocket for real-time updates
	useWebsocket<HomeDetectorWebsocketServerMessage, never>('/home-detector/ws', {
		onMessage: (message) => {
			if (message.type === 'state-change') {
				setHostsState(message.fullState);
			}
		},
	});

	const handleCreateHost = () => {
		setEditingHost(undefined);
		setModalOpen(true);
	};

	const handleEditHost = (host: Host) => {
		setEditingHost(host);
		setModalOpen(true);
	};

	const handleSaveHost = async (hostData: { name: string; ips: string[] }) => {
		try {
			if (editingHost) {
				// Update existing host
				const response = await apiPost(
					'home-detector',
					'/:name/update',
					{ name: editingHost.name },
					hostData
				);
				if (response.ok) {
					await loadHosts();
					setModalOpen(false);
				}
			} else {
				// Create new host
				const response = await apiPost('home-detector', '/create', {}, hostData);
				if (response.ok) {
					await loadHosts();
					setModalOpen(false);
				}
			}
		} catch (error) {
			console.error('Failed to save host:', error);
		}
	};

	const handleDeleteHost = async (name: string, event: React.MouseEvent) => {
		event.stopPropagation();
		if (!confirm('Are you sure you want to delete this host?')) {
			return;
		}

		await apiPost('home-detector', '/:name/delete', { name });
		await loadHosts();
	};

	if (loading) {
		return (
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '50vh',
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					mb: 3,
				}}
			>
				<Typography variant="h4">Home Detection</Typography>
				<Button
					variant="contained"
					startIcon={<AddIcon />}
					onClick={handleCreateHost}
					sx={{ borderRadius: 2 }}
				>
					Add Host
				</Button>
			</Box>

			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
				{hosts.map((host) => (
					<Card key={host.name} sx={{ borderRadius: 2 }}>
						<CardContent>
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'flex-start',
								}}
							>
								<Box sx={{ flexGrow: 1 }}>
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 2,
											mb: 1,
										}}
									>
										<Typography variant="h6">{host.name}</Typography>
										<Chip
											label={
												hostsState[host.name] === HOME_STATE.HOME
													? 'Home'
													: 'Away'
											}
											color={
												hostsState[host.name] === HOME_STATE.HOME
													? 'success'
													: 'default'
											}
											size="small"
										/>
									</Box>
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 1,
											mb: 1,
										}}
									>
										<RouterIcon
											sx={{ fontSize: 16, color: 'text.secondary' }}
										/>
										<Typography
											variant="body2"
											sx={{ color: 'text.secondary' }}
										>
											{host.ips.join(', ')}
										</Typography>
									</Box>
									{host.lastSeen && (
										<Typography
											variant="caption"
											sx={{ color: 'text.secondary' }}
										>
											Last seen: {new Date(host.lastSeen).toLocaleString()}
										</Typography>
									)}
								</Box>
								<Box sx={{ display: 'flex', gap: 1 }}>
									<IconButton
										size="small"
										onClick={() => handleEditHost(host)}
										sx={{ color: 'primary.main' }}
									>
										<EditIcon />
									</IconButton>
									<IconButton
										size="small"
										onClick={(e) => handleDeleteHost(host.name, e)}
										sx={{ color: 'error.main' }}
									>
										<DeleteIcon />
									</IconButton>
								</Box>
							</Box>
						</CardContent>
					</Card>
				))}

				{hosts.length === 0 && (
					<Typography
						variant="body1"
						sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}
					>
						No hosts configured yet. Add a host to start tracking presence.
					</Typography>
				)}
			</Box>

			<HomeDetectorModal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				onSave={handleSaveHost}
				host={editingHost}
			/>
		</Box>
	);
};
