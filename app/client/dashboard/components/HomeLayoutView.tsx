import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';
import { DeviceClusterName } from '../../../server/modules/device/cluster';
import { Circle, Layer, Line, Stage, Text, Group } from 'react-konva';
import type { WallSegment, DoorSlot } from '../types/layout';
// @ts-expect-error - konva ESM/CommonJS type resolution issue
import type { Stage as StageType } from 'konva/lib/Stage';
import type { RoomInfo } from './RoomAssignmentDialog';
// @ts-expect-error - konva ESM/CommonJS type resolution issue
import type { KonvaEventObject } from 'konva/lib/Node';
import { detectRooms } from '../lib/room-detection';
import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../lib/fetch';
import type { HomeDetailView } from './Home';
import { Box, IconButton } from '@mui/material';
import { IconComponent } from './icon';
import type { IncludedIconNames } from './icon';

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

	const width = window.innerWidth - 240;
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

	const handleStageMouseDown = React.useCallback((e: KonvaEventObject<MouseEvent>) => {
		const stage = e.target.getStage();
		if (stage) {
			const pos = stage.getPointerPosition();
			if (pos) {
				dragStartPos.current = { x: pos.x, y: pos.y };
			}
		}
		setIsDragging(false);
	}, []);

	const handleStageMouseMove = React.useCallback(() => {
		if (dragStartPos.current) {
			setIsDragging(true);
		}
	}, []);

	const handleStageMouseUp = React.useCallback(() => {
		dragStartPos.current = null;
		setTimeout(() => setIsDragging(false), 50); // Small delay to allow click events to check drag state
		updateStageTransform();
	}, [updateStageTransform]);

	const handleStageDragEnd = React.useCallback(() => {
		updateStageTransform();
	}, [updateStageTransform]);

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
								icon = cluster.icon as IncludedIconNames;
								break;
							}
							// Special case for ON_OFF merged into COLOR_CONTROL
							if (
								clusterName === DeviceClusterName.ON_OFF &&
								cluster.name === DeviceClusterName.COLOR_CONTROL &&
								cluster.mergedClusters[DeviceClusterName.ON_OFF]?.icon
							) {
								icon = cluster.mergedClusters[DeviceClusterName.ON_OFF]
									.icon as IncludedIconNames;
								break;
							}
						}
						if (icon) break;
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
			sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
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
				onWheel={handleWheel}
				onMouseDown={handleStageMouseDown}
				onMouseMove={handleStageMouseMove}
				onMouseUp={handleStageMouseUp}
				onDragEnd={handleStageDragEnd}
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
											? `${roomData.roomInfo.color}33`
											: '#00000010'
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
					left: 20,
					width: width,
					height: height,
					pointerEvents: 'none',
					overflow: 'hidden',
				}}
			>
				{roomsWithClusters.map((roomData) => {
					// Calculate cluster icon positions
					const clusterIconSize = 48;
					const clusterIconSpacing = 56;
					const totalClusterWidth =
						roomData.clusterInfo.length * clusterIconSpacing -
						(roomData.clusterInfo.length > 0 ? clusterIconSpacing - clusterIconSize : 0);
					const clusterStartX = roomData.room.center.x - totalClusterWidth / 2;
					const clusterY = roomData.room.center.y + 30;

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
										fontSize: `${32 * stageTransform.scale}px`,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										pointerEvents: 'none',
									}}
								>
									<IconComponent iconName={roomData.roomInfo.icon} />
								</Box>
							)}

							{/* Cluster icons */}
							{roomData.clusterInfo.map((clusterData, index) => {
								const x = clusterStartX + index * clusterIconSpacing;

								// Determine if cluster is enabled
								let isEnabled = false;
								if (clusterData.clusterName === DeviceClusterName.ON_OFF) {
									const devices = roomData.roomDevices.filter((device) =>
										device.mergedAllClusters.some(
											(c) =>
												c.name === DeviceClusterName.ON_OFF ||
												(c.name === DeviceClusterName.COLOR_CONTROL &&
													c.mergedClusters[DeviceClusterName.ON_OFF])
										)
									);
									isEnabled = devices
										.flatMap((d) => d.mergedAllClusters)
										.some(
											(d) =>
												(d.name === DeviceClusterName.ON_OFF && d.isOn) ||
												(d.name === DeviceClusterName.COLOR_CONTROL &&
													d.mergedClusters[DeviceClusterName.ON_OFF]?.isOn)
										);
								} else if (clusterData.clusterName === DeviceClusterName.WINDOW_COVERING) {
									const devices = roomData.roomDevices.filter((device) =>
										device.mergedAllClusters.some(
											(c) => c.name === DeviceClusterName.WINDOW_COVERING
										)
									);
									isEnabled = devices
										.flatMap((d) => d.mergedAllClusters)
										.filter((c) => c.name === DeviceClusterName.WINDOW_COVERING)
										.some((d) => d.targetPositionLiftPercentage < 5);
								} else if (clusterData.clusterName === DeviceClusterName.COLOR_CONTROL) {
									const devices = roomData.roomDevices.filter((device) =>
										device.mergedAllClusters.some(
											(c) =>
												c.name === DeviceClusterName.ON_OFF ||
												(c.name === DeviceClusterName.COLOR_CONTROL &&
													c.mergedClusters[DeviceClusterName.ON_OFF])
										)
									);
									isEnabled = devices
										.flatMap((d) => d.mergedAllClusters)
										.some(
											(d) =>
												(d.name === DeviceClusterName.ON_OFF && d.isOn) ||
												(d.name === DeviceClusterName.COLOR_CONTROL &&
													d.mergedClusters[DeviceClusterName.ON_OFF]?.isOn)
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
											left: x * stageTransform.scale + stageTransform.x,
											top: clusterY * stageTransform.scale + stageTransform.y,
											width: clusterIconSize * stageTransform.scale,
											height: clusterIconSize * stageTransform.scale,
											backgroundColor: isEnabled
												? '#ffffff'
												: 'rgba(255, 255, 255, 0.5)',
											color: isEnabled
												? '#2a2a2a'
												: 'rgba(0, 0, 0, 0.5)',
											pointerEvents: 'auto',
											fontSize: `${20 * stageTransform.scale}px`,
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

											document.addEventListener('pointerup', handlePointerUp);
										}}
									>
										<IconComponent iconName={clusterData.icon} />
									</IconButton>
								);
							})}
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
