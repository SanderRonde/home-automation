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
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import type { DeviceGroup } from '../../../../types/group';
import { GroupCreateModal } from './GroupCreateModal';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import { useDevices } from './Devices';

export const Groups = (): JSX.Element => {
	const { devices, loading: devicesLoading } = useDevices();
	const [groups, setGroups] = useState<DeviceGroup[]>([]);
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingGroup, setEditingGroup] = useState<DeviceGroup | undefined>(undefined);

	const loadGroups = async () => {
		try {
			const response = await apiGet('device', '/groups/list', {});
			if (response.ok) {
				const data = await response.json();
				setGroups(data.groups);
			}
		} catch (error) {
			console.error('Failed to load groups:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadGroups();
	}, []);

	const handleCreateGroup = () => {
		setEditingGroup(undefined);
		setModalOpen(true);
	};

	const handleEditGroup = (group: DeviceGroup) => {
		setEditingGroup(group);
		setModalOpen(true);
	};

	const handleSaveGroup = async (groupData: Omit<DeviceGroup, 'id'>) => {
		try {
			if (editingGroup) {
				// Update existing group
				const response = await apiPost(
					'device',
					'/groups/:groupId/update',
					{ groupId: editingGroup.id },
					groupData
				);
				if (response.ok) {
					await loadGroups();
					setModalOpen(false);
				}
			} else {
				// Create new group
				const response = await apiPost('device', '/groups/create', {}, groupData);
				if (response.ok) {
					await loadGroups();
					setModalOpen(false);
				}
			}
		} catch (error) {
			console.error('Failed to save group:', error);
		}
	};

	const handleDeleteGroup = async (groupId: string, event: React.MouseEvent) => {
		event.stopPropagation();
		if (!confirm('Are you sure you want to delete this group?')) {
			return;
		}

		try {
			const response = await apiPost('device', '/groups/:groupId/delete', { groupId });
			if (response.ok) {
				await loadGroups();
			}
		} catch (error) {
			console.error('Failed to delete group:', error);
		}
	};

	const getDeviceById = (deviceId: string) => {
		return devices.find((d) => d.uniqueId === deviceId);
	};

	if (loading || devicesLoading) {
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
				<Typography variant="h4">Device Groups</Typography>
				<Button
					variant="contained"
					startIcon={<AddIcon />}
					onClick={handleCreateGroup}
					sx={{ borderRadius: 2 }}
				>
					Create Group
				</Button>
			</Box>

			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
				{groups.map((group) => {
					const groupDevices = group.deviceIds
						.map(getDeviceById)
						.filter((d) => d !== undefined);

					// Calculate common clusters
					const clusterMap = new Map<string, number>();
					for (const device of groupDevices) {
						for (const cluster of device.flatAllClusters) {
							clusterMap.set(cluster.name, (clusterMap.get(cluster.name) || 0) + 1);
						}
					}
					const commonClusters = Array.from(clusterMap.entries())
						.filter(([, count]) => count === groupDevices.length)
						.map(([name]) => name);

					return (
						<Card key={group.id} sx={{ borderRadius: 2 }}>
							<CardContent>
								<Box
									sx={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'flex-start',
										mb: 2,
									}}
								>
									<Box sx={{ flexGrow: 1 }}>
										<Typography variant="h6" sx={{ mb: 1 }}>
											{group.name}
										</Typography>
										<Typography
											variant="body2"
											sx={{ color: 'text.secondary', mb: 1 }}
										>
											{groupDevices.length} device
											{groupDevices.length !== 1 ? 's' : ''}
										</Typography>
										<Box
											sx={{
												display: 'flex',
												flexWrap: 'wrap',
												gap: 0.5,
												mb: 1,
											}}
										>
											{groupDevices.map((device) => (
												<Chip
													key={device.uniqueId}
													label={device.name || device.uniqueId}
													size="small"
													variant="outlined"
												/>
											))}
										</Box>
										{commonClusters.length > 0 && (
											<Typography
												variant="caption"
												sx={{ color: 'text.secondary' }}
											>
												Common clusters: {commonClusters.join(', ')}
											</Typography>
										)}
									</Box>
									<Box sx={{ display: 'flex', gap: 1 }}>
										<IconButton
											size="small"
											onClick={() => handleEditGroup(group)}
											sx={{ color: 'primary.main' }}
										>
											<EditIcon />
										</IconButton>
										<IconButton
											size="small"
											onClick={(e) => handleDeleteGroup(group.id, e)}
											sx={{ color: 'error.main' }}
										>
											<DeleteIcon />
										</IconButton>
									</Box>
								</Box>
							</CardContent>
						</Card>
					);
				})}

				{groups.length === 0 && (
					<Typography
						variant="body1"
						sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}
					>
						No groups created yet. Create a group to organize your devices.
					</Typography>
				)}
			</Box>

			<GroupCreateModal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				onSave={handleSaveGroup}
				group={editingGroup}
				devices={devices}
			/>
		</Box>
	);
};
