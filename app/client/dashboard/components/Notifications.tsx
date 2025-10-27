import {
	Box,
	Typography,
	Card,
	CardContent,
	Button,
	Switch,
	FormControlLabel,
	IconButton,
	Chip,
	Alert,
	CircularProgress,
	List,
	ListItem,
	ListItemText,
	ListItemSecondaryAction,
	Divider,
} from '@mui/material';
import {
	Notifications as NotificationsIcon,
	Delete as DeleteIcon,
	Send as SendIcon,
} from '@mui/icons-material';
import type { PushSubscription, NotificationSettings } from '../../../../types/notification';
import { NotificationType } from '../../../../types/notification';
import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';

export const Notifications = (): JSX.Element => {
	const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
	const [settings, setSettings] = useState<NotificationSettings | null>(null);
	const [currentSubscription, setCurrentSubscription] = useState<PushSubscription | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [pushSupported, setPushSupported] = useState(false);
	const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

	useEffect(() => {
		// Check if push notifications are supported
		const supported =
			'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
		setPushSupported(supported);

		if (supported) {
			setPushPermission(Notification.permission);
		}

		void loadData();
	}, []);

	const loadData = async () => {
		try {
			console.log('loadData');
			setLoading(true);
			setError(null);

			// Load subscriptions
			console.log('loadData subscriptions');
			const subsResponse = await apiGet('notification', '/subscriptions', {});
			console.log('loadData subscriptions response', subsResponse);
			if (subsResponse.ok) {
				const data = await subsResponse.json();
				setSubscriptions(data.subscriptions || []);

				// Check if current browser is subscribed
				console.log('loadData check if current browser is subscribed');
				if ('serviceWorker' in navigator) {
					console.log('loadData get service worker');
					const registration = await navigator.serviceWorker.ready;
					console.log('loadData get service worker done');
					const subscription = await registration.pushManager.getSubscription();
					console.log('loadData get subscription done');
					if (subscription) {
						// Find matching subscription
						const match = data.subscriptions.find(
							(sub: PushSubscription) => sub.endpoint === subscription.endpoint
						);
						setCurrentSubscription(match || null);
					}
				}
				console.log('loadData check if current browser is subscribed done');
			}

			console.log('loadData settings');
			// Load settings
			const settingsResponse = await apiGet('notification', '/settings', {});
			if (settingsResponse.ok) {
				const data = await settingsResponse.json();
				setSettings(data.settings);
			}
			console.log('loadData settings done');
		} catch (err) {
			console.error('Failed to load notifications data:', err);
			setError('Failed to load notification settings');
		} finally {
			console.log('loadData finally');
			setLoading(false);
		}
	};

	const requestPermission = async () => {
		if (!pushSupported) {
			setError('Push notifications are not supported in this browser');
			return;
		}

		try {
			const permission = await Notification.requestPermission();
			setPushPermission(permission);

			if (permission === 'granted') {
				setSuccess('Notification permission granted!');
				await registerPush();
			} else {
				setError('Notification permission denied');
			}
		} catch (err) {
			console.error('Error requesting permission:', err);
			setError('Failed to request notification permission');
		}
	};

	const registerPush = async () => {
		try {
			setLoading(true);
			setError(null);

			// Get VAPID public key
			const keyResponse = await apiGet('notification', '/vapid-public-key', {});
			if (!keyResponse.ok) {
				throw new Error('Failed to get VAPID key');
			}
			const keyData = await keyResponse.json();

			// Register service worker
			const registration = await navigator.serviceWorker.ready;

			// Subscribe to push
			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
			});

			// Send subscription to server
			const subscriptionObject = subscription.toJSON();
			const registerResponse = await apiPost(
				'notification',
				'/register',
				{},
				{
					endpoint: subscriptionObject.endpoint!,
					keys: {
						p256dh: subscriptionObject.keys!.p256dh!,
						auth: subscriptionObject.keys!.auth!,
					},
					userAgent: navigator.userAgent,
				}
			);

			if (registerResponse.ok) {
				const data = await registerResponse.json();
				setCurrentSubscription(data.subscription);
				setSuccess('Successfully registered for push notifications!');
				await loadData();
			} else {
				throw new Error('Failed to register subscription');
			}
		} catch (err) {
			console.error('Error registering push:', err);
			setError('Failed to register for push notifications');
		} finally {
			setLoading(false);
		}
	};

	const unregisterSubscription = async (id: string) => {
		try {
			setError(null);
			const response = await apiPost('notification', '/:id/unregister', { id }, undefined);

			if (response.ok) {
				setSuccess('Subscription removed');
				if (currentSubscription?.id === id) {
					setCurrentSubscription(null);
				}
				await loadData();
			} else {
				throw new Error('Failed to remove subscription');
			}
		} catch (err) {
			console.error('Error removing subscription:', err);
			setError('Failed to remove subscription');
		}
	};

	const toggleSubscription = async (id: string, enabled: boolean) => {
		try {
			setError(null);
			const response = await apiPost('notification', '/:id/toggle', { id }, { enabled });

			if (response.ok) {
				setSuccess(enabled ? 'Subscription enabled' : 'Subscription disabled');
				await loadData();
			} else {
				throw new Error('Failed to toggle subscription');
			}
		} catch (err) {
			console.error('Error toggling subscription:', err);
			setError('Failed to update subscription');
		}
	};

	const sendTestNotification = async (id: string) => {
		try {
			setError(null);
			const response = await apiPost('notification', '/:id/test', { id }, undefined);

			if (response.ok) {
				setSuccess('Test notification sent!');
			} else {
				throw new Error('Failed to send test notification');
			}
		} catch (err) {
			console.error('Error sending test:', err);
			setError('Failed to send test notification');
		}
	};

	const updateNotificationSettings = async (type: NotificationType, enabled: boolean) => {
		try {
			setError(null);
			const newSettings = {
				...settings,
				[type]: enabled,
			};

			const response = await apiPost('notification', '/settings', {}, newSettings);

			if (response.ok) {
				const data = await response.json();
				setSettings(data.settings);
				setSuccess('Settings updated');
			} else {
				throw new Error('Failed to update settings');
			}
		} catch (err) {
			console.error('Error updating settings:', err);
			setError('Failed to update notification settings');
		}
	};

	function urlBase64ToUint8Array(base64String: string): Uint8Array {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const rawData = window.atob(base64);
		const outputArray = new Uint8Array(rawData.length);
		for (let i = 0; i < rawData.length; ++i) {
			outputArray[i] = rawData.charCodeAt(i);
		}
		return outputArray;
	}

	if (loading && subscriptions.length === 0) {
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
					alignItems: 'center',
					gap: 2,
					mb: 3,
				}}
			>
				<NotificationsIcon sx={{ fontSize: 32 }} />
				<Typography variant="h4">Push Notifications</Typography>
			</Box>

			{error && (
				<Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
					{error}
				</Alert>
			)}

			{success && (
				<Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
					{success}
				</Alert>
			)}

			{!pushSupported && (
				<Alert severity="warning" sx={{ mb: 3 }}>
					Push notifications are not supported in this browser.
				</Alert>
			)}

			{/* Registration Section */}
			<Card sx={{ mb: 3, borderRadius: 2 }}>
				<CardContent>
					<Typography variant="h6" sx={{ mb: 2 }}>
						This Device
					</Typography>

					{currentSubscription ? (
						<Box>
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
								<Chip
									label={currentSubscription.enabled ? 'Enabled' : 'Disabled'}
									color={currentSubscription.enabled ? 'success' : 'default'}
									size="small"
								/>
								<Typography variant="body2" color="text.secondary">
									Registered on{' '}
									{new Date(currentSubscription.createdAt).toLocaleString()}
								</Typography>
							</Box>
							<Box sx={{ display: 'flex', gap: 1 }}>
								<Button
									variant="outlined"
									startIcon={<SendIcon />}
									onClick={() => sendTestNotification(currentSubscription.id)}
									size="small"
								>
									Send Test
								</Button>
								<Button
									variant="outlined"
									color="error"
									startIcon={<DeleteIcon />}
									onClick={() => unregisterSubscription(currentSubscription.id)}
									size="small"
								>
									Unregister
								</Button>
							</Box>
						</Box>
					) : (
						<Box>
							<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
								Register this device to receive push notifications when events
								occur.
							</Typography>
							<Button
								variant="contained"
								onClick={
									pushPermission === 'granted' ? registerPush : requestPermission
								}
								disabled={!pushSupported || loading}
								startIcon={<NotificationsIcon />}
							>
								{pushPermission === 'granted'
									? 'Register This Device'
									: 'Enable Notifications'}
							</Button>
						</Box>
					)}
				</CardContent>
			</Card>

			{/* All Subscriptions */}
			<Card sx={{ mb: 3, borderRadius: 2 }}>
				<CardContent>
					<Typography variant="h6" sx={{ mb: 2 }}>
						All Registered Devices
					</Typography>

					{subscriptions.length === 0 ? (
						<Typography variant="body2" color="text.secondary">
							No devices registered for notifications yet.
						</Typography>
					) : (
						<List>
							{subscriptions.map((sub, index) => (
								<React.Fragment key={sub.id}>
									{index > 0 && <Divider />}
									<ListItem>
										<ListItemText
											primary={
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														gap: 1,
													}}
												>
													<Typography>
														{sub.userAgent
															? sub.userAgent.substring(0, 50) + '...'
															: 'Device'}
													</Typography>
													{sub.id === currentSubscription?.id && (
														<Chip
															label="This Device"
															size="small"
															color="primary"
														/>
													)}
												</Box>
											}
											secondary={`Registered ${new Date(sub.createdAt).toLocaleString()}`}
										/>
										<ListItemSecondaryAction
											sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
										>
											<FormControlLabel
												control={
													<Switch
														checked={sub.enabled}
														onChange={(e) =>
															toggleSubscription(
																sub.id,
																e.target.checked
															)
														}
													/>
												}
												label=""
											/>
											<IconButton
												edge="end"
												onClick={() => sendTestNotification(sub.id)}
												disabled={!sub.enabled}
											>
												<SendIcon />
											</IconButton>
											<IconButton
												edge="end"
												onClick={() => unregisterSubscription(sub.id)}
												sx={{ color: 'error.main' }}
											>
												<DeleteIcon />
											</IconButton>
										</ListItemSecondaryAction>
									</ListItem>
								</React.Fragment>
							))}
						</List>
					)}
				</CardContent>
			</Card>

			{/* Notification Settings */}
			{settings && (
				<Card sx={{ borderRadius: 2 }}>
					<CardContent>
						<Typography variant="h6" sx={{ mb: 2 }}>
							Notification Preferences
						</Typography>

						<FormControlLabel
							control={
								<Switch
									checked={settings[NotificationType.DOOR_SENSOR_NO_DEVICE]}
									onChange={(e) =>
										updateNotificationSettings(
											NotificationType.DOOR_SENSOR_NO_DEVICE,
											e.target.checked
										)
									}
								/>
							}
							label={
								<Box>
									<Typography>Door sensor triggered</Typography>
									<Typography variant="caption" color="text.secondary">
										Notify when a door sensor is triggered but no recognized
										devices come home
									</Typography>
								</Box>
							}
						/>
					</CardContent>
				</Card>
			)}
		</Box>
	);
};
