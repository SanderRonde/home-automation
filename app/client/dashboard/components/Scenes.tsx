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
import {
	Add as AddIcon,
	Delete as DeleteIcon,
	PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { SceneCreateModal } from './SceneCreateModal';
import type { Scene } from '../../../../types/scene';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import { getClusterIcon } from './clusterIcons';
import * as Icons from '@mui/icons-material';
import { useDevices } from './Devices';

export const Scenes = (): JSX.Element => {
	const { devices, loading: devicesLoading } = useDevices();
	const [scenes, setScenes] = useState<Scene[]>([]);
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingScene, setEditingScene] = useState<Scene | undefined>(undefined);
	const [triggeringSceneId, setTriggeringSceneId] = useState<string | null>(null);

	const loadScenes = async () => {
		try {
			const response = await apiGet('device', '/scenes/list', {});
			if (response.ok) {
				const data = await response.json();
				setScenes(data.scenes);
			}
		} catch (error) {
			console.error('Failed to load scenes:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadScenes();
	}, []);

	const handleCreateScene = () => {
		setEditingScene(undefined);
		setModalOpen(true);
	};

	const handleEditScene = (scene: Scene) => {
		setEditingScene(scene);
		setModalOpen(true);
	};

	const handleSaveScene = async (sceneData: Omit<Scene, 'id'>) => {
		try {
			if (editingScene) {
				// Update existing scene
				const response = await apiPost(
					'device',
					'/scenes/:sceneId/update',
					{ sceneId: editingScene.id },
					sceneData
				);
				if (response.ok) {
					await loadScenes();
					setModalOpen(false);
				}
			} else {
				// Create new scene
				const response = await apiPost('device', '/scenes/create', {}, sceneData);
				if (response.ok) {
					await loadScenes();
					setModalOpen(false);
				}
			}
		} catch (error) {
			console.error('Failed to save scene:', error);
		}
	};

	const handleDeleteScene = async (sceneId: string, event: React.MouseEvent) => {
		event.stopPropagation();
		if (!confirm('Are you sure you want to delete this scene?')) {
			return;
		}

		try {
			const response = await apiPost('device', '/scenes/:sceneId/delete', { sceneId });
			if (response.ok) {
				await loadScenes();
			}
		} catch (error) {
			console.error('Failed to delete scene:', error);
		}
	};

	const handleTriggerScene = async (sceneId: string, event: React.MouseEvent) => {
		event.stopPropagation();
		setTriggeringSceneId(sceneId);

		try {
			const response = await apiPost('device', '/scenes/:sceneId/trigger', { sceneId });
			if (!response.ok) {
				console.error('Failed to trigger scene');
			}
		} catch (error) {
			console.error('Failed to trigger scene:', error);
		} finally {
			setTriggeringSceneId(null);
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
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
				{/* Header */}
				<Box
					sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
				>
					<Typography variant="h5">Scenes</Typography>
					<Button
						variant="contained"
						startIcon={<AddIcon />}
						onClick={handleCreateScene}
						sx={{ borderRadius: 2 }}
					>
						New Scene
					</Button>
				</Box>

				{/* Scenes List */}
				{scenes.length === 0 ? (
					<Card sx={{ mt: 4 }}>
						<CardContent
							sx={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								py: 6,
								gap: 2,
							}}
						>
							<Typography variant="h6" color="text.secondary">
								No scenes yet
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Create your first scene to get started
							</Typography>
							<Button
								variant="outlined"
								startIcon={<AddIcon />}
								onClick={handleCreateScene}
								sx={{ mt: 2 }}
							>
								Create Scene
							</Button>
						</CardContent>
					</Card>
				) : (
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
						{scenes.map((scene) => {
							const IconComponent = Icons[scene.icon];

							return (
								<Card key={scene.id} sx={{ borderRadius: 2, overflow: 'hidden' }}>
									<CardContent>
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'space-between',
												gap: 2,
											}}
										>
											{/* Scene info - clickable area */}
											<Box
												onClick={() => handleEditScene(scene)}
												sx={{
													display: 'flex',
													alignItems: 'center',
													gap: 2,
													flex: 1,
													minWidth: 0,
													cursor: 'pointer',
													borderRadius: 1,
													p: 1,
													ml: -1,
													transition: 'background-color 0.2s',
													'&:hover': {
														backgroundColor: 'action.hover',
													},
												}}
											>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														width: 48,
														height: 48,
														borderRadius: 2,
														backgroundColor: 'action.hover',
														flexShrink: 0,
													}}
												>
													<IconComponent sx={{ fontSize: 28 }} />
												</Box>
												<Box sx={{ flex: 1, minWidth: 0 }}>
													<Typography
														variant="h6"
														sx={{ fontWeight: 500 }}
													>
														{scene.title}
													</Typography>
													<Box
														sx={{
															display: 'flex',
															flexWrap: 'wrap',
															gap: 0.5,
															mt: 1,
														}}
													>
														{scene.actions.map((action, index) => {
															const device = getDeviceById(
																action.deviceId
															);
															if (!device) {
																return null;
															}

															const cluster = device.allClusters.find(
																(c) => c.name === action.cluster
															);

															return (
																<Chip
																	key={`${action.deviceId}-${action.cluster}-${index}`}
																	icon={
																		getClusterIcon(
																			cluster?.icon
																		) ?? undefined
																	}
																	label={device.name}
																	size="small"
																	sx={{
																		backgroundColor:
																			device.roomColor ??
																			'action.hover',
																		'& .MuiChip-label': {
																			color: 'rgba(0, 0, 0, 0.87)',
																		},
																		'& .MuiChip-icon': {
																			color: 'rgba(0, 0, 0, 0.6)',
																		},
																	}}
																/>
															);
														})}
													</Box>
												</Box>
											</Box>

											{/* Actions */}
											<Box
												sx={{
													display: 'flex',
													gap: 1,
													flexShrink: 0,
												}}
											>
												<IconButton
													size="medium"
													onClick={(e) => handleTriggerScene(scene.id, e)}
													disabled={triggeringSceneId === scene.id}
													sx={{
														backgroundColor: 'primary.main',
														color: 'primary.contrastText',
														'&:hover': {
															backgroundColor: 'primary.dark',
														},
														'&.Mui-disabled': {
															backgroundColor:
																'action.disabledBackground',
														},
													}}
												>
													{triggeringSceneId === scene.id ? (
														<CircularProgress
															size={24}
															color="inherit"
														/>
													) : (
														<PlayArrowIcon />
													)}
												</IconButton>
												<IconButton
													size="medium"
													onClick={(e) => handleDeleteScene(scene.id, e)}
													color="error"
												>
													<DeleteIcon />
												</IconButton>
											</Box>
										</Box>
									</CardContent>
								</Card>
							);
						})}
					</Box>
				)}
			</Box>

			{/* Create/Edit Modal */}
			{modalOpen && (
				<SceneCreateModal
					open={modalOpen}
					onClose={() => setModalOpen(false)}
					onSave={handleSaveScene}
					devices={devices}
					existingScene={editingScene}
				/>
			)}
		</Box>
	);
};
