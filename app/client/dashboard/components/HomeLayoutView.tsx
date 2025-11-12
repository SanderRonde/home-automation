import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import type { WallSegment, DoorSlot } from '../types/layout';
// @ts-expect-error - konva ESM/CommonJS type resolution issue
import type { Stage as StageType } from 'konva/lib/Stage';
import type { RoomInfo } from './RoomAssignmentDialog';
// @ts-expect-error - konva ESM/CommonJS type resolution issue
import type { KonvaEventObject } from 'konva/lib/Node';
import { detectRooms } from '../lib/room-detection';
import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import { Layer, Line, Stage } from 'react-konva';
import { Box, IconButton } from '@mui/material';
import type { IncludedIconNames } from './icon';
import type { HomeDetailView } from './Home';
import { IconComponent } from './icon';

interface HomeLayoutViewProps {
	devices: DeviceListWithValuesResponse;
	pushDetailView: (detailView: HomeDetailView) => void;
	invalidate: () => void;
}

// Helper to filter clusters like ClusterIconButton does
const getRelevantClusters = (clusterNames: DeviceClusterName[]): DeviceClusterName[] => {
	const relevantClusters = new Set<DeviceClusterName>();
	for (const clusterName of clusterNames) {
		if (
			clusterName === DeviceClusterName.WINDOW_COVERING ||
			clusterName === DeviceClusterName.ON_OFF ||
			clusterName === DeviceClusterName.COLOR_CONTROL
		) {
			relevantClusters.add(clusterName);
		}
	}
	return Array.from(relevantClusters).sort();
};

const WALL_THICKNESS = 6;
const WALL_COLOR = '#ccc';

export const HomeLayoutView = (props: HomeLayoutViewProps): JSX.Element => {
	const [walls, setWalls] = useState<WallSegment[]>([]);
	const [doors, setDoors] = useState<DoorSlot[]>([]);
	const [roomMappings, setRoomMappings] = useState<Record<string, string>>({});
	const [availableRooms, setAvailableRooms] = useState<Record<string, RoomInfo>>({});
	const stageRef = React.useRef<StageType | null>(null);
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const [isDragging, setIsDragging] = React.useState(false);
	const dragStartPos = React.useRef<{ x: number; y: number } | null>(null);
	const [stageTransform, setStageTransform] = React.useState({ x: 0, y: 0, scale: 1 });
	const [expandedRoomId, setExpandedRoomId] = React.useState<string | null>(null);
	const lastDist = React.useRef<number>(0);
	const lastCenter = React.useRef<{ x: number; y: number } | null>(null);

	const width = window.innerWidth > 900 ? window.innerWidth - 240 : window.innerWidth;
	const height = window.innerHeight - 64;

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
				setAvailableRooms(data.rooms);
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

	const detectedRooms = React.useMemo(() => {
		return detectRooms(walls, width, height);
	}, [walls, width, height]);

	// Calculate initial zoom to fit all walls with padding
	useEffect(() => {
		if (stageRef.current && walls.length > 0) {
			const bbox = calculateBoundingBox(walls);
			const padding = 40;
			const scaleX = (width - padding * 2) / bbox.width;
			const scaleY = (height - padding * 2) / bbox.height;
			const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in more than 1:1

			const posX = (width - bbox.width * scale) / 2 - bbox.minX * scale;
			const posY = (height - bbox.height * scale) / 2 - bbox.minY * scale;

			stageRef.current.scale({ x: scale, y: scale });
			// Center the content
			stageRef.current.position({
				x: posX,
				y: posY,
			});
			setStageTransform({ x: posX, y: posY, scale });
		}
	}, [walls, width, height]);

	// Update stage transform state on pan/zoom
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

			let direction = e.evt.deltaY > 0 ? -1 : 1;

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

	const handleStageMouseDown = React.useCallback(
		(e: KonvaEventObject<MouseEvent> | KonvaEventObject<TouchEvent>) => {
			const stage = e.target.getStage();
			if (stage) {
				const pos = stage.getPointerPosition();
				if (pos) {
					dragStartPos.current = { x: pos.x, y: pos.y };
				}
			}
			setIsDragging(false);
		},
		[]
	);

	const handleStageMouseMove = React.useCallback(() => {
		if (dragStartPos.current) {
			setIsDragging(true);
			updateStageTransform();
		}
	}, [updateStageTransform]);

	React.useEffect(() => {
		window.addEventListener('mousemove', handleStageMouseMove);
		window.addEventListener('pointermove', handleStageMouseMove);
		return () => {
			window.removeEventListener('mousemove', handleStageMouseMove);
			window.removeEventListener('pointermove', handleStageMouseMove);
		};
	}, [handleStageMouseMove]);

	const handleStageMouseUp = React.useCallback(() => {
		if (!isDragging) {
			// Close expanded clusters if clicking on stage background
			setExpandedRoomId(null);
		}
		dragStartPos.current = null;
		setTimeout(() => setIsDragging(false), 50); // Small delay to allow click events to check drag state
		updateStageTransform();
	}, [updateStageTransform, isDragging]);

	const handleStageDragEnd = React.useCallback(() => {
		updateStageTransform();
	}, [updateStageTransform]);

	const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
		return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
	};

	const getCenter = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
		return {
			x: (p1.x + p2.x) / 2,
			y: (p1.y + p2.y) / 2,
		};
	};

	const handleTouchMove = React.useCallback(
		(e: KonvaEventObject<TouchEvent>) => {
			e.evt.preventDefault();
			const stage = stageRef.current;
			if (!stage) {
				return;
			}

			const touch1 = e.evt.touches[0];
			const touch2 = e.evt.touches[1];

			if (touch1 && touch2) {
				// Pinch gesture with two touches
				const p1 = { x: touch1.clientX, y: touch1.clientY };
				const p2 = { x: touch2.clientX, y: touch2.clientY };

				const newCenter = getCenter(p1, p2);
				const dist = getDistance(p1, p2);

				if (lastDist.current === 0) {
					lastDist.current = dist;
					lastCenter.current = newCenter;
					return;
				}

				const oldScale = stage.scaleX();
				const pointTo = {
					x: (newCenter.x - stage.x()) / oldScale,
					y: (newCenter.y - stage.y()) / oldScale,
				};

				const scale = oldScale * (dist / lastDist.current);
				stage.scale({ x: scale, y: scale });

				const newPos = {
					x: newCenter.x - pointTo.x * scale,
					y: newCenter.y - pointTo.y * scale,
				};
				stage.position(newPos);

				lastDist.current = dist;
				lastCenter.current = newCenter;
				updateStageTransform();
			}
		},
		[updateStageTransform]
	);

	const handleTouchEnd = React.useCallback(() => {
		lastDist.current = 0;
		lastCenter.current = null;
	}, []);

	const handleTouchStart = React.useCallback(
		(e: KonvaEventObject<TouchEvent>) => {
			if (e.evt.touches.length === 2) {
				// Two finger touch - prepare for pinch zoom
				const touch1 = e.evt.touches[0];
				const touch2 = e.evt.touches[1];
				const p1 = { x: touch1.clientX, y: touch1.clientY };
				const p2 = { x: touch2.clientX, y: touch2.clientY };
				lastDist.current = getDistance(p1, p2);
				lastCenter.current = getCenter(p1, p2);
			} else if (e.evt.touches.length === 1) {
				handleStageMouseDown(e);
			}
		},
		[handleStageMouseDown]
	);

	// Group devices by room and calculate cluster representations
	const roomsWithClusters = React.useMemo(() => {
		return detectedRooms
			.filter((room) => roomMappings[room.id])
			.map((room) => {
				const mappedRoomName = roomMappings[room.id];
				const roomInfo = availableRooms[mappedRoomName];
				const roomDevices = props.devices.filter((d) => d.room === mappedRoomName);

				// Find which clusters are represented in this room
				const allClusters = new Set<DeviceClusterName>();
				for (const device of roomDevices) {
					for (const cluster of device.mergedAllClusters) {
						allClusters.add(cluster.name);
					}
				}

				// Filter to only relevant clusters (matching ClusterIconButton behavior)
				const representedClusters = getRelevantClusters(Array.from(allClusters));

				// Build cluster info with icons
				const clusterInfo = representedClusters.map((clusterName) => {
					// Find a device with this cluster to get the icon
					let icon: IncludedIconNames | null = null;
					for (const device of roomDevices) {
						for (const cluster of device.mergedAllClusters) {
							if (cluster.name === clusterName && cluster.icon) {
								icon = cluster.icon;
								break;
							}
							// Special case for ON_OFF merged into COLOR_CONTROL
							if (
								clusterName === DeviceClusterName.ON_OFF &&
								cluster.name === DeviceClusterName.COLOR_CONTROL &&
								cluster.mergedClusters[DeviceClusterName.ON_OFF]?.icon
							) {
								icon = cluster.mergedClusters[DeviceClusterName.ON_OFF].icon;
								break;
							}
						}
						if (icon) {
							break;
						}
					}
					return { clusterName, icon };
				});

				return {
					room,
					mappedRoomName,
					roomInfo,
					roomDevices,
					representedClusters,
					clusterInfo,
				};
			});
	}, [detectedRooms, roomMappings, availableRooms, props.devices]);

	const handleRoomClick = (roomName: string) => {
		// Close expanded clusters
		setExpandedRoomId(null);
		// Only navigate if we didn't drag
		if (!isDragging) {
			props.pushDetailView({
				type: 'room',
				roomName: roomName,
			});
		}
	};

	const handleClusterClick = (clusterName: DeviceClusterName, roomName: string) => {
		// Navigate to cluster detail view
		props.pushDetailView({
			type: 'room',
			roomName: roomName,
			clustersName: clusterName,
		});
	};

	const handleClusterAction = async (
		clusterName: DeviceClusterName,
		roomDevices: DeviceListWithValuesResponse
	) => {
		// Execute cluster action (short press behavior)
		if (clusterName === DeviceClusterName.ON_OFF) {
			const devices = roomDevices.filter((device) =>
				device.mergedAllClusters.some(
					(c) =>
						c.name === DeviceClusterName.ON_OFF ||
						(c.name === DeviceClusterName.COLOR_CONTROL &&
							c.mergedClusters[DeviceClusterName.ON_OFF])
				)
			);
			const anyEnabled = devices
				.flatMap((d) => d.mergedAllClusters)
				.some(
					(d) =>
						(d.name === DeviceClusterName.ON_OFF && d.isOn) ||
						(d.name === DeviceClusterName.COLOR_CONTROL &&
							d.mergedClusters[DeviceClusterName.ON_OFF]?.isOn)
				);

			await apiPost(
				'device',
				'/cluster/OnOff',
				{},
				{
					deviceIds: devices.map((d) => d.uniqueId),
					isOn: !anyEnabled,
				}
			);
			props.invalidate();
		} else if (clusterName === DeviceClusterName.WINDOW_COVERING) {
			const devices = roomDevices.filter((device) =>
				device.mergedAllClusters.some((c) => c.name === DeviceClusterName.WINDOW_COVERING)
			);
			const anyEnabled = devices
				.flatMap((d) => d.mergedAllClusters)
				.filter((c) => c.name === DeviceClusterName.WINDOW_COVERING)
				.some((d) => d.targetPositionLiftPercentage < 5);

			await apiPost(
				'device',
				'/cluster/WindowCovering',
				{},
				{
					deviceIds: devices.map((d) => d.uniqueId),
					targetPositionLiftPercentage: anyEnabled ? 100 : 0,
				}
			);
			props.invalidate();
		} else if (clusterName === DeviceClusterName.COLOR_CONTROL) {
			// For color control, go directly to detail view (same as ClusterIconButton)
			// We'll handle this in the touch logic
		}
	};

	return (
		<Box
			ref={containerRef}
			sx={{
				height: '100%',
				width: '100%',
				display: 'flex',
				flexDirection: 'column',
				position: 'relative',
				overflow: 'hidden',
			}}
		>
			<Stage
				ref={stageRef}
				width={width}
				height={height}
				style={{
					border: '1px solid #ccc',
					borderRadius: 10,
					touchAction: 'none',
				}}
				onWheel={handleWheel}
				onMouseDown={handleStageMouseDown}
				onMouseUp={handleStageMouseUp}
				onDragEnd={handleStageDragEnd}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				draggable={true}
			>
				<Layer>
					{/* Walls */}
					{walls.map((wall) => (
						<Line
							key={wall.id}
							points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
							stroke={WALL_COLOR}
							strokeWidth={WALL_THICKNESS}
						/>
					))}

					{/* Doors */}
					{doors.map((door) => (
						<Line
							key={door.id}
							points={[door.start.x, door.start.y, door.end.x, door.end.y]}
							stroke="#FFF"
							opacity={0.8}
							globalCompositeOperation="destination-out"
							strokeWidth={WALL_THICKNESS + 1}
						/>
					))}
				</Layer>

				<Layer>
					{/* Rooms */}
					{roomsWithClusters.map((roomData) => {
						return (
							<React.Fragment key={roomData.room.id}>
								{/* Room polygon */}
								<Line
									points={roomData.room.polygon.map((p) => [p.x, p.y]).flat()}
									fill={
										roomData.roomInfo?.color
											? `${roomData.roomInfo.color}80`
											: '#00000030'
									}
									stroke={roomData.roomInfo?.color || '#ccc'}
									strokeWidth={2}
									closed
									onMouseOver={cursorPointer}
									onMouseOut={cursorDefault}
									onClick={() => handleRoomClick(roomData.mappedRoomName)}
								/>
							</React.Fragment>
						);
					})}
				</Layer>
			</Stage>

			{/* Overlay for SVG icons */}
			<Box
				sx={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: width,
					height: height,
					pointerEvents: 'none',
					overflow: 'hidden',
				}}
			>
				{roomsWithClusters.map((roomData) => {
					// Calculate cluster icon positions
					const clusterIconSize = 48;
					const clusterIconSpacingScreen = 56; // spacing in screen space
					const clusterIconSpacing = clusterIconSpacingScreen / stageTransform.scale; // convert to world space
					const totalClusterWidth =
						roomData.clusterInfo.length * clusterIconSpacing -
						(roomData.clusterInfo.length > 0
							? clusterIconSpacing - clusterIconSize / stageTransform.scale
							: 0);
					const clusterStartX = roomData.room.center.x - totalClusterWidth / 2;
					const clusterY = roomData.room.center.y + 30 / stageTransform.scale;

					return (
						<React.Fragment key={`overlay-${roomData.room.id}`}>
							{/* Room icon */}
							{roomData.roomInfo?.icon && (
								<Box
									sx={{
										position: 'absolute',
										left:
											roomData.room.center.x * stageTransform.scale +
											stageTransform.x -
											16,
										top:
											roomData.room.center.y * stageTransform.scale +
											stageTransform.y -
											16,
										color: 'rgba(0, 0, 0, 0.6)',
										fontSize: '32px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										pointerEvents: 'none',
									}}
								>
									<IconComponent iconName={roomData.roomInfo.icon} />
								</Box>
							)}

							{/* Cluster expand button or cluster icons */}
							{expandedRoomId === roomData.room.id
								? // Show cluster icons when expanded
									roomData.clusterInfo.map((clusterData, index) => {
										const x = clusterStartX + index * clusterIconSpacing;
										const screenX = x * stageTransform.scale + stageTransform.x;
										const screenY =
											clusterY * stageTransform.scale + stageTransform.y;

										// Determine if cluster is enabled
										let isEnabled = false;
										if (clusterData.clusterName === DeviceClusterName.ON_OFF) {
											const devices = roomData.roomDevices.filter((device) =>
												device.mergedAllClusters.some(
													(c) =>
														c.name === DeviceClusterName.ON_OFF ||
														(c.name ===
															DeviceClusterName.COLOR_CONTROL &&
															c.mergedClusters[
																DeviceClusterName.ON_OFF
															])
												)
											);
											isEnabled = devices
												.flatMap((d) => d.mergedAllClusters)
												.some(
													(d) =>
														(d.name === DeviceClusterName.ON_OFF &&
															d.isOn) ||
														(d.name ===
															DeviceClusterName.COLOR_CONTROL &&
															d.mergedClusters[
																DeviceClusterName.ON_OFF
															]?.isOn)
												);
										} else if (
											clusterData.clusterName ===
											DeviceClusterName.WINDOW_COVERING
										) {
											const devices = roomData.roomDevices.filter((device) =>
												device.mergedAllClusters.some(
													(c) =>
														c.name === DeviceClusterName.WINDOW_COVERING
												)
											);
											isEnabled = devices
												.flatMap((d) => d.mergedAllClusters)
												.filter(
													(c) =>
														c.name === DeviceClusterName.WINDOW_COVERING
												)
												.some((d) => d.targetPositionLiftPercentage < 5);
										} else if (
											clusterData.clusterName ===
											DeviceClusterName.COLOR_CONTROL
										) {
											const devices = roomData.roomDevices.filter((device) =>
												device.mergedAllClusters.some(
													(c) =>
														c.name === DeviceClusterName.ON_OFF ||
														(c.name ===
															DeviceClusterName.COLOR_CONTROL &&
															c.mergedClusters[
																DeviceClusterName.ON_OFF
															])
												)
											);
											isEnabled = devices
												.flatMap((d) => d.mergedAllClusters)
												.some(
													(d) =>
														(d.name === DeviceClusterName.ON_OFF &&
															d.isOn) ||
														(d.name ===
															DeviceClusterName.COLOR_CONTROL &&
															d.mergedClusters[
																DeviceClusterName.ON_OFF
															]?.isOn)
												);
										}

										if (!clusterData.icon) {
											return null;
										}

										return (
											<IconButton
												key={`${roomData.room.id}-${clusterData.clusterName}`}
												sx={{
													position: 'absolute',
													left: screenX - clusterIconSize / 2,
													top: screenY - clusterIconSize / 2,
													width: clusterIconSize,
													height: clusterIconSize,
													backgroundColor: isEnabled
														? '#ffffff'
														: 'rgba(255, 255, 255, 0.5)',
													color: isEnabled
														? '#2a2a2a'
														: 'rgba(0, 0, 0, 0.5)',
													pointerEvents: 'auto',
													fontSize: '20px',
													'&:hover': {
														backgroundColor: isEnabled
															? '#f0f0f0'
															: 'rgba(255, 255, 255, 0.7)',
													},
												}}
												onPointerDown={(e) => {
													e.stopPropagation();
													e.preventDefault();
													const timer = setTimeout(() => {
														handleClusterClick(
															clusterData.clusterName,
															roomData.mappedRoomName
														);
														document.removeEventListener(
															'pointerup',
															handlePointerUp
														);
													}, 500);

													const handlePointerUp = () => {
														clearTimeout(timer);
														void handleClusterAction(
															clusterData.clusterName,
															roomData.roomDevices
														);
														document.removeEventListener(
															'pointerup',
															handlePointerUp
														);
													};

													document.addEventListener(
														'pointerup',
														handlePointerUp
													);
												}}
											>
												<IconComponent iconName={clusterData.icon} />
											</IconButton>
										);
									})
								: // Show "..." button when collapsed
									roomData.clusterInfo.length > 0 && (
										<IconButton
											key={`${roomData.room.id}-ellipsis`}
											sx={{
												position: 'absolute',
												left:
													roomData.room.center.x * stageTransform.scale +
													stageTransform.x -
													24,
												top:
													(roomData.room.center.y +
														30 / stageTransform.scale) *
														stageTransform.scale +
													stageTransform.y -
													24,
												width: 48,
												height: 48,
												backgroundColor: 'rgba(255, 255, 255, 0.9)',
												color: 'rgba(0, 0, 0, 0.6)',
												pointerEvents: 'auto',
												fontSize: '20px',
												fontWeight: 'bold',
												'&:hover': {
													backgroundColor: '#ffffff',
												},
											}}
											onClick={(e) => {
												e.stopPropagation();
												if (!isDragging) {
													setExpandedRoomId(
														expandedRoomId === roomData.room.id
															? null
															: roomData.room.id
													);
												}
											}}
											onPointerDown={(e) => {
												e.stopPropagation();
												e.preventDefault();
												if (!isDragging) {
													setExpandedRoomId(
														expandedRoomId === roomData.room.id
															? null
															: roomData.room.id
													);
												}
											}}
										>
											...
										</IconButton>
									)}
						</React.Fragment>
					);
				})}
			</Box>
		</Box>
	);
};

function calculateBoundingBox(walls: WallSegment[]): {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	width: number;
	height: number;
} {
	if (walls.length === 0) {
		return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
	}

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const wall of walls) {
		minX = Math.min(minX, wall.start.x, wall.end.x);
		minY = Math.min(minY, wall.start.y, wall.end.y);
		maxX = Math.max(maxX, wall.start.x, wall.end.x);
		maxY = Math.max(maxY, wall.start.y, wall.end.y);
	}

	return {
		minX,
		minY,
		maxX,
		maxY,
		width: maxX - minX,
		height: maxY - minY,
	};
}
