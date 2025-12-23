import {
	Add as AddIcon,
	Delete as DeleteIcon,
	PlayArrow as PlayArrowIcon,
	Sensors as SensorsIcon,
	Star as StarIcon,
	TouchApp as TouchAppIcon,
	History as HistoryIcon,
	Refresh as RefreshIcon,
	CheckCircle as CheckCircleIcon,
	Error as ErrorIcon,
	Person as PersonIcon,
	Home as HomeIcon,
	ExitToApp as ExitToAppIcon,
	Webhook as WebhookIcon,
} from '@mui/icons-material';
import {
	Box,
	Card,
	CardContent,
	Typography,
	IconButton,
	Button,
	CircularProgress,
	Tooltip,
	Tabs,
	Tab,
	Chip,
} from '@mui/material';
import type { Scene, SceneExecution } from '../../../../types/scene';
import { SceneTriggerType } from '../../../../types/scene';
import type { DeviceGroup } from '../../../../types/group';
import type { Palette } from '../../../../types/palette';
import { SceneCreateModal } from './SceneCreateModal';
import { SceneActionChips } from './SceneActionChips';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import { useDevices } from './Devices';
import { IconComponent } from './icon';

export const Scenes = (): JSX.Element => {
	const { devices, loading: devicesLoading } = useDevices();
	const [currentTab, setCurrentTab] = useState(0);
	const [scenes, setScenes] = useState<Scene[]>([]);
	const [groups, setGroups] = useState<DeviceGroup[]>([]);
	const [palettes, setPalettes] = useState<Palette[]>([]);
	const [loading, setLoading] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingScene, setEditingScene] = useState<Scene | undefined>(undefined);
	const [triggeringSceneId, setTriggeringSceneId] = useState<string | null>(null);
	const [history, setHistory] = useState<SceneExecution[]>([]);
	const [loadingHistory, setLoadingHistory] = useState(false);

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

	const loadHistory = async () => {
		setLoadingHistory(true);
		try {
			const response = await apiGet('device', '/scenes/history', {});
			if (response.ok) {
				const data = await response.json();
				setHistory(data.history);
			}
		} catch (error) {
			console.error('Failed to load scene history:', error);
		} finally {
			setLoadingHistory(false);
		}
	};

	useEffect(() => {
		void loadScenes();
		const loadGroups = async () => {
			try {
				const response = await apiGet('device', '/groups/list', {});
				if (response.ok) {
					const data = await response.json();
					setGroups(data.groups);
				}
			} catch (error) {
				console.error('Failed to load groups:', error);
			}
		};
		const loadPalettes = async () => {
			try {
				const response = await apiGet('device', '/palettes/list', {});
				if (response.ok) {
					const data = await response.json();
					setPalettes(data.palettes);
				}
			} catch (error) {
				console.error('Failed to load palettes:', error);
			}
		};
		void loadGroups();
		void loadPalettes();
	}, []);

	useEffect(() => {
		if (currentTab === 1) {
			void loadHistory();
		}
	}, [currentTab]);

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
					sceneData as unknown as Parameters<typeof apiPost>[3]
				);
				if (response.ok) {
					await loadScenes();
					setModalOpen(false);
				}
			} else {
				// Create new scene
				const response = await apiPost(
					'device',
					'/scenes/create',
					{},
					sceneData as unknown as Parameters<typeof apiPost>[3]
				);
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

	const getGroupById = (groupId: string) => {
		return groups.find((g) => g.id === groupId);
	};

	const getTriggerIcon = (scene: Scene) => {
		if (!scene.triggers) {
			return null;
		}

		return scene.triggers.map(({ trigger }, index) => {
			if (trigger.type === 'occupancy') {
				const device = getDeviceById(trigger.deviceId);
				const deviceName = device?.name || 'Unknown Device';
				return (
					<Tooltip title={`Occupancy: ${deviceName}`} key={index}>
						<SensorsIcon
							sx={{
								fontSize: 20,
								color: 'text.secondary',
							}}
						/>
					</Tooltip>
				);
			}

			if (trigger.type === 'button-press') {
				const device = getDeviceById(trigger.deviceId);
				const deviceName = device?.name || 'Unknown Device';
				return (
					<Tooltip title={`Button ${trigger.buttonIndex + 1}: ${deviceName}`} key={index}>
						<TouchAppIcon
							sx={{
								fontSize: 20,
								color: 'text.secondary',
							}}
						/>
					</Tooltip>
				);
			}
			return null;
		});
	};

	const getTriggerDescription = (execution: SceneExecution): string => {
		if (execution.trigger_type === 'manual') {
			return 'Manual trigger';
		}

		switch (execution.trigger_type) {
			case SceneTriggerType.OCCUPANCY: {
				const device = execution.trigger_source
					? getDeviceById(execution.trigger_source)
					: null;
				const deviceName = device?.name || execution.trigger_source || 'Unknown';
				return `Motion sensor: ${deviceName}`;
			}
			case SceneTriggerType.BUTTON_PRESS: {
				const parts = execution.trigger_source?.split(':') || [];
				const device = parts[0] ? getDeviceById(parts[0]) : null;
				const deviceName = device?.name || parts[0] || 'Unknown';
				const buttonIndex = parts[1] ? parseInt(parts[1], 10) + 1 : '?';
				return `Button ${buttonIndex}: ${deviceName}`;
			}
			case SceneTriggerType.HOST_ARRIVAL:
				return `Host arrival: ${execution.trigger_source || 'Unknown'}`;
			case SceneTriggerType.HOST_DEPARTURE:
				return `Host departure: ${execution.trigger_source || 'Unknown'}`;
			case SceneTriggerType.WEBHOOK:
				return `Webhook: ${execution.trigger_source || 'Unknown'}`;
			case SceneTriggerType.ANYBODY_HOME:
				return 'Anybody home';
			case SceneTriggerType.NOBODY_HOME:
				return 'Nobody home';
			case SceneTriggerType.NOBODY_HOME_TIMEOUT:
				return 'Nobody home timeout';
			default:
				return execution.trigger_type;
		}
	};

	const getTriggerIconForExecution = (execution: SceneExecution) => {
		if (execution.trigger_type === 'manual') {
			return <PlayArrowIcon sx={{ fontSize: 20 }} />;
		}

		switch (execution.trigger_type) {
			case SceneTriggerType.OCCUPANCY:
				return <SensorsIcon sx={{ fontSize: 20 }} />;
			case SceneTriggerType.BUTTON_PRESS:
				return <TouchAppIcon sx={{ fontSize: 20 }} />;
			case SceneTriggerType.HOST_ARRIVAL:
				return <HomeIcon sx={{ fontSize: 20 }} />;
			case SceneTriggerType.HOST_DEPARTURE:
				return <ExitToAppIcon sx={{ fontSize: 20 }} />;
			case SceneTriggerType.WEBHOOK:
				return <WebhookIcon sx={{ fontSize: 20 }} />;
			case SceneTriggerType.ANYBODY_HOME:
				return <PersonIcon sx={{ fontSize: 20 }} />;
			case SceneTriggerType.NOBODY_HOME:
			case SceneTriggerType.NOBODY_HOME_TIMEOUT:
				return <ExitToAppIcon sx={{ fontSize: 20 }} />;
			default:
				return <HistoryIcon sx={{ fontSize: 20 }} />;
		}
	};

	const formatTimestamp = (timestamp: number): string => {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) {
			return 'Just now';
		}
		if (diffMins < 60) {
			return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
		}
		if (diffHours < 24) {
			return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
		}
		if (diffDays < 7) {
			return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
		}
		return date.toLocaleString();
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

				{/* Tabs */}
				<Tabs value={currentTab} onChange={(_e, newValue) => setCurrentTab(newValue)}>
					<Tab label="Scenes" />
					<Tab label="History" />
				</Tabs>

				{/* Scenes Tab */}
				{currentTab === 0 && scenes.length === 0 ? (
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
				) : currentTab === 0 ? (
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
						{scenes.map((scene) => {
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
													<IconComponent
														iconName={scene.icon}
														sx={{ fontSize: 28 }}
													/>
												</Box>
												<Box sx={{ flex: 1, minWidth: 0 }}>
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															gap: 1,
														}}
													>
														<Typography
															variant="h6"
															sx={{ fontWeight: 500 }}
														>
															{scene.title}
														</Typography>
														{scene.showOnHome && (
															<Tooltip title="Shown on Home">
																<StarIcon
																	sx={{
																		fontSize: 20,
																		color: 'warning.main',
																	}}
																/>
															</Tooltip>
														)}
														{getTriggerIcon(scene)}
													</Box>
													<SceneActionChips
														actions={scene.actions}
														devices={devices}
														groups={groups}
														palettes={palettes}
														getDeviceById={getDeviceById}
														getGroupById={getGroupById}
													/>
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
				) : null}

				{/* History Tab */}
				{currentTab === 1 && (
					<Box>
						<Box
							sx={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								mb: 2,
							}}
						>
							<Typography variant="h6">Scene Execution History</Typography>
							<IconButton
								onClick={() => void loadHistory()}
								disabled={loadingHistory}
							>
								<RefreshIcon />
							</IconButton>
						</Box>

						{loadingHistory ? (
							<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
								<CircularProgress />
							</Box>
						) : history.length === 0 ? (
							<Card sx={{ borderRadius: 2 }}>
								<CardContent>
									<Typography
										variant="body2"
										color="text.secondary"
										textAlign="center"
									>
										No scene executions yet
									</Typography>
								</CardContent>
							</Card>
						) : (
							<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
								{history.map((execution) => {
									const scene = scenes.find((s) => s.id === execution.scene_id);
									return (
										<Card key={execution.id} sx={{ borderRadius: 2 }}>
											<CardContent>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														gap: 2,
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
														{scene ? (
															<IconComponent
																iconName={scene.icon}
																sx={{ fontSize: 28 }}
															/>
														) : (
															<HistoryIcon sx={{ fontSize: 28 }} />
														)}
													</Box>
													<Box sx={{ flex: 1, minWidth: 0 }}>
														<Box
															sx={{
																display: 'flex',
																alignItems: 'center',
																gap: 1,
																mb: 0.5,
															}}
														>
															<Typography
																variant="subtitle1"
																fontWeight={500}
															>
																{execution.scene_title}
															</Typography>
															{execution.success ? (
																<CheckCircleIcon
																	sx={{
																		fontSize: 18,
																		color: 'success.main',
																	}}
																/>
															) : (
																<ErrorIcon
																	sx={{
																		fontSize: 18,
																		color: 'error.main',
																	}}
																/>
															)}
														</Box>
														<Box
															sx={{
																display: 'flex',
																alignItems: 'center',
																gap: 1,
																flexWrap: 'wrap',
															}}
														>
															<Chip
																icon={getTriggerIconForExecution(
																	execution
																)}
																label={getTriggerDescription(
																	execution
																)}
																size="small"
																variant="outlined"
															/>
															<Typography
																variant="caption"
																color="text.secondary"
															>
																{formatTimestamp(
																	execution.timestamp
																)}
															</Typography>
														</Box>
													</Box>
												</Box>
											</CardContent>
										</Card>
									);
								})}
							</Box>
						)}
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
