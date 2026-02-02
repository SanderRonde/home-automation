import {
	Refresh as RefreshIcon,
	TouchApp as TouchAppIcon,
	MovieFilter as MovieFilterIcon,
	Webhook as WebhookIcon,
	Home as HomeIcon,
	ExitToApp as ExitToAppIcon,
	Notifications as NotificationsIcon,
	DeviceThermostat as DeviceThermostatIcon,
	ExpandMore as ExpandMoreIcon,
	CheckCircle as CheckCircleIcon,
	Error as ErrorIcon,
	History as HistoryIcon,
	Api as ApiIcon,
} from '@mui/icons-material';
import {
	Box,
	Typography,
	Card,
	CardContent,
	CircularProgress,
	IconButton,
	FormGroup,
	FormControlLabel,
	Checkbox,
	Chip,
	Accordion,
	AccordionSummary,
	AccordionDetails,
} from '@mui/material';
import type { LogDescription } from '../../../server/modules/logs/describers';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { IncludedIconNames } from './icon';
import { hsvToHex } from './ColorPresets';
import { apiGet } from '../../lib/fetch';
import { IconComponent } from './icon';

// Device info for enriching log descriptions
interface DeviceInfo {
	name: string;
	room: string | null;
	roomColor?: string;
	roomIcon?: IncludedIconNames;
}

// Log type definitions
type LogType =
	| 'activity'
	| 'scene'
	| 'webhook'
	| 'homeDetection'
	| 'notification'
	| 'temperature'
	| 'tuyaApi';

interface BaseLogEntry {
	id: string | number;
	timestamp: number;
	type: LogType;
}

interface ActivityLogEntry extends BaseLogEntry {
	type: 'activity';
	description: LogDescription[];
	username: string | null;
	method: string;
	endpoint: string;
	params: string | null;
	body: string | null;
}

interface SceneLogEntry extends BaseLogEntry {
	type: 'scene';
	scene_id: string;
	scene_title: string;
	trigger_type: string;
	trigger_source?: string | null;
	success: boolean;
}

interface WebhookLogEntry extends BaseLogEntry {
	type: 'webhook';
	webhookName: string;
	method: string;
	ip: string;
	body: unknown;
	headers: Record<string, string>;
}

interface HomeDetectionLogEntry extends BaseLogEntry {
	type: 'homeDetection';
	host_name: string;
	state: string;
	trigger_type?: string | null;
}

interface NotificationLogEntry extends BaseLogEntry {
	type: 'notification';
	title: string;
	body: string;
	success: boolean;
	recipient_count: number;
}

interface TemperatureLogEntry extends BaseLogEntry {
	type: 'temperature';
	source: string;
	action: string;
	details: string;
	previousState?: string | null;
	newState?: string | null;
}

interface TuyaApiLogEntry extends BaseLogEntry {
	type: 'tuyaApi';
	source: string;
	endpoint: string;
	device_id: string | null;
}

type LogEntry =
	| ActivityLogEntry
	| SceneLogEntry
	| WebhookLogEntry
	| HomeDetectionLogEntry
	| NotificationLogEntry
	| TemperatureLogEntry
	| TuyaApiLogEntry;

const LOG_TYPE_CONFIG: Record<
	LogType,
	{ label: string; icon: React.ReactElement; defaultEnabled: boolean }
> = {
	activity: { label: 'UI Actions', icon: <TouchAppIcon />, defaultEnabled: true },
	scene: { label: 'Scene Triggers', icon: <MovieFilterIcon />, defaultEnabled: false },
	webhook: { label: 'Webhooks', icon: <WebhookIcon />, defaultEnabled: false },
	homeDetection: {
		label: 'Home Detection',
		icon: <HomeIcon />,
		defaultEnabled: false,
	},
	notification: {
		label: 'Notifications',
		icon: <NotificationsIcon />,
		defaultEnabled: false,
	},
	temperature: {
		label: 'Temperature',
		icon: <DeviceThermostatIcon />,
		defaultEnabled: false,
	},
	tuyaApi: {
		label: 'Tuya API',
		icon: <ApiIcon />,
		defaultEnabled: false,
	},
};

export const Logs = (): JSX.Element => {
	const [loading, setLoading] = useState(true);
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [devices, setDevices] = useState<Map<string, DeviceInfo>>(new Map());
	const [enabledTypes, setEnabledTypes] = useState<Record<LogType, boolean>>(() => {
		const initial: Record<LogType, boolean> = {} as Record<LogType, boolean>;
		for (const [type, config] of Object.entries(LOG_TYPE_CONFIG)) {
			initial[type as LogType] = config.defaultEnabled;
		}
		return initial;
	});
	const [enabledSources, setEnabledSources] = useState<Set<string>>(new Set());
	const [tuyaCountBySource, setTuyaCountBySource] = useState<Record<string, number>>({});
	const [enabledTuyaSources, setEnabledTuyaSources] = useState<Set<string>>(new Set());

	// Load devices for enriching log descriptions
	useEffect(() => {
		const loadDevices = async () => {
			try {
				const response = await apiGet('device', '/listWithValues', {});
				if (response.ok) {
					const data = await response.json();
					const deviceMap = new Map<string, DeviceInfo>();
					for (const device of data.devices) {
						deviceMap.set(device.uniqueId, {
							name: device.name || device.uniqueId,
							room: device.room || null,
							roomIcon: device.roomIcon,
						});
					}
					setDevices(deviceMap);
				}
			} catch (error) {
				console.error('Failed to load devices:', error);
			}
		};
		void loadDevices();
	}, []);

	// Helper to enrich activity log descriptions with device names
	const enrichDescription = useCallback(
		(log: ActivityLogEntry): React.ReactNode => {
			return (
				<>
					{log.description.map((description) => {
						if (description.type === 'text') {
							return (
								<Typography key={description.text}>{description.text}</Typography>
							);
						}
						if (description.type === 'devices') {
							return (
								<Box
									key={description.deviceIds.join(', ')}
									sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}
								>
									{description.deviceIds.map((deviceId) => {
										const device = devices.get(deviceId);
										const deviceName = device?.name || deviceId;
										const roomIcon = device?.roomIcon;

										return (
											<Chip
												key={deviceId}
												label={
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															gap: 0.75,
														}}
													>
														{roomIcon && (
															<IconComponent
																iconName={roomIcon}
																sx={{ fontSize: 16 }}
															/>
														)}
														{deviceName}
													</Box>
												}
												size="small"
												variant="outlined"
											/>
										);
									})}
								</Box>
							);
						}
						if (description.type === 'color') {
							const colorHex = hsvToHex(
								description.color.hue,
								description.color.saturation,
								description.color.value
							);
							return (
								<Box
									key={`${description.color.hue}-${description.color.saturation}-${description.color.value}`}
									sx={{
										display: 'inline-block',
										width: 24,
										height: 24,
										borderRadius: 1,
										backgroundColor: colorHex,
										border: '1px solid',
										borderColor: 'divider',
										ml: 0.5,
										verticalAlign: 'middle',
									}}
								/>
							);
						}
						return null;
					})}
				</>
			);
		},
		[devices]
	);

	const loadLogs = useCallback(async () => {
		setLoading(true);
		const allLogs: LogEntry[] = [];

		try {
			// Load activity logs if enabled
			if (enabledTypes.activity) {
				const response = await apiGet('logs', '/activity', {});
				if (response.ok) {
					const data = await response.json();
					for (const log of data.logs) {
						allLogs.push({
							...log,
							type: 'activity' as const,
							id: `activity-${log.id}`,
						});
					}
				}
			}

			// Load scene history if enabled
			if (enabledTypes.scene) {
				const response = await apiGet('device', '/scenes/history', {});
				if (response.ok) {
					const data = await response.json();
					for (const log of data.history) {
						allLogs.push({
							...log,
							type: 'scene' as const,
							id: `scene-${log.id}`,
						});
					}
				}
			}

			// Load webhook triggers if enabled
			if (enabledTypes.webhook) {
				// First get list of webhooks, then get triggers for each
				const listResponse = await apiGet('webhook', '/list', {});
				if (listResponse.ok) {
					const listData = await listResponse.json();
					for (const webhook of listData.webhooks) {
						const triggersResponse = await apiGet('webhook', '/:name/triggers', {
							name: webhook.name,
						});
						if (triggersResponse.ok) {
							const triggersData = await triggersResponse.json();
							for (const trigger of triggersData.triggers) {
								allLogs.push({
									id: `webhook-${trigger.id}`,
									timestamp: trigger.timestamp,
									type: 'webhook' as const,
									webhookName: webhook.name,
									method: trigger.method,
									ip: trigger.ip,
									body: trigger.body,
									headers: trigger.headers,
								});
							}
						}
					}
				}
			}

			// Load home detection events if enabled
			if (enabledTypes.homeDetection) {
				const response = await apiGet('home-detector', '/events/history', {});
				if (response.ok) {
					const data = await response.json();
					for (const event of data.events) {
						allLogs.push({
							...event,
							type: 'homeDetection' as const,
							id: `home-${event.id}`,
						});
					}
				}
			}

			// Load notification history if enabled
			if (enabledTypes.notification) {
				const response = await apiGet('logs', '/notifications', {});
				if (response.ok) {
					const data = await response.json();
					for (const log of data.logs) {
						allLogs.push({
							...log,
							type: 'notification' as const,
							id: `notification-${log.id}`,
							success: log.success === 1,
						});
					}
				}
			}

			// Load temperature action history if enabled
			if (enabledTypes.temperature) {
				const response = await apiGet('temperature', '/action-history', {});
				if (response.ok) {
					const data = (await response.json()) as {
						success: boolean;
						history: Array<{
							timestamp: number;
							action: string;
							details: string;
							source?: string;
							previousState?: string | null;
							newState?: string | null;
						}>;
					};
					const sources = new Set<string>();
					for (let i = 0; i < data.history.length; i++) {
						const entry = data.history[i];
						const source = entry.source || 'manual';
						sources.add(source);
						allLogs.push({
							id: `temp-${i}-${entry.timestamp}`,
							timestamp: entry.timestamp,
							type: 'temperature' as const,
							source,
							action: entry.action,
							details: entry.details,
							previousState: entry.previousState ?? null,
							newState: entry.newState ?? null,
						});
					}
					// Update enabled sources - merge with existing
					setEnabledSources((prev) => {
						if (prev.size === 0) {
							return sources;
						}
						const newSources = new Set(prev);
						for (const source of sources) {
							newSources.add(source);
						}
						return newSources;
					});
				}
			}

			// Load Tuya API call history if enabled
			if (enabledTypes.tuyaApi) {
				const response = await apiGet('logs', '/tuya-api-calls', {});
				if (response.ok) {
					const data = (await response.json()) as {
						logs: Array<{
							id: number;
							timestamp: number;
							source: string;
							endpoint: string;
							device_id: string | null;
						}>;
						countBySource: Record<string, number>;
					};
					setTuyaCountBySource(data.countBySource ?? {});
					const tuyaSources = new Set<string>();
					for (let i = 0; i < data.logs.length; i++) {
						const entry = data.logs[i];
						tuyaSources.add(entry.source);
						allLogs.push({
							id: `tuya-${entry.id}`,
							timestamp: entry.timestamp,
							type: 'tuyaApi' as const,
							source: entry.source,
							endpoint: entry.endpoint,
							device_id: entry.device_id,
						});
					}
					setEnabledTuyaSources((prev) => {
						if (prev.size === 0) {
							return tuyaSources;
						}
						const newSet = new Set(prev);
						for (const s of tuyaSources) {
							newSet.add(s);
						}
						return newSet;
					});
				}
			}

			// Sort by timestamp descending
			allLogs.sort((a, b) => b.timestamp - a.timestamp);
			setLogs(allLogs);
		} catch (error) {
			console.error('Failed to load logs:', error);
		} finally {
			setLoading(false);
		}
	}, [enabledTypes]);

	useEffect(() => {
		void loadLogs();
	}, [loadLogs]);

	// Filter logs by enabled sources when sources change
	const filteredLogs = useMemo(() => {
		return logs.filter((log) => {
			if (log.type === 'temperature') {
				return enabledSources.size === 0 || enabledSources.has(log.source);
			}
			if (log.type === 'tuyaApi') {
				return enabledTuyaSources.size === 0 || enabledTuyaSources.has(log.source);
			}
			return true;
		});
	}, [logs, enabledSources, enabledTuyaSources]);

	const handleTypeToggle = (type: LogType) => {
		setEnabledTypes((prev) => ({
			...prev,
			[type]: !prev[type],
		}));
	};

	const handleSourceToggle = (source: string) => {
		setEnabledSources((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(source)) {
				newSet.delete(source);
			} else {
				newSet.add(source);
			}
			return newSet;
		});
	};

	const handleTuyaSourceToggle = (source: string) => {
		setEnabledTuyaSources((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(source)) {
				newSet.delete(source);
			} else {
				newSet.add(source);
			}
			return newSet;
		});
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

	const getLogIcon = (log: LogEntry): React.ReactElement => {
		switch (log.type) {
			case 'activity':
				return <TouchAppIcon sx={{ fontSize: 20 }} />;
			case 'scene':
				return <MovieFilterIcon sx={{ fontSize: 20 }} />;
			case 'webhook':
				return <WebhookIcon sx={{ fontSize: 20 }} />;
			case 'homeDetection':
				return log.state.toLowerCase() === 'home' ? (
					<HomeIcon sx={{ fontSize: 20 }} />
				) : (
					<ExitToAppIcon sx={{ fontSize: 20 }} />
				);
			case 'notification':
				return <NotificationsIcon sx={{ fontSize: 20 }} />;
			case 'temperature':
				return <DeviceThermostatIcon sx={{ fontSize: 20 }} />;
			case 'tuyaApi':
				return <ApiIcon sx={{ fontSize: 20 }} />;
			default:
				return <HistoryIcon sx={{ fontSize: 20 }} />;
		}
	};

	const getLogTitle = useCallback(
		(log: LogEntry): React.ReactNode => {
			if (log.type === 'activity') {
				return enrichDescription(log);
			}

			const text = (() => {
				switch (log.type) {
					case 'scene':
						return `Scene: ${log.scene_title}`;
					case 'webhook':
						return `Webhook: ${log.webhookName}`;
					case 'homeDetection':
						return `${log.host_name}: ${log.state}`;
					case 'notification':
						return log.title;
					case 'temperature':
						return `${log.action} [${log.source}]`;
					case 'tuyaApi':
						return `${log.endpoint} [${log.source}]`;
					default:
						return 'Unknown event';
				}
			})();
			return (
				<Typography
					variant="body2"
					fontWeight={500}
					sx={{
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
					}}
				>
					{text}
				</Typography>
			);
		},
		[enrichDescription]
	);

	const getLogSubtitle = (log: LogEntry): string | null => {
		switch (log.type) {
			case 'activity':
				return log.username ? `by ${log.username}` : null;
			case 'scene':
				return log.trigger_type === 'manual'
					? 'Manual trigger'
					: `Triggered by ${log.trigger_type}`;
			case 'webhook':
				return `${log.method} from ${log.ip}`;
			case 'homeDetection':
				return log.trigger_type || null;
			case 'notification':
				return `${log.recipient_count} recipient${log.recipient_count !== 1 ? 's' : ''}`;
			case 'temperature':
				return `${log.source} - ${log.details}`;
			case 'tuyaApi':
				return log.device_id ? `device: ${log.device_id}` : log.source;
			default:
				return null;
		}
	};

	const getLogColor = (log: LogEntry): string => {
		switch (log.type) {
			case 'activity':
				return 'primary.main';
			case 'scene':
				return 'secondary.main';
			case 'webhook':
				return 'warning.main';
			case 'homeDetection':
				return log.state.toLowerCase() === 'home' ? 'success.main' : 'text.secondary';
			case 'notification':
				return 'info.main';
			case 'temperature':
				return 'error.main';
			case 'tuyaApi':
				return 'info.main';
			default:
				return 'text.secondary';
		}
	};

	const renderLogDetails = (log: LogEntry): React.ReactNode => {
		switch (log.type) {
			case 'activity':
				return (
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
						<Typography variant="caption" color="text.secondary">
							{log.method} {log.endpoint}
						</Typography>
						{log.params && (
							<Box>
								<Typography variant="caption" fontWeight="bold">
									Params:
								</Typography>
								<Box
									sx={{
										bgcolor: 'action.hover',
										p: 1,
										borderRadius: 1,
										fontFamily: 'monospace',
										fontSize: '0.75rem',
										overflow: 'auto',
										maxHeight: 100,
									}}
								>
									<pre style={{ margin: 0 }}>
										{JSON.stringify(JSON.parse(log.params), null, 2)}
									</pre>
								</Box>
							</Box>
						)}
						{log.body && (
							<Box>
								<Typography variant="caption" fontWeight="bold">
									Body:
								</Typography>
								<Box
									sx={{
										bgcolor: 'action.hover',
										p: 1,
										borderRadius: 1,
										fontFamily: 'monospace',
										fontSize: '0.75rem',
										overflow: 'auto',
										maxHeight: 150,
									}}
								>
									<pre style={{ margin: 0 }}>
										{JSON.stringify(JSON.parse(log.body), null, 2)}
									</pre>
								</Box>
							</Box>
						)}
					</Box>
				);
			case 'webhook':
				return (
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
						<Box>
							<Typography variant="caption" fontWeight="bold">
								Request Body:
							</Typography>
							<Box
								sx={{
									bgcolor: 'action.hover',
									p: 1,
									borderRadius: 1,
									fontFamily: 'monospace',
									fontSize: '0.75rem',
									overflow: 'auto',
									maxHeight: 150,
								}}
							>
								<pre style={{ margin: 0 }}>{JSON.stringify(log.body, null, 2)}</pre>
							</Box>
						</Box>
					</Box>
				);
			case 'notification':
				return (
					<Typography variant="body2" color="text.secondary">
						{log.body}
					</Typography>
				);
			case 'temperature':
				return (
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
						<Typography variant="body2" color="text.secondary">
							{log.details}
						</Typography>
						{(log.previousState || log.newState) && (
							<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
								{log.previousState && (
									<Box>
										<Typography
											variant="caption"
											fontWeight="bold"
											color="text.secondary"
										>
											Previous State:
										</Typography>
										<Box
											sx={{
												bgcolor: 'action.hover',
												p: 1,
												borderRadius: 1,
												fontFamily: 'monospace',
												fontSize: '0.75rem',
												overflow: 'auto',
												maxHeight: 100,
											}}
										>
											<pre style={{ margin: 0 }}>
												{typeof log.previousState === 'string'
													? JSON.stringify(
															JSON.parse(log.previousState),
															null,
															2
														)
													: JSON.stringify(log.previousState, null, 2)}
											</pre>
										</Box>
									</Box>
								)}
								{log.newState && (
									<Box>
										<Typography
											variant="caption"
											fontWeight="bold"
											color="text.secondary"
										>
											New State:
										</Typography>
										<Box
											sx={{
												bgcolor: 'action.hover',
												p: 1,
												borderRadius: 1,
												fontFamily: 'monospace',
												fontSize: '0.75rem',
												overflow: 'auto',
												maxHeight: 100,
											}}
										>
											<pre style={{ margin: 0 }}>
												{typeof log.newState === 'string'
													? JSON.stringify(
															JSON.parse(log.newState),
															null,
															2
														)
													: JSON.stringify(log.newState, null, 2)}
											</pre>
										</Box>
									</Box>
								)}
							</Box>
						)}
					</Box>
				);
			case 'tuyaApi':
				return renderTuyaApiDetails(log);
			default:
				return null;
		}
	};

	const hasDetails = (log: LogEntry): boolean => {
		switch (log.type) {
			case 'activity':
				return !!(log.params || log.body);
			case 'webhook':
				return true;
			case 'notification':
				return !!log.body;
			case 'temperature':
				return !!(log.previousState || log.newState);
			case 'tuyaApi':
				return !!log.device_id;
			default:
				return false;
		}
	};

	const renderTuyaApiDetails = (log: TuyaApiLogEntry): React.ReactNode => (
		<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
			<Typography variant="caption" color="text.secondary">
				Source: {log.source} · Endpoint: {log.endpoint}
			</Typography>
			{log.device_id && (
				<Typography variant="caption" color="text.secondary">
					Device ID: {log.device_id}
				</Typography>
			)}
		</Box>
	);

	return (
		<Box sx={{ p: { xs: 2, sm: 3 } }}>
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
				{/* Header */}
				<Box
					sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
				>
					<Typography variant="h5">Activity Logs</Typography>
					<IconButton onClick={() => void loadLogs()} disabled={loading}>
						<RefreshIcon />
					</IconButton>
				</Box>

				{/* Filters */}
				<Card sx={{ borderRadius: 2 }}>
					<CardContent sx={{ py: 1.5 }}>
						<Typography variant="subtitle2" sx={{ mb: 1 }}>
							Show logs for:
						</Typography>
						<FormGroup row sx={{ flexWrap: 'wrap', gap: 1 }}>
							{(
								Object.entries(LOG_TYPE_CONFIG) as [
									LogType,
									(typeof LOG_TYPE_CONFIG)[LogType],
								][]
							).map(([type, config]) => (
								<FormControlLabel
									key={type}
									control={
										<Checkbox
											size="small"
											checked={enabledTypes[type]}
											onChange={() => handleTypeToggle(type)}
										/>
									}
									label={
										<Box
											sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
										>
											{config.icon}
											<Typography variant="body2">{config.label}</Typography>
										</Box>
									}
								/>
							))}
						</FormGroup>
						{/* Source filters for temperature logs */}
						{enabledTypes.temperature && enabledSources.size > 0 && (
							<>
								<Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
									Temperature sources:
								</Typography>
								<FormGroup row sx={{ flexWrap: 'wrap', gap: 1 }}>
									{Array.from(enabledSources)
										.sort()
										.map((source) => (
											<FormControlLabel
												key={source}
												control={
													<Checkbox
														size="small"
														checked={enabledSources.has(source)}
														onChange={() => handleSourceToggle(source)}
													/>
												}
												label={
													<Typography
														variant="body2"
														sx={{ textTransform: 'capitalize' }}
													>
														{source.replace(/-/g, ' ')}
													</Typography>
												}
											/>
										))}
								</FormGroup>
							</>
						)}
						{/* Source filters for Tuya API logs */}
						{enabledTypes.tuyaApi && Object.keys(tuyaCountBySource).length > 0 && (
							<>
								<Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
									Tuya API sources:
								</Typography>
								<FormGroup row sx={{ flexWrap: 'wrap', gap: 1 }}>
									{Object.entries(tuyaCountBySource)
										.sort(([a], [b]) => a.localeCompare(b))
										.map(([source, count]) => (
											<FormControlLabel
												key={source}
												control={
													<Checkbox
														size="small"
														checked={
															enabledTuyaSources.size === 0 ||
															enabledTuyaSources.has(source)
														}
														onChange={() =>
															handleTuyaSourceToggle(source)
														}
													/>
												}
												label={
													<Typography variant="body2">
														{source.replace(/-/g, ' ')} ({count})
													</Typography>
												}
											/>
										))}
								</FormGroup>
							</>
						)}
					</CardContent>
				</Card>

				{/* Tuya API summary card */}
				{enabledTypes.tuyaApi && Object.keys(tuyaCountBySource).length > 0 && (
					<Card sx={{ borderRadius: 2 }}>
						<CardContent sx={{ py: 1.5 }}>
							<Typography variant="subtitle2" sx={{ mb: 1 }}>
								Tuya API call totals
							</Typography>
							<Box
								sx={{
									display: 'flex',
									flexWrap: 'wrap',
									gap: 2,
									alignItems: 'center',
								}}
							>
								<Typography variant="body2" fontWeight="bold">
									Total:{' '}
									{Object.values(tuyaCountBySource).reduce((a, b) => a + b, 0)}
								</Typography>
								{Object.entries(tuyaCountBySource)
									.sort(([a], [b]) => a.localeCompare(b))
									.map(([source, count]) => (
										<Chip
											key={source}
											label={`${source}: ${count}`}
											size="small"
											variant="outlined"
										/>
									))}
							</Box>
						</CardContent>
					</Card>
				)}

				{/* Logs List */}
				{loading ? (
					<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
						<CircularProgress />
					</Box>
				) : filteredLogs.length === 0 ? (
					<Card sx={{ borderRadius: 2 }}>
						<CardContent>
							<Typography variant="body2" color="text.secondary" textAlign="center">
								No logs found. Try enabling more log types above.
							</Typography>
						</CardContent>
					</Card>
				) : (
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
						{filteredLogs.map((log) => {
							const details = renderLogDetails(log);
							const showDetails = hasDetails(log);

							if (showDetails) {
								return (
									<Accordion key={log.id} sx={{ borderRadius: 2 }} disableGutters>
										<AccordionSummary expandIcon={<ExpandMoreIcon />}>
											<Box
												sx={{
													display: 'flex',
													alignItems: 'center',
													gap: 2,
													width: '100%',
													pr: 2,
												}}
											>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														width: 36,
														height: 36,
														borderRadius: 1,
														bgcolor: 'action.hover',
														color: getLogColor(log),
														flexShrink: 0,
													}}
												>
													{getLogIcon(log)}
												</Box>
												<Box sx={{ flex: 1, minWidth: 0 }}>
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															gap: 1,
															flexWrap: 'wrap',
														}}
													>
														{getLogTitle(log)}
														{log.type === 'scene' && (
															<>
																{log.success ? (
																	<CheckCircleIcon
																		sx={{
																			fontSize: 16,
																			color: 'success.main',
																		}}
																	/>
																) : (
																	<ErrorIcon
																		sx={{
																			fontSize: 16,
																			color: 'error.main',
																		}}
																	/>
																)}
															</>
														)}
														{log.type === 'notification' && (
															<>
																{log.success ? (
																	<CheckCircleIcon
																		sx={{
																			fontSize: 16,
																			color: 'success.main',
																		}}
																	/>
																) : (
																	<ErrorIcon
																		sx={{
																			fontSize: 16,
																			color: 'error.main',
																		}}
																	/>
																)}
															</>
														)}
													</Box>
													{getLogSubtitle(log) && (
														<Typography
															variant="caption"
															color="text.secondary"
														>
															{getLogSubtitle(log)}
														</Typography>
													)}
												</Box>
												<Chip
													label={LOG_TYPE_CONFIG[log.type].label}
													size="small"
													variant="outlined"
													sx={{ flexShrink: 0 }}
												/>
												<Typography
													variant="caption"
													color="text.secondary"
													sx={{
														flexShrink: 0,
														minWidth: 80,
														textAlign: 'right',
													}}
												>
													{formatTimestamp(log.timestamp)}
												</Typography>
											</Box>
										</AccordionSummary>
										<AccordionDetails>{details}</AccordionDetails>
									</Accordion>
								);
							}

							return (
								<Card key={log.id} sx={{ borderRadius: 2 }}>
									<CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
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
													width: 36,
													height: 36,
													borderRadius: 1,
													bgcolor: 'action.hover',
													color: getLogColor(log),
													flexShrink: 0,
												}}
											>
												{getLogIcon(log)}
											</Box>
											<Box sx={{ flex: 1, minWidth: 0 }}>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														gap: 1,
														flexWrap: 'wrap',
													}}
												>
													{getLogTitle(log)}
													{log.type === 'scene' && (
														<>
															{log.success ? (
																<CheckCircleIcon
																	sx={{
																		fontSize: 16,
																		color: 'success.main',
																	}}
																/>
															) : (
																<ErrorIcon
																	sx={{
																		fontSize: 16,
																		color: 'error.main',
																	}}
																/>
															)}
														</>
													)}
												</Box>
												{getLogSubtitle(log) && (
													<Typography
														variant="caption"
														color="text.secondary"
													>
														{getLogSubtitle(log)}
													</Typography>
												)}
											</Box>
											<Chip
												label={LOG_TYPE_CONFIG[log.type].label}
												size="small"
												variant="outlined"
												sx={{ flexShrink: 0 }}
											/>
											<Typography
												variant="caption"
												color="text.secondary"
												sx={{
													flexShrink: 0,
													minWidth: 80,
													textAlign: 'right',
												}}
											>
												{formatTimestamp(log.timestamp)}
											</Typography>
										</Box>
									</CardContent>
								</Card>
							);
						})}
					</Box>
				)}
			</Box>
		</Box>
	);
};
