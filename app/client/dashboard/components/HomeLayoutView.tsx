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
import { Box } from '@mui/material';

interface HomeLayoutViewProps {
	devices: DeviceListWithValuesResponse;
	pushDetailView: (detailView: HomeDetailView) => void;
	invalidate: () => void;
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

// Map cluster names to emoji icons
const clusterToEmoji: Partial<Record<DeviceClusterName, string>> = {
	[DeviceClusterName.ON_OFF]: '💡',
	[DeviceClusterName.COLOR_CONTROL]: '🎨',
	[DeviceClusterName.WINDOW_COVERING]: '🪟',
	[DeviceClusterName.SWITCH]: '🔘',
	[DeviceClusterName.LEVEL_CONTROL]: '🔆',
	[DeviceClusterName.THERMOSTAT]: '🌡️',
};

const WALL_THICKNESS = 6;
const WALL_COLOR = '#ccc';

export const HomeLayoutView = (props: HomeLayoutViewProps): JSX.Element => {
	const [walls, setWalls] = useState<WallSegment[]>([]);
	const [doors, setDoors] = useState<DoorSlot[]>([]);
	const [roomMappings, setRoomMappings] = useState<Record<string, string>>({});
	const [availableRooms, setAvailableRooms] = useState<Record<string, RoomInfo>>({});
	const stageRef = React.useRef<StageType | null>(null);
	const [isDragging, setIsDragging] = React.useState(false);
	const dragStartPos = React.useRef<{ x: number; y: number } | null>(null);

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

			stageRef.current.scale({ x: scale, y: scale });
			// Center the content
			stageRef.current.position({
				x: (width - bbox.width * scale) / 2 - bbox.minX * scale,
				y: (height - bbox.height * scale) / 2 - bbox.minY * scale,
			});
		}
	}, [walls, width, height]);

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
	}, []);

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
	}, []);

	// Group devices by room and calculate cluster representations
	const roomsWithClusters = React.useMemo(() => {
		return detectedRooms
			.filter((room) => roomMappings[room.id])
			.map((room) => {
				const mappedRoomName = roomMappings[room.id];
				const roomInfo = availableRooms[mappedRoomName];
				const roomDevices = props.devices.filter((d) => d.room === mappedRoomName);

				// Find which clusters are represented in this room
				const representedClusters = new Set<DeviceClusterName>();
				for (const device of roomDevices) {
					for (const cluster of device.mergedAllClusters) {
						representedClusters.add(cluster.name);
					}
				}

				return {
					room,
					mappedRoomName,
					roomInfo,
					roomDevices,
					representedClusters: Array.from(representedClusters).sort(),
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
		<Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
					{/* Rooms with cluster icons */}
					{roomsWithClusters.map((roomData) => {
						const iconEmoji = roomData.roomInfo?.icon
							? iconToEmoji[roomData.roomInfo.icon] || '🏠'
							: '🏠';

						// Calculate cluster icon positions
						const clusterIconSize = 32;
						const clusterIconSpacing = 40;
						const totalClusterWidth =
							roomData.representedClusters.length * clusterIconSpacing -
							(roomData.representedClusters.length > 0
								? clusterIconSpacing - clusterIconSize
								: 0);
						const clusterStartX = roomData.room.center.x - totalClusterWidth / 2;
						const clusterY = roomData.room.center.y + 30;

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

								{/* Room icon - same position as VIEW mode */}
								<Text
									x={roomData.room.center.x}
									y={roomData.room.center.y}
									text={iconEmoji}
									fontSize={32}
									offsetX={16}
									offsetY={16}
									listening={false}
								/>

								{/* Cluster icons */}
								{roomData.representedClusters.map((clusterName, index) => {
									const clusterEmoji = clusterToEmoji[clusterName] || '❓';
									const x = clusterStartX + index * clusterIconSpacing;

									// Determine if cluster is enabled
									let isEnabled = false;
									if (clusterName === DeviceClusterName.ON_OFF) {
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
													(d.name === DeviceClusterName.ON_OFF &&
														d.isOn) ||
													(d.name === DeviceClusterName.COLOR_CONTROL &&
														d.mergedClusters[DeviceClusterName.ON_OFF]
															?.isOn)
											);
									} else if (clusterName === DeviceClusterName.WINDOW_COVERING) {
										const devices = roomData.roomDevices.filter((device) =>
											device.mergedAllClusters.some(
												(c) => c.name === DeviceClusterName.WINDOW_COVERING
											)
										);
										isEnabled = devices
											.flatMap((d) => d.mergedAllClusters)
											.filter(
												(c) => c.name === DeviceClusterName.WINDOW_COVERING
											)
											.some((d) => d.targetPositionLiftPercentage < 5);
									} else if (clusterName === DeviceClusterName.COLOR_CONTROL) {
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
													(d.name === DeviceClusterName.ON_OFF &&
														d.isOn) ||
													(d.name === DeviceClusterName.COLOR_CONTROL &&
														d.mergedClusters[DeviceClusterName.ON_OFF]
															?.isOn)
											);
									}

									return (
										<ClusterIcon
											key={`${roomData.room.id}-${clusterName}`}
											x={x}
											y={clusterY}
											emoji={clusterEmoji}
											isEnabled={isEnabled}
											onShortPress={() =>
												handleClusterAction(
													clusterName,
													roomData.roomDevices
												)
											}
											onLongPress={() =>
												handleClusterClick(
													clusterName,
													roomData.mappedRoomName
												)
											}
											onMouseOver={cursorPointer}
											onMouseOut={cursorDefault}
										/>
									);
								})}
							</React.Fragment>
						);
					})}
				</Layer>
			</Stage>
		</Box>
	);
};

interface ClusterIconProps {
	x: number;
	y: number;
	emoji: string;
	isEnabled: boolean;
	onShortPress: () => void;
	onLongPress: () => void;
	onMouseOver: (e: KonvaEventObject<MouseEvent>) => void;
	onMouseOut: (e: KonvaEventObject<MouseEvent>) => void;
}

const ClusterIcon = (props: ClusterIconProps): JSX.Element => {
	const [isPressed, setIsPressed] = React.useState(false);
	const timerRef = React.useRef<number | null>(null);

	const handlePointerDown = (e: KonvaEventObject<PointerEvent>) => {
		e.cancelBubble = true;
		setIsPressed(true);

		timerRef.current = window.setTimeout(() => {
			// Long press
			props.onLongPress();
			setIsPressed(false);
			timerRef.current = null;
		}, 500);
	};

	const handlePointerUp = (e: KonvaEventObject<PointerEvent>) => {
		e.cancelBubble = true;
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
			// Short press
			props.onShortPress();
		}
		setIsPressed(false);
	};

	const handlePointerOut = () => {
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		setIsPressed(false);
	};

	return (
		<Group
			x={props.x}
			y={props.y}
			onPointerDown={handlePointerDown}
			onPointerUp={handlePointerUp}
			onPointerOut={handlePointerOut}
			onMouseOver={props.onMouseOver}
			onMouseOut={props.onMouseOut}
		>
			<Circle
				x={16}
				y={16}
				radius={16}
				fill={props.isEnabled ? '#ffffff' : 'rgba(255, 255, 255, 0.5)'}
				stroke={isPressed ? '#2196f3' : 'rgba(0, 0, 0, 0.2)'}
				strokeWidth={isPressed ? 2 : 1}
			/>
			<Text
				x={16}
				y={16}
				text={props.emoji}
				fontSize={20}
				offsetX={10}
				offsetY={10}
				opacity={props.isEnabled ? 1.0 : 0.6}
			/>
		</Group>
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
