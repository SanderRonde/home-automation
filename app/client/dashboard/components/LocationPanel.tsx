import {
	Box,
	Card,
	CardContent,
	Typography,
	IconButton,
	Button,
	CircularProgress,
	Accordion,
	AccordionSummary,
	AccordionDetails,
	TextField,
	Alert,
	Divider,
	Dialog,
	DialogTitle,
	DialogContent,
} from '@mui/material';
import {
	Add as AddIcon,
	Delete as DeleteIcon,
	Edit as EditIcon,
	Refresh as RefreshIcon,
	MyLocation as MyLocationIcon,
	Info as InfoIcon,
	ExpandMore as ExpandMoreIcon,
	Map as MapIcon,
} from '@mui/icons-material';
import type {
	LocationTargetWithStatus,
	LocationDevice,
} from '../../../server/modules/location/types';
import { haversineDistance, formatDistance } from '../../lib/location-utils';
import { apiGet, apiPost, apiDelete } from '../../lib/fetch';
import React, { useState, useEffect, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';

// Dynamic import for react-leaflet to handle ESM module
let MapContainer: React.ComponentType<any>;
let TileLayer: React.ComponentType<any>;
let Marker: React.ComponentType<any>;
let Popup: React.ComponentType<any>;
let L: any;

// Lazy load leaflet and react-leaflet
const loadLeaflet = async () => {
	if (!MapContainer) {
		const leaflet = await import('leaflet');
		L = leaflet.default;
		// Fix for default marker icons in Leaflet with bundlers
		delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
		L.Icon.Default.mergeOptions({
			iconRetinaUrl:
				'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
			iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
			shadowUrl:
				'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
		});
		const reactLeaflet = await import('react-leaflet');
		MapContainer = reactLeaflet.MapContainer;
		TileLayer = reactLeaflet.TileLayer;
		Marker = reactLeaflet.Marker;
		Popup = reactLeaflet.Popup;
	}
};

interface TargetEditDialogProps {
	open: boolean;
	onClose: () => void;
	onSave: (target: {
		id: string;
		name: string;
		coordinates: { latitude: number; longitude: number };
	}) => void;
	existingTarget?: LocationTargetWithStatus;
}

const TargetEditDialog = (props: TargetEditDialogProps): JSX.Element => {
	const [id, setId] = useState(props.existingTarget?.id ?? '');
	const [name, setName] = useState(props.existingTarget?.name ?? '');
	const [lat, setLat] = useState(props.existingTarget?.coordinates.latitude.toString() ?? '');
	const [lon, setLon] = useState(props.existingTarget?.coordinates.longitude.toString() ?? '');

	useEffect(() => {
		if (props.existingTarget) {
			setId(props.existingTarget.id);
			setName(props.existingTarget.name);
			setLat(props.existingTarget.coordinates.latitude.toString());
			setLon(props.existingTarget.coordinates.longitude.toString());
		} else {
			setId('');
			setName('');
			setLat('');
			setLon('');
		}
	}, [props.existingTarget, props.open]);

	const handleSave = () => {
		const latitude = parseFloat(lat);
		const longitude = parseFloat(lon);

		if (isNaN(latitude) || latitude < -90 || latitude > 90) {
			alert('Latitude must be between -90 and 90');
			return;
		}
		if (isNaN(longitude) || longitude < -180 || longitude > 180) {
			alert('Longitude must be between -180 and 180');
			return;
		}
		if (!id.trim() || !name.trim()) {
			alert('ID and name are required');
			return;
		}

		props.onSave({
			id: id.trim(),
			name: name.trim(),
			coordinates: { latitude, longitude },
		});
	};

	const getCurrentLocation = () => {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setLat(position.coords.latitude.toString());
					setLon(position.coords.longitude.toString());
				},
				(err) => {
					alert(`Failed to get current location: ${err.message}`);
				}
			);
		} else {
			alert('Geolocation is not supported by your browser');
		}
	};

	if (!props.open) {
		return <></>;
	}

	return (
		<Box
			sx={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: 'rgba(0, 0, 0, 0.5)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 1300,
			}}
			onClick={props.onClose}
		>
			<Card sx={{ minWidth: 400, maxWidth: 600, p: 2 }} onClick={(e) => e.stopPropagation()}>
				<CardContent>
					<Typography variant="h6" gutterBottom>
						{props.existingTarget ? 'Edit Target' : 'Create Target'}
					</Typography>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
						<TextField
							label="ID"
							value={id}
							onChange={(e) => setId(e.target.value)}
							fullWidth
							size="small"
							disabled={!!props.existingTarget}
							helperText="Unique identifier (alphanumeric with hyphens/underscores)"
						/>
						<TextField
							label="Name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							fullWidth
							size="small"
						/>
						<Box sx={{ display: 'flex', gap: 1 }}>
							<TextField
								label="Latitude"
								type="number"
								value={lat}
								onChange={(e) => setLat(e.target.value)}
								fullWidth
								size="small"
								inputProps={{ step: '0.000001', min: -90, max: 90 }}
							/>
							<TextField
								label="Longitude"
								type="number"
								value={lon}
								onChange={(e) => setLon(e.target.value)}
								fullWidth
								size="small"
								inputProps={{ step: '0.000001', min: -180, max: 180 }}
							/>
							<IconButton onClick={getCurrentLocation} title="Use current location">
								<MyLocationIcon />
							</IconButton>
						</Box>
						<Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
							<Button onClick={props.onClose}>Cancel</Button>
							<Button variant="contained" onClick={handleSave}>
								Save
							</Button>
						</Box>
					</Box>
				</CardContent>
			</Card>
		</Box>
	);
};

interface MapViewProps {
	devices: LocationDevice[];
	targets: LocationTargetWithStatus[];
	center?: [number, number];
	zoom?: number;
}

const MapView = ({ devices, targets, center, zoom = 13 }: MapViewProps): JSX.Element => {
	const [mapLoaded, setMapLoaded] = useState(false);

	useEffect(() => {
		void loadLeaflet().then(() => {
			setMapLoaded(true);
		});
	}, []);

	const allLocations = useMemo(() => {
		const locations: Array<{
			lat: number;
			lon: number;
			type: 'device' | 'target';
			name: string;
			id: string;
		}> = [];

		devices.forEach((device) => {
			if (device.lastKnownLocation) {
				locations.push({
					lat: device.lastKnownLocation.latitude,
					lon: device.lastKnownLocation.longitude,
					type: 'device',
					name: device.name,
					id: device.id,
				});
			}
		});

		targets.forEach((target) => {
			locations.push({
				lat: target.coordinates.latitude,
				lon: target.coordinates.longitude,
				type: 'target',
				name: target.name,
				id: target.id,
			});
		});

		return locations;
	}, [devices, targets]);

	const mapCenter: [number, number] =
		center ||
		(allLocations.length > 0 ? [allLocations[0].lat, allLocations[0].lon] : [52.3676, 4.9041]); // Default to Amsterdam

	if (!mapLoaded || !MapContainer) {
		return (
			<Box
				sx={{
					height: '500px',
					width: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ height: '500px', width: '100%', borderRadius: 1, overflow: 'hidden' }}>
			<MapContainer center={mapCenter} zoom={zoom} style={{ height: '100%', width: '100%' }}>
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
				/>
				{allLocations.map((location) => (
					<Marker
						key={`${location.type}-${location.id}`}
						position={[location.lat, location.lon]}
					>
						<Popup>
							<strong>{location.name}</strong>
							<br />
							{location.type === 'device' ? 'Device' : 'Target'}
							<br />
							{location.lat.toFixed(6)}, {location.lon.toFixed(6)}
						</Popup>
					</Marker>
				))}
			</MapContainer>
		</Box>
	);
};

interface DistanceMatrixProps {
	devices: LocationDevice[];
	targets: LocationTargetWithStatus[];
}

const DistanceMatrix = ({ devices, targets }: DistanceMatrixProps): JSX.Element => {
	const distances = useMemo(() => {
		const matrix: Array<{
			deviceId: string;
			deviceName: string;
			targetId: string;
			targetName: string;
			distance: number;
		}> = [];

		devices.forEach((device) => {
			if (!device.lastKnownLocation) {
				return;
			}

			targets.forEach((target) => {
				const distance = haversineDistance(
					device.lastKnownLocation!.latitude,
					device.lastKnownLocation!.longitude,
					target.coordinates.latitude,
					target.coordinates.longitude
				);

				matrix.push({
					deviceId: device.id,
					deviceName: device.name,
					targetId: target.id,
					targetName: target.name,
					distance,
				});
			});
		});

		return matrix.sort((a, b) => a.distance - b.distance);
	}, [devices, targets]);

	if (distances.length === 0) {
		return (
			<Card>
				<CardContent>
					<Typography color="text.secondary" align="center">
						No distances to display. Devices need location updates and targets need to
						be configured.
					</Typography>
				</CardContent>
			</Card>
		);
	}

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
			{distances.map((item, idx) => (
				<Card key={`${item.deviceId}-${item.targetId}-${idx}`}>
					<CardContent>
						<Box
							sx={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
							}}
						>
							<Box>
								<Typography variant="body1" fontWeight="bold">
									{item.deviceName} → {item.targetName}
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{item.deviceId} → {item.targetId}
								</Typography>
							</Box>
							<Typography variant="h6" color="primary">
								{formatDistance(item.distance)}
							</Typography>
						</Box>
					</CardContent>
				</Card>
			))}
		</Box>
	);
};

export const LocationPanel = (): JSX.Element => {
	const [targets, setTargets] = useState<LocationTargetWithStatus[]>([]);
	const [devices, setDevices] = useState<LocationDevice[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [editingTarget, setEditingTarget] = useState<LocationTargetWithStatus | undefined>(
		undefined
	);
	const [taskerGuideExpanded, setTaskerGuideExpanded] = useState(false);
	const [mapDialogOpen, setMapDialogOpen] = useState(false);
	const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);

	const loadData = async () => {
		try {
			setError(null);
			const [targetsResponse, devicesResponse] = await Promise.all([
				apiGet('location', '/targets', {}),
				apiGet('location', '/devices', {}),
			]);
			if (targetsResponse.ok) {
				const data = await targetsResponse.json();
				setTargets(data.targets || []);
			} else {
				const errorData = (await targetsResponse.json()) as { error?: string };
				setError(errorData.error || 'Failed to load targets');
			}
			if (devicesResponse.ok) {
				const data = await devicesResponse.json();
				setDevices(data.devices || []);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load data');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadData();
		const interval = setInterval(() => {
			void loadData();
		}, 30000); // Refresh every 30 seconds
		return () => clearInterval(interval);
	}, []);

	const handleCreateTarget = () => {
		setEditingTarget(undefined);
		setEditDialogOpen(true);
	};

	const handleEditTarget = (target: LocationTargetWithStatus) => {
		setEditingTarget(target);
		setEditDialogOpen(true);
	};

	const handleSaveTarget = async (targetData: {
		id: string;
		name: string;
		coordinates: { latitude: number; longitude: number };
	}) => {
		try {
			const response = await apiPost('location', '/targets', {}, targetData);
			if (response.ok) {
				await loadData();
				setEditDialogOpen(false);
			} else {
				const errorData = (await response.json()) as { error?: string };
				alert(errorData.error || 'Failed to save target');
			}
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to save target');
		}
	};

	const handleDeleteTarget = async (targetId: string) => {
		if (!confirm('Are you sure you want to delete this target?')) {
			return;
		}

		try {
			const response = await apiDelete('location', '/targets/:id', { id: targetId });
			if (response.ok) {
				await loadData();
			} else {
				const errorData = (await response.json()) as { error?: string };
				alert(errorData.error || 'Failed to delete target');
			}
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to delete target');
		}
	};

	const getServerUrl = () => {
		return `${window.location.protocol}//${window.location.host}`;
	};

	if (loading) {
		return (
			<Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: 3 }}>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					mb: 3,
				}}
			>
				<Typography variant="h4">Location</Typography>
				<Box sx={{ display: 'flex', gap: 1 }}>
					<IconButton onClick={() => void loadData()}>
						<RefreshIcon />
					</IconButton>
					<Button
						variant="contained"
						startIcon={<AddIcon />}
						onClick={handleCreateTarget}
					>
						Add Target
					</Button>
				</Box>
			</Box>

			{error && (
				<Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}

			{/* Tasker Setup Guide */}
			<Accordion
				expanded={taskerGuideExpanded}
				onChange={(_, exp) => setTaskerGuideExpanded(exp)}
				sx={{ mb: 3 }}
			>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						<InfoIcon />
						<Typography variant="h6">Tasker Setup Guide</Typography>
					</Box>
				</AccordionSummary>
				<AccordionDetails>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
						<Typography variant="body2" color="text.secondary">
							This guide explains how to set up Tasker on Android to automatically
							send location updates.
						</Typography>

						<Divider />

						<Typography variant="subtitle2" fontWeight="bold">
							Step 1: Create a Profile
						</Typography>
						<Typography variant="body2">
							Create a new Tasker profile that triggers every 3-5 minutes (or when
							location changes significantly).
						</Typography>

						<Typography variant="subtitle2" fontWeight="bold">
							Step 2: Create a Task
						</Typography>
						<Typography variant="body2" component="div">
							<ol>
								<li>
									<strong>Get Location:</strong> Add action: Location → Get
									Location
									<br />
									Store result in: <code>%LOCATION</code>
								</li>
								<li>
									<strong>Parse Location:</strong> Add action: Variables →
									Variable Split
									<br />
									Variable: <code>%LOCATION</code>, Splitter: <code>,</code>
									<br />
									This creates <code>%LOCATION1</code> (latitude) and{' '}
									<code>%LOCATION2</code> (longitude)
								</li>
								<li>
									<strong>Send HTTP Request:</strong> Add action: Net → HTTP
									Request
									<br />
									Method: <code>POST</code>
									<br />
									URL: <code>{getServerUrl()}/location/update</code>
									<br />
									Headers: <code>Content-Type: application/json</code>
									<br />
									Body (Raw):
									<pre
										style={{
											backgroundColor: '#f5f5f5',
											padding: '8px',
											borderRadius: '4px',
											marginTop: '4px',
										}}
									>
										{`{
  "deviceId": "my-phone",
  "latitude": %LOCATION1,
  "longitude": %LOCATION2,
  "accuracy": %LOCACC
}`}
									</pre>
								</li>
							</ol>
						</Typography>

						<Typography variant="subtitle2" fontWeight="bold">
							Step 3: Authentication
						</Typography>
						<Typography variant="body2">
							Add a Cookie header with your session cookie. Get it from browser
							developer tools (F12) → Application → Cookies.
						</Typography>

						<Typography variant="subtitle2" fontWeight="bold">
							Step 4: Battery Optimization
						</Typography>
						<Typography variant="body2">
							Disable battery optimization for Tasker in Android Settings → Apps →
							Tasker to ensure it runs reliably.
						</Typography>
					</Box>
				</AccordionDetails>
			</Accordion>

			{/* Devices List */}
			<Box sx={{ mb: 4 }}>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						mb: 2,
					}}
				>
					<Typography variant="h5">Devices</Typography>
				</Box>
				{devices.length === 0 ? (
					<Card>
						<CardContent>
							<Typography color="text.secondary" align="center">
								No devices configured. Devices are automatically created when they
								send location updates.
							</Typography>
						</CardContent>
					</Card>
				) : (
					<Box
						sx={{
							display: 'grid',
							gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
							gap: 2,
						}}
					>
						{devices.map((device) => (
							<Card key={device.id}>
								<CardContent>
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'space-between',
											mb: 2,
										}}
									>
										<Typography variant="h6">{device.name}</Typography>
										<Typography variant="caption" color="text.secondary">
											{device.id}
										</Typography>
									</Box>

									{device.lastKnownLocation ? (
										<>
											<Box sx={{ mb: 2 }}>
												<Typography variant="body2" color="text.secondary">
													Last Known Location
												</Typography>
												<Typography variant="body1">
													{device.lastKnownLocation.latitude.toFixed(6)},{' '}
													{device.lastKnownLocation.longitude.toFixed(6)}
												</Typography>
												<Typography
													variant="caption"
													color="text.secondary"
												>
													{new Date(
														device.lastKnownLocation.timestamp
													).toLocaleString()}
												</Typography>
											</Box>
											<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
												{targets.map((target) => {
													const distance = haversineDistance(
														device.lastKnownLocation!.latitude,
														device.lastKnownLocation!.longitude,
														target.coordinates.latitude,
														target.coordinates.longitude
													);
													return (
														<Box
															key={target.id}
															sx={{
																display: 'flex',
																alignItems: 'center',
																gap: 0.5,
																p: 1,
																bgcolor: 'action.hover',
																borderRadius: 1,
															}}
														>
															<Typography variant="caption">
																{target.name}:{' '}
																<strong>
																	{formatDistance(distance)}
																</strong>
															</Typography>
														</Box>
													);
												})}
											</Box>
											<Button
												size="small"
												startIcon={<MapIcon />}
												onClick={() => {
													setMapCenter([
														device.lastKnownLocation!.latitude,
														device.lastKnownLocation!.longitude,
													]);
													setMapDialogOpen(true);
												}}
												sx={{ mt: 1 }}
											>
												View on Map
											</Button>
										</>
									) : (
										<Typography variant="body2" color="text.secondary">
											No location updates received yet
										</Typography>
									)}
								</CardContent>
							</Card>
						))}
					</Box>
				)}
			</Box>

			<Divider sx={{ my: 3 }} />

			{/* Distance Matrix */}
			<Box sx={{ mb: 4 }}>
				<Typography variant="h5" sx={{ mb: 2 }}>
					Distances
				</Typography>
				<DistanceMatrix devices={devices} targets={targets} />
			</Box>

			<Divider sx={{ my: 3 }} />

			{/* Map View */}
			<Box sx={{ mb: 4 }}>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						mb: 2,
					}}
				>
					<Typography variant="h5">Map View</Typography>
					<Button
						variant="outlined"
						startIcon={<MapIcon />}
						onClick={() => {
							setMapCenter(undefined);
							setMapDialogOpen(true);
						}}
					>
						Open Full Map
					</Button>
				</Box>
				<MapView devices={devices} targets={targets} />
			</Box>

			<Divider sx={{ my: 3 }} />

			{/* Targets List */}
			<Box>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						mb: 2,
					}}
				>
					<Typography variant="h5">Targets (Places)</Typography>
				</Box>
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
					{targets.length === 0 ? (
						<Card>
							<CardContent>
								<Typography color="text.secondary" align="center">
									No targets configured. Create one to start tracking locations.
								</Typography>
							</CardContent>
						</Card>
					) : (
						<Box
							sx={{
								display: 'grid',
								gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
								gap: 2,
							}}
						>
							{targets.map((target) => (
								<Card key={target.id}>
									<CardContent>
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'space-between',
												mb: 2,
											}}
										>
											<Typography variant="h6">{target.name}</Typography>
											<Box>
												<IconButton
													size="small"
													onClick={() => handleEditTarget(target)}
												>
													<EditIcon />
												</IconButton>
												<IconButton
													size="small"
													onClick={() =>
														void handleDeleteTarget(target.id)
													}
												>
													<DeleteIcon />
												</IconButton>
											</Box>
										</Box>

										<Box sx={{ mb: 2 }}>
											<Typography variant="body2" color="text.secondary">
												Target Point
											</Typography>
											<Typography variant="body1">
												{target.coordinates.latitude.toFixed(6)},{' '}
												{target.coordinates.longitude.toFixed(6)}
											</Typography>
										</Box>
										<Box
											sx={{
												display: 'flex',
												gap: 1,
												flexWrap: 'wrap',
												mb: 1,
											}}
										>
											{devices
												.filter((d) => d.lastKnownLocation)
												.map((device) => {
													const distance = haversineDistance(
														device.lastKnownLocation!.latitude,
														device.lastKnownLocation!.longitude,
														target.coordinates.latitude,
														target.coordinates.longitude
													);
													return (
														<Box
															key={device.id}
															sx={{
																display: 'flex',
																alignItems: 'center',
																gap: 0.5,
																p: 1,
																bgcolor: 'action.hover',
																borderRadius: 1,
															}}
														>
															<Typography variant="caption">
																{device.name}:{' '}
																<strong>
																	{formatDistance(distance)}
																</strong>
															</Typography>
														</Box>
													);
												})}
										</Box>
										<Button
											size="small"
											startIcon={<MapIcon />}
											onClick={() => {
												setMapCenter([
													target.coordinates.latitude,
													target.coordinates.longitude,
												]);
												setMapDialogOpen(true);
											}}
										>
											View on Map
										</Button>
									</CardContent>
								</Card>
							))}
						</Box>
					)}
				</Box>
			</Box>

			<TargetEditDialog
				open={editDialogOpen}
				onClose={() => setEditDialogOpen(false)}
				onSave={handleSaveTarget}
				existingTarget={editingTarget}
			/>

			<Dialog
				open={mapDialogOpen}
				onClose={() => setMapDialogOpen(false)}
				maxWidth="lg"
				fullWidth
			>
				<DialogTitle>Location Map</DialogTitle>
				<DialogContent>
					<MapView
						devices={devices}
						targets={targets}
						center={mapCenter}
						zoom={mapCenter ? 15 : 13}
					/>
				</DialogContent>
			</Dialog>
		</Box>
	);
};
