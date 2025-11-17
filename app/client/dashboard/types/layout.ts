export interface Point {
	x: number;
	y: number;
}

export interface WallSegment {
	id: string;
	start: Point;
	end: Point;
}

export interface DoorSlot {
	id: string;
	wallId: string;
	start: Point;
	end: Point;
}

export interface DetectedRoom {
	id: string;
	polygon: Point[];
	center: Point;
	systemRoomName?: string; // mapped room name
}

export interface HouseLayout {
	walls: WallSegment[];
	doors: DoorSlot[];
	roomMappings: Record<string, string>;
}

export enum DrawMode {
	VIEW = 'view',
	DRAW_WALLS = 'draw_walls',
	PLACE_DOORS = 'place_doors',
	MAP_ROOMS = 'map_rooms',
}
