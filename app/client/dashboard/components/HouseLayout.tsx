import {
	Edit as EditIcon,
	Visibility as VisibilityIcon,
	Save as SaveIcon,
	ZoomIn as ZoomInIcon,
	ZoomOut as ZoomOutIcon,
	CenterFocusStrong as CenterIcon,
	MeetingRoom as DoorIcon,
	Apartment as RoomIcon,
	Image as ImageIcon,
	Close as CloseIcon,
	FileDownload as FileDownloadIcon,
	FileUpload as FileUploadIcon,
	DevicesOther as DevicesIcon,
	PhotoCamera as PhotoCameraIcon,
	LocationOn as LocationOnIcon,
	MyLocation as MyLocationIcon,
} from '@mui/icons-material';
import {
	Box,
	Button,
	ToggleButton,
	ToggleButtonGroup,
	Paper,
	Typography,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	IconButton,
	Tooltip,
	Autocomplete,
	TextField,
	Alert,
	Snackbar,
} from '@mui/material';
import type {
	Point,
	WallSegment,
	DoorSlot,
	HouseLayout as HouseLayoutType,
	FloorplanAlignment,
} from '../types/layout';
import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import { Circle, Image as KonvaImage, Layer, Line, Stage, Text } from 'react-konva';
import { useDeviceStates, useFloorplanRender } from '../lib/useFloorplanRender';
import { FloorplanAlignmentPanel } from './layout/FloorplanAlignmentPanel';
import type { FloorPlanDeviceState } from '../lib/useFloorplanRender';
import { FloorplanBackground } from './layout/FloorplanBackground';
import { DevicePreviewPanel } from './layout/DevicePreviewPanel';
import type { DeviceGroup } from '../../../../types/group';
// @ts-expect-error - konva ESM/CommonJS type resolution issue
import type { Stage as StageType } from 'konva/lib/Stage';
import type { RoomInfo } from './RoomAssignmentDialog';
// @ts-expect-error - konva ESM/CommonJS type resolution issue
import type { KonvaEventObject } from 'konva/lib/Node';
import { detectRooms } from '../lib/room-detection';
import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import { DrawMode } from '../types/layout';
import useImage from 'use-image';

export const HouseLayout = (): JSX.Element => {
	// Drawing
	const [wallDrawStartPoint, setWallDrawStartPoint] = useState<Point | null>(null);
	const [wallDrawEndPoint, setWallDrawEndPoint] = useState<Point | null>(null);
	const [wallRedoStack, SetWallRedoStack] = useState<WallSegment[]>([]);

	// Painting doors
	const [doorDrawStartPoint, setDoorDrawStartPoint] = useState<{
		point: Point;
		wallId: string;
	} | null>(null);
	const [doorDrawEndPoint, setDoorDrawEndPoint] = useState<{
		point: Point;
		wallId: string;
	} | null>(null);
	const [doorRedoStack, setDoorRedoStack] = useState<DoorSlot[]>([]);

	const [mode, setMode] = useState<DrawMode>(DrawMode.VIEW);
	const [walls, setWalls] = useState<WallSegment[]>([]);
	const [doors, setDoors] = useState<DoorSlot[]>([]);
	const [roomMappings, setRoomMappings] = useState<Record<string, string>>({});
	const [availableRooms, setAvailableRooms] = useState<Record<string, RoomInfo>>({});
	const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
	const [selectedRoomName, setSelectedRoomName] = useState<string>('');
	const [selectedPolygonId, setSelectedPolygonId] = useState<string>('');

	// Background image state (non-persistent)
	const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
	const [backgroundImage] = useImage(backgroundImageUrl || '');

	// Floorplan preview state
	const [floorplanAlignment, setFloorplanAlignment] = useState<FloorplanAlignment>({
		x: 0,
		y: 0,
		scale: 1,
		rotation: 0,
	});
	const [floorplanPreviewStates, setFloorplanPreviewStates] = useState<
		Record<string, FloorPlanDeviceState>
	>({});
	const [floorplanRenderInfo, setFloorplanRenderInfo] = useState<{
		hasRenders: boolean;
		lightIds: string[];
		timeFolders: string[];
	}>({ hasRenders: false, lightIds: [], timeFolders: [] });
	const [selectedTimeFolder, setSelectedTimeFolder] = useState<string | null>(null);

	// Import/Export state
	const [importError, setImportError] = useState<string | null>(null);

	// Device/Group placement state
	const [devices, setDevices] = useState<DeviceListWithValuesResponse>([]);
	const [groups, setGroups] = useState<DeviceGroup[]>([]);
	const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
	const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
	const [placementSnackbar, setPlacementSnackbar] = useState<{
		open: boolean;
		message: string;
		severity: 'success' | 'error' | 'info';
	}>({ open: false, message: '', severity: 'success' });

	// Location config state
	const [locationDialogOpen, setLocationDialogOpen] = useState(false);
	const [location, setLocation] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const [locationInput, setLocationInput] = useState<{
		latitude: string;
		longitude: string;
	}>({ latitude: '', longitude: '' });
	const [locationLoading, setLocationLoading] = useState(false);
	const [locationError, setLocationError] = useState<string | null>(null);
	const [locationSuccess, setLocationSuccess] = useState(false);

	const loadLayout = async () => {
		try {
			const response = await apiGet('device', '/layout', {});
			if (response.ok) {
				const data = await response.json();
				if (data.layout) {
					setWalls(data.layout.walls || []);
					setDoors(data.layout.doors || []);
					setRoomMappings(data.layout.roomMappings || {});
					if (data.layout.floorplanAlignment) {
						setFloorplanAlignment(data.layout.floorplanAlignment);
					}
				}
			}
		} catch (error) {
			console.error('Failed to load layout:', error);
		}
	};

	const loadRooms = React.useCallback(async () => {
		try {
			const response = await apiGet('device', '/rooms', {});
			if (response.ok) {
				const data = await response.json();
				setAvailableRooms(data.rooms);
			}
		} catch (error) {
			console.error('Failed to load rooms:', error);
		}
	}, []);

	const loadDevices = React.useCallback(async () => {
		try {
			const response = await apiGet('device', '/listWithValues', {});
			if (response.ok) {
				const data = await response.json();
				setDevices(data.devices || []);
			}
		} catch (error) {
			console.error('Failed to load devices:', error);
		}
	}, []);

	const loadGroups = React.useCallback(async () => {
		try {
			const response = await apiGet('device', '/groups/list', {});
			if (response.ok) {
				const data = await response.json();
				setGroups(data.groups || []);
			}
		} catch (error) {
			console.error('Failed to load groups:', error);
		}
	}, []);

	// Load location on mount
	const loadLocation = React.useCallback(async () => {
		try {
			const response = await apiGet('device', '/location', {});
			if (response.ok) {
				const data = await response.json();
				if (data.location) {
					setLocation(data.location);
					setLocationInput({
						latitude: data.location.latitude.toString(),
						longitude: data.location.longitude.toString(),
					});
				}
			}
		} catch (error) {
			console.error('Failed to load location:', error);
		}
	}, []);

	// Load layout, rooms, devices, groups, and location on mount
	useEffect(() => {
		void loadLayout();
		void loadRooms();
		void loadDevices();
		void loadGroups();
		void loadLocation();
	}, [loadRooms, loadDevices, loadGroups, loadLocation]);

	const saveLayout = async () => {
		try {
			const layout: HouseLayoutType = {
				walls,
				doors,
				roomMappings,
				floorplanAlignment,
			};
			await apiPost('device', '/layout/save', {}, layout);
		} catch (error) {
			console.error('Failed to save layout:', error);
		}
	};

	const handleSaveFloorplanAlignment = async () => {
		await saveLayout();
	};

	const handleResetFloorplanAlignment = () => {
		setFloorplanAlignment({ x: 0, y: 0, scale: 1, rotation: 0 });
	};

	// Load floorplan render info
	React.useEffect(() => {
		const fetchInfo = async () => {
			try {
				const response = await apiGet('device', '/floorplan-renders/info', {});
				if (response.ok) {
					const data = await response.json();
					setFloorplanRenderInfo({
						hasRenders: data.hasRenders,
						lightIds: data.lightIds ? [...data.lightIds] : [],
						timeFolders: data.timeFolders ? [...data.timeFolders] : [],
					});
				}
			} catch (error) {
				console.error('Failed to fetch floorplan render info:', error);
			}
		};
		void fetchInfo();
	}, []);

	// Apply preview states to devices and get floorplan render
	const deviceStates = useDeviceStates(devices);
	const deviceStatesWithPreview = React.useMemo(() => {
		return { ...deviceStates, ...floorplanPreviewStates };
	}, [deviceStates, floorplanPreviewStates]);
	const floorplanRender = useFloorplanRender(deviceStatesWithPreview, selectedTimeFolder);

	const handleZoomIn = () => {
		const stage = stageRef.current;
		if (!stage) {
			return;
		}
		const newScale = stage.scaleX() * 1.05;
		stage.scale({ x: newScale, y: newScale });
		updateStageTransform();
	};

	const handleZoomOut = () => {
		const stage = stageRef.current;
		if (!stage) {
			return;
		}
		const newScale = stage.scaleX() / 1.05;
		stage.scale({ x: newScale, y: newScale });
		updateStageTransform();
	};

	const handleResetView = () => {
		stageRef.current?.position({ x: 0, y: 0 });
		stageRef.current?.scale({ x: 1, y: 1 });
		updateStageTransform();
	};

	const handleKeyDown = React.useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			if (mode === DrawMode.DRAW_WALLS) {
				if (e.key === 'Escape') {
					setWallDrawStartPoint(null);
					setWallDrawEndPoint(null);
				} else if (e.key === 'z' && e.ctrlKey) {
					const lastWall = walls[walls.length - 1];
					if (lastWall) {
						SetWallRedoStack([...wallRedoStack, lastWall]);
						setWalls(walls.slice(0, -1));
					}
				} else if (e.key === 'y' && e.ctrlKey) {
					const lastWall = wallRedoStack[wallRedoStack.length - 1];
					if (lastWall) {
						SetWallRedoStack(wallRedoStack.slice(0, -1));
						setWalls([...walls, lastWall]);
					}
				}
			} else if (mode === DrawMode.PLACE_DOORS) {
				if (e.key === 'z' && e.ctrlKey) {
					const lastDoor = doors[doors.length - 1];
					if (lastDoor) {
						setDoorRedoStack([...doorRedoStack, lastDoor]);
						setDoors(doors.slice(0, -1));
					}
				} else if (e.key === 'y' && e.ctrlKey) {
					const lastDoor = doorRedoStack[doorRedoStack.length - 1];
					if (lastDoor) {
						setDoorRedoStack(doorRedoStack.slice(0, -1));
						setDoors([...doors, lastDoor]);
					}
				}
			}
		},
		[mode, walls, wallRedoStack, doors, doorRedoStack]
	);

	const getAllPoints = React.useCallback(() => {
		const points: { point: Point; wallId: string }[] = [];
		for (const wall of walls) {
			points.push({ point: wall.start, wallId: wall.id });
			// Also push every point along the line (excluding duplicates at ends)
			const step = 2; // px between interpolated points
			const { start, end } = wall;
			const dx = end.x - start.x;
			const dy = end.y - start.y;
			const length = Math.sqrt(dx * dx + dy * dy);
			const steps = Math.floor(length / step);
			for (let i = 1; i < steps; i++) {
				const t = i / steps;
				const interpPoint = {
					x: start.x + t * dx,
					y: start.y + t * dy,
				};
				points.push({ point: interpPoint, wallId: wall.id });
			}
			points.push({ point: wall.end, wallId: wall.id });
		}
		return points;
	}, [walls]);

	const snapToNearbyPoint = React.useCallback(
		(point: Point, maxDistance: number = SNAP_DISTANCE) => {
			const nearbyPoints = getAllPoints();
			if (nearbyPoints.length === 0) {
				return { point, wallId: null };
			}
			const closestPoint = nearbyPoints.reduce((closest, p) => {
				return distanceToSegment(point, p.point, p.point).dist <
					distanceToSegment(point, closest.point, closest.point).dist
					? p
					: closest;
			}, nearbyPoints[0]);

			if (
				distanceToSegment(point, closestPoint.point, closestPoint.point).dist < maxDistance
			) {
				return { point: closestPoint.point, wallId: closestPoint.wallId };
			}
			return { point, wallId: null };
		},
		[getAllPoints]
	);

	const toScaledPoint = React.useCallback((point: Point) => {
		const scale = stageRef.current?.scaleX() ?? 1.0;
		const position = stageRef.current?.position();
		if (!position) {
			return point;
		}
		return {
			x: (point.x - position.x) / scale,
			y: (point.y - position.y) / scale,
		};
	}, []);

	// Handle device placement on canvas click
	const handlePlaceDevice = React.useCallback(
		async (position: Point) => {
			if (!selectedDeviceId) {
				return;
			}

			try {
				await apiPost(
					'device',
					'/updatePosition',
					{},
					{
						deviceId: selectedDeviceId,
						position,
					}
				);

				// Update local state
				setDevices((prev) =>
					prev.map((d) => (d.uniqueId === selectedDeviceId ? { ...d, position } : d))
				);

				setPlacementSnackbar({
					open: true,
					message: 'Device placed successfully!',
					severity: 'success',
				});
			} catch (error) {
				console.error('Failed to place device:', error);
				setPlacementSnackbar({
					open: true,
					message: 'Failed to place device',
					severity: 'error',
				});
			}
		},
		[selectedDeviceId]
	);

	// Handle group placement on canvas click
	const handlePlaceGroup = React.useCallback(
		async (position: Point) => {
			if (!selectedGroupId) {
				return;
			}

			try {
				await apiPost(
					'device',
					'/groups/:groupId/updatePosition',
					{ groupId: selectedGroupId },
					{
						position,
					}
				);

				// Update local state
				setGroups((prev) =>
					prev.map((g) => (g.id === selectedGroupId ? { ...g, position } : g))
				);

				setPlacementSnackbar({
					open: true,
					message: 'Group placed successfully!',
					severity: 'success',
				});
			} catch (error) {
				console.error('Failed to place group:', error);
				setPlacementSnackbar({
					open: true,
					message: 'Failed to place group',
					severity: 'error',
				});
			}
		},
		[selectedGroupId]
	);

	const handleMouseDown = React.useCallback(
		(e: KonvaEventObject<MouseEvent>) => {
			if (mode === DrawMode.DRAW_WALLS) {
				if (e.evt.button === 2) {
					setWallDrawStartPoint(null);
					setWallDrawEndPoint(null);
					return;
				}
				if (e.evt.button !== 0) {
					return;
				}

				const pointer = stageRef.current?.getPointerPosition();
				if (!pointer) {
					return;
				}

				const point = e.evt.ctrlKey
					? toScaledPoint(pointer)
					: snapToNearbyPoint(toScaledPoint(pointer)).point;
				if (wallDrawStartPoint !== null) {
					setWalls([
						...walls,
						{ id: crypto.randomUUID(), start: wallDrawStartPoint, end: point },
					]);
					setWallDrawEndPoint(null);
					setWallDrawStartPoint(null);
					SetWallRedoStack([]);
				} else {
					setWallDrawStartPoint(point);
				}
			} else if (mode === DrawMode.PLACE_DOORS) {
				if (e.evt.button === 2) {
					setDoorDrawStartPoint(null);
					setDoorDrawEndPoint(null);
					return;
				}
				if (e.evt.button !== 0) {
					return;
				}

				const pointer = stageRef.current?.getPointerPosition();
				if (!pointer) {
					return;
				}

				const snapped = snapToNearbyPoint(toScaledPoint(pointer));
				if (snapped.wallId === null) {
					return;
				}
				if (doorDrawStartPoint !== null) {
					setDoors([
						...doors,
						{
							id: crypto.randomUUID(),
							start: doorDrawStartPoint.point,
							end: snapped.point,
							wallId: snapped.wallId,
						},
					]);
					setDoorDrawEndPoint(null);
					setDoorDrawStartPoint(null);
					setDoorRedoStack([]);
				} else {
					setDoorDrawStartPoint(snapped);
				}
			} else if (mode === DrawMode.PLACE_DEVICES) {
				if (e.evt.button !== 0) {
					return;
				}

				const pointer = stageRef.current?.getPointerPosition();
				if (!pointer) {
					return;
				}

				const floorPoint = toScaledPoint(pointer);

				// Place selected device or group
				if (selectedDeviceId) {
					void handlePlaceDevice(floorPoint);
				} else if (selectedGroupId) {
					void handlePlaceGroup(floorPoint);
				}
			}
		},
		[
			mode,
			toScaledPoint,
			snapToNearbyPoint,
			wallDrawStartPoint,
			walls,
			doorDrawStartPoint,
			doors,
			selectedDeviceId,
			selectedGroupId,
			handlePlaceDevice,
			handlePlaceGroup,
		]
	);

	const cursorPointer = React.useCallback((e: KonvaEventObject<MouseEvent>) => {
		const stage = e.target.getStage();
		if (stage) {
			stage.container().style.cursor = 'pointer';
		}
	}, []);

	const cursorDefault = React.useCallback((e: KonvaEventObject<MouseEvent>) => {
		const stage = e.target.getStage();
		if (stage) {
			stage.container().style.cursor = 'default';
		}
	}, []);

	const handleMouseMove = React.useCallback(() => {
		if (mode === DrawMode.DRAW_WALLS) {
			const pointer = stageRef.current?.getPointerPosition();
			if (!pointer) {
				return;
			}
			setWallDrawEndPoint(toScaledPoint(pointer));
		} else if (mode === DrawMode.PLACE_DOORS) {
			const pointer = stageRef.current?.getPointerPosition();
			if (!pointer) {
				return;
			}
			const nearestPoint = snapToNearbyPoint(toScaledPoint(pointer), Infinity);
			if (nearestPoint.wallId === null) {
				return;
			}
			setDoorDrawEndPoint({ point: nearestPoint.point, wallId: nearestPoint.wallId });
		}
	}, [mode, snapToNearbyPoint, toScaledPoint]);

	const handleMouseUp = React.useCallback(() => {
		// No implementation yet
	}, []);

	const handleBackgroundImageUpload = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = (e) => {
					const dataUrl = e.target?.result as string;
					setBackgroundImageUrl(dataUrl);
				};
				reader.readAsDataURL(file);
			}
		},
		[]
	);

	const handleClearBackgroundImage = React.useCallback(() => {
		setBackgroundImageUrl(null);
	}, []);

	const handleExportLayout = React.useCallback(() => {
		const layout: HouseLayoutType = {
			walls,
			doors,
			roomMappings,
		};

		const dataStr = JSON.stringify(layout, null, 2);
		const dataBlob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(dataBlob);

		const date = new Date();
		const filename = `house-layout-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.json`;

		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}, [walls, doors, roomMappings]);

	const handleImportLayout = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const content = e.target?.result as string;
				const layout = JSON.parse(content) as HouseLayoutType;

				// Validate the layout structure
				if (!layout || typeof layout !== 'object') {
					setImportError('Invalid layout file: not a valid JSON object');
					return;
				}

				if (!Array.isArray(layout.walls)) {
					setImportError('Invalid layout file: missing or invalid walls array');
					return;
				}

				if (!Array.isArray(layout.doors)) {
					setImportError('Invalid layout file: missing or invalid doors array');
					return;
				}

				if (!layout.roomMappings || typeof layout.roomMappings !== 'object') {
					setImportError('Invalid layout file: missing or invalid roomMappings');
					return;
				}

				// Validate wall structure
				for (const wall of layout.walls) {
					if (
						!wall.id ||
						!wall.start ||
						!wall.end ||
						typeof wall.start.x !== 'number' ||
						typeof wall.start.y !== 'number' ||
						typeof wall.end.x !== 'number' ||
						typeof wall.end.y !== 'number'
					) {
						setImportError('Invalid layout file: invalid wall structure');
						return;
					}
				}

				// Validate door structure
				for (const door of layout.doors) {
					if (
						!door.id ||
						!door.wallId ||
						!door.start ||
						!door.end ||
						typeof door.start.x !== 'number' ||
						typeof door.start.y !== 'number' ||
						typeof door.end.x !== 'number' ||
						typeof door.end.y !== 'number'
					) {
						setImportError('Invalid layout file: invalid door structure');
						return;
					}
				}

				// All validations passed, apply the layout
				setWalls(layout.walls);
				setDoors(layout.doors);
				setRoomMappings(layout.roomMappings);
				setImportError(null);

				// Clear redo stacks when importing
				SetWallRedoStack([]);
				setDoorRedoStack([]);
			} catch (error) {
				console.error('Failed to import layout:', error);
				setImportError(
					'Failed to parse layout file: ' +
						(error instanceof Error ? error.message : 'unknown error')
				);
			}
		};

		reader.onerror = () => {
			setImportError('Failed to read file');
		};

		reader.readAsText(file);

		// Clear the input value so the same file can be imported again
		event.target.value = '';
	}, []);

	const stageRef = React.useRef<StageType | null>(null);
	const [stageTransform, setStageTransform] = React.useState<{
		x: number;
		y: number;
		scale: number;
	}>({
		x: 0,
		y: 0,
		scale: 1,
	});

	// Update stage transform state
	const updateStageTransform = React.useCallback(() => {
		if (stageRef.current) {
			const pos = stageRef.current.position();
			const scale = stageRef.current.scaleX();
			setStageTransform({ x: pos.x, y: pos.y, scale });
		}
	}, []);

	const handleWheel = React.useCallback(
		(e: KonvaEventObject<WheelEvent>) => {
			e.evt.preventDefault();

			const stage = stageRef.current;
			if (!stage) {
				return;
			}
			const oldScale = stage.scaleX();
			const pointer = stage.getPointerPosition();
			if (!pointer) {
				return;
			}

			const mousePointTo = {
				x: (pointer.x - stage.x()) / oldScale,
				y: (pointer.y - stage.y()) / oldScale,
			};

			// how to scale? Zoom in? Or zoom out?
			let direction = e.evt.deltaY > 0 ? -1 : 1;

			// when we zoom on trackpad, e.evt.ctrlKey is true
			// in that case lets revert direction
			if (e.evt.ctrlKey) {
				direction = -direction;
			}

			const scaleBy = 1.05;
			const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

			stage.scale({ x: newScale, y: newScale });

			const newPos = {
				x: pointer.x - mousePointTo.x * newScale,
				y: pointer.y - mousePointTo.y * newScale,
			};
			stage.position(newPos);
			updateStageTransform();
		},
		[updateStageTransform]
	);

	const handleStageDragEnd = React.useCallback(() => {
		updateStageTransform();
	}, [updateStageTransform]);

	const width = window.innerWidth - 240;
	const height = window.innerHeight - 205;

	const detectedRooms = React.useMemo(() => {
		if (mode !== DrawMode.MAP_ROOMS && mode !== DrawMode.VIEW) {
			return [];
		}
		return detectRooms(walls, width, height);
	}, [mode, walls, width, height]);

	const handleMappingConfirm = React.useCallback(async () => {
		if (!selectedRoomName || !selectedPolygonId) {
			return;
		}

		// Find the polygon
		const polygon = detectedRooms.find((r) => r.id === selectedPolygonId);
		if (!polygon) {
			return;
		}

		try {
			// Save polygon to room
			await apiPost(
				'device',
				'/rooms/updatePolygon',
				{},
				{
					roomName: selectedRoomName,
					polygon: polygon.polygon,
				}
			);

			// Update local mapping
			setRoomMappings({
				...roomMappings,
				[selectedPolygonId]: selectedRoomName,
			});

			// Reload rooms to get updated data
			await loadRooms();

			// Close dialog
			setMappingDialogOpen(false);
			setSelectedPolygonId('');
			setSelectedRoomName('');
		} catch (error) {
			console.error('Failed to save room mapping:', error);
		}
	}, [selectedRoomName, selectedPolygonId, detectedRooms, roomMappings, loadRooms]);

	// Handle device position removal
	const handleRemoveDevicePosition = React.useCallback(async () => {
		if (!selectedDeviceId) {
			return;
		}

		try {
			await apiPost(
				'device',
				'/updatePosition',
				{},
				{
					deviceId: selectedDeviceId,
					position: null,
				}
			);

			// Update local state
			setDevices((prev) =>
				prev.map((d) =>
					d.uniqueId === selectedDeviceId ? { ...d, position: undefined } : d
				)
			);

			setPlacementSnackbar({
				open: true,
				message: 'Device position removed',
				severity: 'info',
			});
			setSelectedDeviceId(null);
		} catch (error) {
			console.error('Failed to remove device position:', error);
			setPlacementSnackbar({
				open: true,
				message: 'Failed to remove device position',
				severity: 'error',
			});
		}
	}, [selectedDeviceId]);

	// Handle group position removal
	const handleRemoveGroupPosition = React.useCallback(async () => {
		if (!selectedGroupId) {
			return;
		}

		try {
			await apiPost(
				'device',
				'/groups/:groupId/updatePosition',
				{ groupId: selectedGroupId },
				{
					position: null,
				}
			);

			// Update local state
			setGroups((prev) =>
				prev.map((g) => (g.id === selectedGroupId ? { ...g, position: undefined } : g))
			);

			setPlacementSnackbar({
				open: true,
				message: 'Group position removed',
				severity: 'info',
			});
			setSelectedGroupId(null);
		} catch (error) {
			console.error('Failed to remove group position:', error);
			setPlacementSnackbar({
				open: true,
				message: 'Failed to remove group position',
				severity: 'error',
			});
		}
	}, [selectedGroupId]);

	// Location config handlers
	const handleGetCurrentLocation = () => {
		if (!navigator.geolocation) {
			setLocationError('Geolocation is not supported by your browser');
			return;
		}

		setLocationLoading(true);
		setLocationError(null);

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const lat = position.coords.latitude;
				const lng = position.coords.longitude;
				setLocationInput({
					latitude: lat.toString(),
					longitude: lng.toString(),
				});
				setLocationLoading(false);
			},
			(error) => {
				setLocationError(`Failed to get location: ${error.message}`);
				setLocationLoading(false);
			}
		);
	};

	const handleSaveLocation = async () => {
		const lat = parseFloat(locationInput.latitude);
		const lng = parseFloat(locationInput.longitude);

		if (isNaN(lat) || isNaN(lng)) {
			setLocationError('Please enter valid latitude and longitude values');
			return;
		}

		if (lat < -90 || lat > 90) {
			setLocationError('Latitude must be between -90 and 90');
			return;
		}

		if (lng < -180 || lng > 180) {
			setLocationError('Longitude must be between -180 and 180');
			return;
		}

		setLocationLoading(true);
		setLocationError(null);

		try {
			const response = await apiPost(
				'device',
				'/location/save',
				{},
				{ latitude: lat, longitude: lng }
			);
			if (response.ok) {
				setLocation({ latitude: lat, longitude: lng });
				setLocationSuccess(true);
				setTimeout(() => {
					setLocationSuccess(false);
					setLocationDialogOpen(false);
				}, 1500);
			} else {
				const data = (await response.json()) as { error?: string };
				setLocationError(data.error || 'Failed to save location');
			}
		} catch (error) {
			setLocationError('Failed to save location');
			console.error('Failed to save location:', error);
		} finally {
			setLocationLoading(false);
		}
	};

	// Get devices and groups with positions for display
	const devicesWithPositions = React.useMemo(() => {
		return devices.filter((d) => d.position !== undefined);
	}, [devices]);

	const groupsWithPositions = React.useMemo(() => {
		return groups.filter((g) => g.position !== undefined);
	}, [groups]);

	return (
		<Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
			{/* Toolbar */}
			<Paper sx={{ p: 2, mb: 2 }}>
				<Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
					<ToggleButtonGroup
						value={mode}
						exclusive
						onChange={(_e, newMode) => {
							if (newMode !== null) {
								// Clear preview states and time selection when exiting preview mode
								if (
									mode === DrawMode.FLOORPLAN_PREVIEW &&
									newMode !== DrawMode.FLOORPLAN_PREVIEW
								) {
									setFloorplanPreviewStates({});
									setSelectedTimeFolder(null);
								}
								setMode(newMode as DrawMode);
							}
						}}
						size="small"
					>
						<ToggleButton value="view">
							<Tooltip title="View Mode">
								<VisibilityIcon />
							</Tooltip>
						</ToggleButton>
						<ToggleButton value="draw_walls">
							<Tooltip title="Draw Walls">
								<EditIcon />
							</Tooltip>
						</ToggleButton>
						<ToggleButton value="place_doors">
							<Tooltip title="Place Doors">
								<DoorIcon />
							</Tooltip>
						</ToggleButton>
						<ToggleButton value="map_rooms">
							<Tooltip title="Map Rooms">
								<RoomIcon />
							</Tooltip>
						</ToggleButton>
						<ToggleButton value="place_devices">
							<Tooltip title="Place Devices/Groups">
								<DevicesIcon />
							</Tooltip>
						</ToggleButton>
						<ToggleButton value="floorplan_preview">
							<Tooltip title="Floorplan Preview">
								<PhotoCameraIcon />
							</Tooltip>
						</ToggleButton>
					</ToggleButtonGroup>

					<Box sx={{ display: 'flex', gap: 1 }}>
						<Tooltip title="Zoom In">
							<IconButton onClick={handleZoomIn} size="small">
								<ZoomInIcon />
							</IconButton>
						</Tooltip>
						<Tooltip title="Zoom Out">
							<IconButton onClick={handleZoomOut} size="small">
								<ZoomOutIcon />
							</IconButton>
						</Tooltip>
						<Tooltip title="Reset View">
							<IconButton onClick={handleResetView} size="small">
								<CenterIcon />
							</IconButton>
						</Tooltip>
					</Box>

					{mode !== DrawMode.VIEW && (
						<Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
							<input
								accept="image/*"
								style={{ display: 'none' }}
								id="background-image-upload"
								type="file"
								onChange={handleBackgroundImageUpload}
							/>
							<label htmlFor="background-image-upload">
								<Tooltip title="Set Background Image">
									<IconButton component="span" size="small">
										<ImageIcon />
									</IconButton>
								</Tooltip>
							</label>
							{backgroundImageUrl && (
								<Tooltip title="Clear Background Image">
									<IconButton
										onClick={handleClearBackgroundImage}
										size="small"
										color="error"
									>
										<CloseIcon />
									</IconButton>
								</Tooltip>
							)}
						</Box>
					)}

					<Box sx={{ flexGrow: 1 }} />

					<Tooltip title="Location Settings">
						<IconButton onClick={() => setLocationDialogOpen(true)} size="small">
							<LocationOnIcon />
						</IconButton>
					</Tooltip>

					<Button variant="contained" startIcon={<SaveIcon />} onClick={saveLayout}>
						Save Layout
					</Button>

					<input
						accept="application/json"
						style={{ display: 'none' }}
						id="layout-import-input"
						type="file"
						onChange={handleImportLayout}
					/>
					<label htmlFor="layout-import-input">
						<Tooltip title="Import layout from JSON file">
							<Button
								variant="outlined"
								component="span"
								startIcon={<FileUploadIcon />}
							>
								Import
							</Button>
						</Tooltip>
					</label>

					<Tooltip title="Export layout as JSON file">
						<Button
							variant="outlined"
							startIcon={<FileDownloadIcon />}
							onClick={handleExportLayout}
						>
							Export
						</Button>
					</Tooltip>

					<Button
						variant="outlined"
						color="error"
						onClick={() => {
							setWalls([]);
							setDoors([]);
							setRoomMappings({});
						}}
					>
						Clear All
					</Button>
				</Box>

				{/* Device/Group placement controls */}
				{mode === DrawMode.PLACE_DEVICES && (
					<Box
						sx={{
							display: 'flex',
							gap: 2,
							mt: 1,
							alignItems: 'center',
							flexWrap: 'wrap',
						}}
					>
						<Autocomplete
							options={devices.map((d) => ({
								label: d.name,
								value: d.uniqueId,
								hasPosition: !!d.position,
							}))}
							getOptionLabel={(option) => option.label}
							value={
								selectedDeviceId
									? {
											label:
												devices.find((d) => d.uniqueId === selectedDeviceId)
													?.name || '',
											value: selectedDeviceId,
											hasPosition: !!devices.find(
												(d) => d.uniqueId === selectedDeviceId
											)?.position,
										}
									: null
							}
							onChange={(_e, value) => {
								setSelectedDeviceId(value?.value || null);
								setSelectedGroupId(null);
							}}
							renderOption={(props, option) => (
								<li {...props}>
									{option.label}
									{option.hasPosition && (
										<Typography
											variant="caption"
											sx={{ ml: 1, color: 'text.secondary' }}
										>
											(placed)
										</Typography>
									)}
								</li>
							)}
							renderInput={(params) => (
								<TextField
									{...params}
									label="Select Device"
									variant="outlined"
									size="small"
									sx={{ minWidth: 200 }}
								/>
							)}
						/>
						<Typography variant="body2" sx={{ color: 'text.secondary' }}>
							or
						</Typography>
						<Autocomplete
							options={groups.map((g) => ({
								label: g.name,
								value: g.id,
								hasPosition: !!g.position,
							}))}
							getOptionLabel={(option) => option.label}
							value={
								selectedGroupId
									? {
											label:
												groups.find((g) => g.id === selectedGroupId)
													?.name || '',
											value: selectedGroupId,
											hasPosition: !!groups.find(
												(g) => g.id === selectedGroupId
											)?.position,
										}
									: null
							}
							onChange={(_e, value) => {
								setSelectedGroupId(value?.value || null);
								setSelectedDeviceId(null);
							}}
							renderOption={(props, option) => (
								<li {...props}>
									{option.label}
									{option.hasPosition && (
										<Typography
											variant="caption"
											sx={{ ml: 1, color: 'text.secondary' }}
										>
											(placed)
										</Typography>
									)}
								</li>
							)}
							renderInput={(params) => (
								<TextField
									{...params}
									label="Select Group"
									variant="outlined"
									size="small"
									sx={{ minWidth: 200 }}
								/>
							)}
						/>
						{selectedDeviceId &&
							devices.find((d) => d.uniqueId === selectedDeviceId)?.position && (
								<Button
									onClick={handleRemoveDevicePosition}
									color="error"
									size="small"
									startIcon={<CloseIcon />}
								>
									Remove Position
								</Button>
							)}
						{selectedGroupId &&
							groups.find((g) => g.id === selectedGroupId)?.position && (
								<Button
									onClick={handleRemoveGroupPosition}
									color="error"
									size="small"
									startIcon={<CloseIcon />}
								>
									Remove Position
								</Button>
							)}
					</Box>
				)}

				<Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
					{mode === DrawMode.VIEW && 'Click on a room to view details'}
					{mode === DrawMode.DRAW_WALLS &&
						'Click and drag to draw walls. Endpoints snap to nearby walls.'}
					{mode === DrawMode.PLACE_DOORS && 'Click on a wall to place a door'}
					{mode === DrawMode.MAP_ROOMS &&
						'Click on a detected room to map it to a system room'}
					{mode === DrawMode.PLACE_DEVICES &&
						(selectedDeviceId || selectedGroupId
							? 'Click on the floor plan to place the selected device/group'
							: 'Select a device or group to place on the floor plan')}
				</Typography>
			</Paper>

			{/* Canvas */}
			<Box
				sx={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}
				tabIndex={0}
				onKeyDown={handleKeyDown}
			>
				{/* Floorplan Background Layer - only in preview mode */}
				{mode === DrawMode.FLOORPLAN_PREVIEW && (
					<Box
						sx={{
							position: 'absolute',
							top: 20,
							left: 20,
							right: 20,
							bottom: 20,
							overflow: 'hidden',
							pointerEvents: 'none',
							zIndex: 0,
							border: '1px solid #ccc',
							borderRadius: 10,
						}}
					>
						<FloorplanBackground
							floorplanRender={floorplanRender}
							stageTransform={stageTransform}
							floorplanAlignment={floorplanAlignment}
						/>
					</Box>
				)}

				<Stage
					ref={stageRef}
					width={width}
					height={height}
					style={{
						marginLeft: 20,
						marginRight: 20,
						marginBottom: 20,
						border: '1px solid #ccc',
						borderRadius: 10,
					}}
					onMouseDown={handleMouseDown}
					onMouseMove={handleMouseMove}
					onMouseUp={handleMouseUp}
					onWheel={handleWheel}
					onDragEnd={handleStageDragEnd}
					draggable={mode === DrawMode.VIEW}
				>
					<Layer>
						{backgroundImage && (
							<KonvaImage image={backgroundImage} opacity={0.5} listening={false} />
						)}
						{wallDrawStartPoint && wallDrawEndPoint && (
							<Line
								points={[
									wallDrawStartPoint.x,
									wallDrawStartPoint.y,
									wallDrawEndPoint.x,
									wallDrawEndPoint.y,
								]}
								stroke={WALL_COLOR}
								strokeWidth={WALL_THICKNESS}
								dash={[10, 5]}
							/>
						)}
						{walls.map((wall) => (
							<Line
								key={wall.id}
								points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
								stroke={WALL_COLOR}
								strokeWidth={WALL_THICKNESS}
							/>
						))}
						{mode === DrawMode.PLACE_DOORS &&
							doorDrawEndPoint &&
							(doorDrawStartPoint ? (
								<KonvaDoor
									start={doorDrawStartPoint.point}
									end={doorDrawEndPoint.point}
									wallSegment={walls.find(
										(wall) => wall.id === doorDrawStartPoint.wallId
									)}
									opacity={0.5}
								/>
							) : (
								<Circle
									x={doorDrawEndPoint.point.x}
									y={doorDrawEndPoint.point.y}
									stroke={'#a00000'}
									radius={WALL_THICKNESS / 2}
									fill={'#a00000'}
								/>
							))}
						{doors.map((door) => (
							<KonvaDoor
								key={door.id}
								start={door.start}
								end={door.end}
								wallSegment={walls.find((wall) => wall.id === door.wallId)}
								opacity={0.8}
							/>
						))}
					</Layer>
					<Layer>
						{mode === DrawMode.VIEW &&
							detectedRooms
								.filter((room) => roomMappings[room.id])
								.map((room) => {
									const mappedRoomName = roomMappings[room.id];
									const roomInfo = availableRooms[mappedRoomName];
									const iconEmoji = roomInfo?.icon
										? iconToEmoji[roomInfo.icon] || '🏠'
										: '🏠';

									return (
										<React.Fragment key={room.id}>
											<Line
												points={room.polygon.map((p) => [p.x, p.y]).flat()}
												fill={
													roomInfo?.color
														? `${roomInfo.color}33`
														: '#00000010'
												}
												stroke={roomInfo?.color || '#ccc'}
												strokeWidth={2}
												closed
											/>
											<Text
												x={room.center.x}
												y={room.center.y}
												text={iconEmoji}
												fontSize={32}
												offsetX={16}
												offsetY={16}
											/>
										</React.Fragment>
									);
								})}

						{mode === DrawMode.MAP_ROOMS &&
							detectedRooms.map((room, index) => {
								const mappedRoomName = roomMappings[room.id];
								const roomInfo = mappedRoomName
									? availableRooms[mappedRoomName]
									: null;

								// Use room color if mapped, otherwise generate one
								const hue = (index * 137.5) % 360;
								const fillColor = roomInfo?.color
									? `${roomInfo.color}33`
									: `hsla(${hue}, 70%, 50%, 0.15)`;
								const strokeColor = roomInfo?.color || `hsl(${hue}, 70%, 40%)`;
								const textColor = roomInfo?.color || `hsl(${hue}, 70%, 30%)`;

								// Show icon for assigned rooms, text for unassigned
								const isAssigned = !!mappedRoomName;
								const displayText = isAssigned
									? roomInfo?.icon
										? iconToEmoji[roomInfo.icon] || '🏠'
										: '🏠'
									: `Room ${index + 1}`;
								const fontSize = isAssigned ? 32 : 18;
								const offsetX = isAssigned ? 16 : 30;
								const offsetY = isAssigned ? 16 : 9;

								return (
									<React.Fragment key={room.id}>
										<Line
											points={room.polygon.map((p) => [p.x, p.y]).flat()}
											fill={fillColor}
											stroke={strokeColor}
											strokeWidth={2}
											closed
											onMouseOver={cursorPointer}
											onMouseOut={cursorDefault}
											onClick={() => {
												setSelectedPolygonId(room.id);
												setMappingDialogOpen(true);
												setSelectedRoomName(mappedRoomName || '');
											}}
										/>
										<Text
											x={room.center.x}
											y={room.center.y}
											text={displayText}
											fontSize={fontSize}
											fontFamily={isAssigned ? undefined : 'Arial'}
											fill={isAssigned ? undefined : textColor}
											fontStyle={isAssigned ? undefined : 'bold'}
											offsetX={offsetX}
											offsetY={offsetY}
											onMouseOver={cursorPointer}
											onMouseOut={cursorDefault}
											onClick={() => {
												setSelectedPolygonId(room.id);
												setMappingDialogOpen(true);
												setSelectedRoomName(mappedRoomName || '');
											}}
										/>
									</React.Fragment>
								);
							})}

						{/* Device positions */}
						{(mode === DrawMode.VIEW || mode === DrawMode.PLACE_DEVICES) &&
							devicesWithPositions.map((device) => (
								<React.Fragment key={`device-pos-${device.uniqueId}`}>
									<Circle
										x={device.position!.x}
										y={device.position!.y}
										radius={8}
										fill={
											selectedDeviceId === device.uniqueId
												? '#4caf50'
												: '#2196f3'
										}
										stroke="#fff"
										strokeWidth={2}
										shadowColor="black"
										shadowBlur={4}
										shadowOpacity={0.3}
									/>
									{mode === DrawMode.PLACE_DEVICES && (
										<Text
											x={device.position!.x}
											y={device.position!.y + 12}
											text={device.name}
											fontSize={10}
											fill="#333"
											align="center"
											offsetX={device.name.length * 2.5}
										/>
									)}
								</React.Fragment>
							))}

						{/* Group positions */}
						{(mode === DrawMode.VIEW || mode === DrawMode.PLACE_DEVICES) &&
							groupsWithPositions.map((group) => (
								<React.Fragment key={`group-pos-${group.id}`}>
									<Circle
										x={group.position!.x}
										y={group.position!.y}
										radius={10}
										fill={
											selectedGroupId === group.id
												? '#4caf50'
												: group.color || '#ff9800'
										}
										stroke="#fff"
										strokeWidth={3}
										shadowColor="black"
										shadowBlur={4}
										shadowOpacity={0.3}
									/>
									{mode === DrawMode.PLACE_DEVICES && (
										<Text
											x={group.position!.x}
											y={group.position!.y + 14}
											text={group.name}
											fontSize={11}
											fill="#333"
											fontStyle="bold"
											align="center"
											offsetX={group.name.length * 2.8}
										/>
									)}
								</React.Fragment>
							))}
					</Layer>
				</Stage>

				{/* Floorplan Preview Controls - only in preview mode */}
				{mode === DrawMode.FLOORPLAN_PREVIEW && (
					<Box
						sx={{
							position: 'absolute',
							top: 20,
							right: 20,
							width: 350,
							maxHeight: 'calc(100% - 40px)',
							overflowY: 'auto',
							zIndex: 10,
							display: 'flex',
							flexDirection: 'column',
							gap: 2,
						}}
					>
						<FloorplanAlignmentPanel
							alignment={floorplanAlignment}
							onAlignmentChange={setFloorplanAlignment}
							onSave={handleSaveFloorplanAlignment}
							onReset={handleResetFloorplanAlignment}
							timeFolders={floorplanRenderInfo.timeFolders}
							selectedTimeFolder={selectedTimeFolder}
							onTimeFolderChange={setSelectedTimeFolder}
						/>
						<DevicePreviewPanel
							devices={devices}
							availableLightIds={new Set(floorplanRenderInfo.lightIds)}
							previewStates={floorplanPreviewStates}
							currentDeviceStates={deviceStates}
							onDevicePreviewChange={(
								deviceId: string,
								state: FloorPlanDeviceState | undefined
							) => {
								setFloorplanPreviewStates((prev) => {
									if (state === undefined) {
										const next = { ...prev };
										delete next[deviceId];
										return next;
									}
									return { ...prev, [deviceId]: state };
								});
							}}
							onClearAll={() => setFloorplanPreviewStates({})}
						/>
					</Box>
				)}
			</Box>

			{/* Room Mapping Dialog */}
			<Dialog open={mappingDialogOpen} onClose={() => setMappingDialogOpen(false)}>
				<DialogTitle>Map Room to System</DialogTitle>
				<DialogContent>
					<Box sx={{ mt: 2 }}>
						<Autocomplete
							freeSolo
							options={Object.keys(availableRooms)}
							value={selectedRoomName}
							onChange={(_, value) => setSelectedRoomName(value || '')}
							onInputChange={(_, value) => setSelectedRoomName(value)}
							renderInput={(params) => (
								<TextField
									{...params}
									label="Select or Create Room"
									placeholder="Type to create new room..."
								/>
							)}
						/>
						<Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
							Select an existing room or create a new one to map this detected area.
						</Typography>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setMappingDialogOpen(false)}>Cancel</Button>
					<Button
						onClick={handleMappingConfirm}
						variant="contained"
						disabled={!selectedRoomName}
					>
						Confirm
					</Button>
				</DialogActions>
			</Dialog>

			{/* Import Error Snackbar */}
			<Snackbar
				open={importError !== null}
				autoHideDuration={6000}
				onClose={() => setImportError(null)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
			>
				<Alert onClose={() => setImportError(null)} severity="error" sx={{ width: '100%' }}>
					{importError}
				</Alert>
			</Snackbar>

			{/* Placement Snackbar */}
			<Snackbar
				open={placementSnackbar.open}
				autoHideDuration={3000}
				onClose={() => setPlacementSnackbar((prev) => ({ ...prev, open: false }))}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
			>
				<Alert
					onClose={() => setPlacementSnackbar((prev) => ({ ...prev, open: false }))}
					severity={placementSnackbar.severity}
					sx={{ width: '100%' }}
				>
					{placementSnackbar.message}
				</Alert>
			</Snackbar>

			{/* Location Config Dialog */}
			<Dialog
				open={locationDialogOpen}
				onClose={() => setLocationDialogOpen(false)}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Location Settings</DialogTitle>
				<DialogContent>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
							}}
						>
							<Typography variant="body2">
								Set your location for sun position calculations
							</Typography>
							<Button
								size="small"
								startIcon={<MyLocationIcon />}
								onClick={handleGetCurrentLocation}
								disabled={locationLoading}
								variant="outlined"
							>
								Get Current
							</Button>
						</Box>
						<Box sx={{ display: 'flex', gap: 1 }}>
							<TextField
								type="number"
								size="small"
								label="Latitude"
								value={locationInput.latitude}
								onChange={(e) =>
									setLocationInput({ ...locationInput, latitude: e.target.value })
								}
								inputProps={{ step: 0.000001, min: -90, max: 90 }}
								fullWidth
								helperText="Range: -90 to 90"
							/>
							<TextField
								type="number"
								size="small"
								label="Longitude"
								value={locationInput.longitude}
								onChange={(e) =>
									setLocationInput({
										...locationInput,
										longitude: e.target.value,
									})
								}
								inputProps={{ step: 0.000001, min: -180, max: 180 }}
								fullWidth
								helperText="Range: -180 to 180"
							/>
						</Box>
						{location && (
							<Typography variant="caption" sx={{ color: 'text.secondary' }}>
								Current: {location.latitude.toFixed(6)},{' '}
								{location.longitude.toFixed(6)}
							</Typography>
						)}
						{locationError && (
							<Alert severity="error" onClose={() => setLocationError(null)}>
								{locationError}
							</Alert>
						)}
						{locationSuccess && (
							<Alert severity="success">Location saved successfully</Alert>
						)}
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setLocationDialogOpen(false)}>Cancel</Button>
					<Button
						onClick={handleSaveLocation}
						variant="contained"
						disabled={locationLoading}
						startIcon={<SaveIcon />}
					>
						Save
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};

interface KonvaDoorProps {
	start: Point;
	end: Point;
	wallSegment: WallSegment | undefined;
	opacity?: number;
}

const KonvaDoor = (props: KonvaDoorProps): React.ReactNode => {
	// Top-down "door" (rectangle for door, lines for frame + swing arc for opening)
	if (!props.wallSegment) {
		return null;
	}

	return (
		<Line
			points={[props.start.x, props.start.y, props.end.x, props.end.y]}
			stroke="#FFF"
			opacity={props.opacity}
			globalCompositeOperation="destination-out"
			strokeWidth={WALL_THICKNESS + 1}
		/>
	);
};

// Utility functions
function distanceToSegment(
	point: Point,
	segStart: Point,
	segEnd: Point
): { dist: number; pos: number } {
	const dx = segEnd.x - segStart.x;
	const dy = segEnd.y - segStart.y;
	const len2 = dx * dx + dy * dy;

	if (len2 === 0) {
		return {
			dist: Math.hypot(point.x - segStart.x, point.y - segStart.y),
			pos: 0,
		};
	}

	let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / len2;
	t = Math.max(0, Math.min(1, t));

	const projX = segStart.x + t * dx;
	const projY = segStart.y + t * dy;

	return {
		dist: Math.hypot(point.x - projX, point.y - projY),
		pos: t,
	};
}

// Map icon names to emoji for canvas rendering
const iconToEmoji: Record<string, string> = {
	Bed: '🛏️',
	Weekend: '🛋️',
	Kitchen: '🍳',
	Bathtub: '🛁',
	Computer: '💻',
	Garage: '🚗',
	Yard: '🌳',
	Foundation: '🏠',
	Roofing: '🏠',
	Settings: '⚙️',
	Wc: '🚽',
	Chair: '🪑',
	Tv: '📺',
	Lightbulb: '💡',
	DoorFront: '🚪',
	Window: '🪟',
	Balcony: '🏠',
	Pool: '🏊',
	FitnessCenter: '💪',
	MeetingRoom: '👥',
	Shower: '🚿',
	Deck: '🏠',
	Cottage: '🏡',
};

const WALL_THICKNESS = 6;
const WALL_COLOR = '#ccc';
const SNAP_DISTANCE = 15;
