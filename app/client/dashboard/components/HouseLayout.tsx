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
import type { Point, WallSegment, DoorSlot, HouseLayout as HouseLayoutType } from '../types/layout';
import { Circle, Image as KonvaImage, Layer, Line, Stage, Text } from 'react-konva';
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

	// Import/Export state
	const [importError, setImportError] = useState<string | null>(null);

	const loadLayout = async () => {
		try {
			const response = await apiGet('device', '/layout', {});
			if (response.ok) {
				const data = await response.json();
				if (data.layout) {
					setWalls(data.layout.walls || []);
					setDoors(data.layout.doors || []);
					setRoomMappings(data.layout.roomMappings || {});
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

				// TODO: REMOVE - Mock rooms for testing when no real rooms exist
				if (Object.keys(data.rooms).length === 0) {
					const mockRooms = {
						'Living Room': {
							name: 'Living Room',
							color: '#FFB6C1',
							icon: 'Weekend' as const,
						},
						Toilet: {
							name: 'Toilet',
							color: '#ADD8E6',
							icon: 'Wc' as const,
						},
						Bedroom: {
							name: 'Bedroom',
							color: '#DDA0DD',
							icon: 'Bed' as const,
						},
					};
					setAvailableRooms(mockRooms);
				} else {
					setAvailableRooms(data.rooms);
				}
			}
		} catch (error) {
			console.error('Failed to load rooms:', error);
		}
	}, []);

	// Load layout and rooms on mount
	useEffect(() => {
		void loadLayout();
		void loadRooms();
	}, [loadRooms]);

	const saveLayout = async () => {
		try {
			const layout: HouseLayoutType = {
				walls,
				doors,
				roomMappings,
			};
			await apiPost('device', '/layout/save', {}, layout);
		} catch (error) {
			console.error('Failed to save layout:', error);
		}
	};

	const handleZoomIn = () => {
		const stage = stageRef.current;
		if (!stage) {
			return;
		}
		const newScale = stage.scaleX() * 1.05;
		stage.scale({ x: newScale, y: newScale });
	};

	const handleZoomOut = () => {
		const stage = stageRef.current;
		if (!stage) {
			return;
		}
		const newScale = stage.scaleX() / 1.05;
		stage.scale({ x: newScale, y: newScale });
	};

	const handleResetView = () => {
		stageRef.current?.position({ x: 0, y: 0 });
		stageRef.current?.scale({ x: 1, y: 1 });
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
	const handleWheel = React.useCallback((e: KonvaEventObject<WheelEvent>) => {
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
	}, []);

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

				<Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
					{mode === DrawMode.VIEW && 'Click on a room to view details'}
					{mode === DrawMode.DRAW_WALLS &&
						'Click and drag to draw walls. Endpoints snap to nearby walls.'}
					{mode === DrawMode.PLACE_DOORS && 'Click on a wall to place a door'}
					{mode === DrawMode.MAP_ROOMS &&
						'Click on a detected room to map it to a system room'}
				</Typography>
			</Paper>

			{/* Canvas */}
			<Box
				sx={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}
				tabIndex={0}
				onKeyDown={handleKeyDown}
			>
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
					</Layer>
				</Stage>
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
