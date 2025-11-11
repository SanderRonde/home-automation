import type { Point, WallSegment, DetectedRoom } from '../types/layout';

const EPSILON = 5; // Tolerance for vertex merging (pixels)
const MIN_ROOM_AREA = 100; // Minimum area in square pixels

/**
 * Edge in the planar graph
 */
interface GraphEdge {
	from: string; // vertex key
	to: string; // vertex key
	wallId: string;
	angle: number; // angle from source vertex
	toPoint: Point;
}

/**
 * Planar graph representation
 */
interface PlanarGraph {
	vertices: Map<string, Point>; // vertex key -> point
	edges: Map<string, GraphEdge[]>; // vertex key -> outgoing edges sorted by angle
}

/**
 * Detects rooms from wall segments using planar graph cycle detection
 */
export function detectRooms(
	walls: WallSegment[],
	canvasWidth: number,
	canvasHeight: number
): DetectedRoom[] {
	if (walls.length === 0) {
		return [];
	}

	// Build planar graph from walls
	const graph = buildPlanarGraph(walls);

	// Find all minimal cycles
	const cycles = findMinimalCycles(graph);

	// Convert cycles to polygons and filter
	const maxArea = canvasWidth * canvasHeight * 0.8;

	// Remove duplicate cycles (same vertices in reverse order)
	const uniqueCycles = filterDuplicateCycles(cycles);

	return uniqueCycles
		.map((cycle) => cycleToPolygon(cycle, graph))
		.filter((polygon) => isValidRoom(polygon, maxArea))
		.map((polygon, i) => ({
			id: `room_${i}`,
			polygon,
			center: calculateCenter(polygon),
		}));
}

/**
 * Build planar graph from wall segments, creating vertices at all intersections
 */
function buildPlanarGraph(walls: WallSegment[]): PlanarGraph {
	const vertices = new Map<string, Point>();
	const edges = new Map<string, GraphEdge[]>();

	// Helper to get or add a vertex
	const getOrAddVertex = (point: Point): string => {
		// Check if a nearby vertex already exists
		for (const [key, existingPoint] of vertices.entries()) {
			const dist = Math.hypot(point.x - existingPoint.x, point.y - existingPoint.y);
			if (dist < EPSILON) {
				return key;
			}
		}

		// Add new vertex
		const key = `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
		vertices.set(key, point);
		return key;
	};

	// Helper to add an edge between two points
	const addEdge = (from: Point, to: Point, wallId: string): void => {
		const fromKey = getOrAddVertex(from);
		const toKey = getOrAddVertex(to);

		if (fromKey === toKey) {
			return; // Skip zero-length edges
		}

		const fromPoint = vertices.get(fromKey)!;
		const toPoint = vertices.get(toKey)!;

		// Calculate angles
		const angleFromStart = Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x);
		const angleFromEnd = Math.atan2(fromPoint.y - toPoint.y, fromPoint.x - toPoint.x);

		// Add edge from start to end
		if (!edges.has(fromKey)) {
			edges.set(fromKey, []);
		}
		edges.get(fromKey)!.push({
			from: fromKey,
			to: toKey,
			wallId,
			angle: angleFromStart,
			toPoint,
		});

		// Add edge from end to start (bidirectional)
		if (!edges.has(toKey)) {
			edges.set(toKey, []);
		}
		edges.get(toKey)!.push({
			from: toKey,
			to: fromKey,
			wallId,
			angle: angleFromEnd,
			toPoint: fromPoint,
		});
	};

	// Step 1: Find all intersection points for each wall
	interface WallWithIntersections {
		wall: WallSegment;
		intersections: Array<{ point: Point; t: number }>; // t is position along wall [0,1]
	}

	const wallsWithIntersections: WallWithIntersections[] = walls.map((wall) => ({
		wall,
		intersections: [],
	}));

	// Find all T-junctions and crossings
	for (let i = 0; i < walls.length; i++) {
		const wall1 = walls[i];
		for (let j = i + 1; j < walls.length; j++) {
			const wall2 = walls[j];

			// Check if wall1's endpoints are near wall2
			const startOnWall2 = pointOnSegment(wall1.start, wall2.start, wall2.end, EPSILON);
			if (startOnWall2 !== null && startOnWall2.t > 0.01 && startOnWall2.t < 0.99) {
				wallsWithIntersections[j].intersections.push({
					point: wall1.start,
					t: startOnWall2.t,
				});
			}

			const endOnWall2 = pointOnSegment(wall1.end, wall2.start, wall2.end, EPSILON);
			if (endOnWall2 !== null && endOnWall2.t > 0.01 && endOnWall2.t < 0.99) {
				wallsWithIntersections[j].intersections.push({
					point: wall1.end,
					t: endOnWall2.t,
				});
			}

			// Check if wall2's endpoints are near wall1
			const startOnWall1 = pointOnSegment(wall2.start, wall1.start, wall1.end, EPSILON);
			if (startOnWall1 !== null && startOnWall1.t > 0.01 && startOnWall1.t < 0.99) {
				wallsWithIntersections[i].intersections.push({
					point: wall2.start,
					t: startOnWall1.t,
				});
			}

			const endOnWall1 = pointOnSegment(wall2.end, wall1.start, wall1.end, EPSILON);
			if (endOnWall1 !== null && endOnWall1.t > 0.01 && endOnWall1.t < 0.99) {
				wallsWithIntersections[i].intersections.push({
					point: wall2.end,
					t: endOnWall1.t,
				});
			}
		}
	}

	// Step 2: Build edges, splitting walls at intersections
	for (const wallWithIntersections of wallsWithIntersections) {
		const { wall, intersections } = wallWithIntersections;

		if (intersections.length === 0) {
			// No intersections, add the wall as a single edge
			addEdge(wall.start, wall.end, wall.id);
		} else {
			// Sort intersections by position along the wall
			intersections.sort((a, b) => a.t - b.t);

			// Add edge from start to first intersection
			let prevPoint = wall.start;
			for (const intersection of intersections) {
				addEdge(prevPoint, intersection.point, wall.id);
				prevPoint = intersection.point;
			}
			// Add edge from last intersection to end
			addEdge(prevPoint, wall.end, wall.id);
		}
	}

	// Sort edges at each vertex by angle
	for (const edgeList of edges.values()) {
		edgeList.sort((a, b) => a.angle - b.angle);
	}

	return { vertices, edges };
}

/**
 * Check if a point lies on a line segment
 * Returns { point, t } where t is the position along the segment [0,1], or null if not on segment
 */
function pointOnSegment(
	point: Point,
	segStart: Point,
	segEnd: Point,
	tolerance: number
): { point: Point; t: number } | null {
	const dx = segEnd.x - segStart.x;
	const dy = segEnd.y - segStart.y;
	const len2 = dx * dx + dy * dy;

	if (len2 === 0) {
		return null;
	}

	// Calculate parameter t of projection
	let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / len2;
	t = Math.max(0, Math.min(1, t));

	// Calculate closest point on segment
	const projX = segStart.x + t * dx;
	const projY = segStart.y + t * dy;

	// Check if point is close enough to segment
	const dist = Math.hypot(point.x - projX, point.y - projY);

	if (dist <= tolerance) {
		return { point: { x: projX, y: projY }, t };
	}

	return null;
}

/**
 * Find all minimal cycles in the planar graph using rightmost-turn traversal
 */
function findMinimalCycles(graph: PlanarGraph): string[][] {
	const cycles: string[][] = [];

	const edgeKey = (from: string, to: string): string => `${from}->${to}`;

	// Try starting from each edge - don't mark as visited globally
	// since edges can be shared between multiple rooms
	for (const edgeList of graph.edges.values()) {
		for (const startEdge of edgeList) {
			const edgeId = edgeKey(startEdge.from, startEdge.to);

			// Traverse to find cycle
			const cycle: string[] = [startEdge.from];
			let currentVertex = startEdge.to;
			let incomingAngle = startEdge.angle;
			let valid = true;
			const edgesInCycle: string[] = [edgeId];

			let previousVertex = startEdge.from;

			while (currentVertex !== startEdge.from) {
				cycle.push(currentVertex);

				const outgoingEdges = graph.edges.get(currentVertex);
				if (!outgoingEdges || outgoingEdges.length === 0) {
					valid = false;
					break;
				}

				// Find the rightmost turn (smallest angle clockwise from incoming direction)
				// Incoming angle + PI is the direction we came from
				const reverseAngle = normalizeAngle(incomingAngle + Math.PI);

				// Find edge with smallest positive angle difference from reverse angle
				// IMPORTANT: Exclude the edge back to where we came from
				let bestEdge: GraphEdge | null = null;
				let bestAngleDiff = Infinity;

				for (const edge of outgoingEdges) {
					// Skip the edge that goes back to the previous vertex
					if (edge.to === previousVertex) {
						continue;
					}

					const angleDiff = normalizeAngle(edge.angle - reverseAngle);
					if (angleDiff < bestAngleDiff) {
						bestAngleDiff = angleDiff;
						bestEdge = edge;
					}
				}

				if (!bestEdge) {
					valid = false;
					break;
				}

				const nextEdgeId = edgeKey(bestEdge.from, bestEdge.to);

				// Check if we've already visited this edge in this cycle
				if (edgesInCycle.includes(nextEdgeId)) {
					valid = false;
					break;
				}

				edgesInCycle.push(nextEdgeId);
				previousVertex = currentVertex;
				currentVertex = bestEdge.to;
				incomingAngle = bestEdge.angle;

				// Safety check: max cycle length
				if (cycle.length > 1000) {
					valid = false;
					break;
				}
			}

			if (valid && cycle.length >= 3) {
				// Don't mark edges as visited - allow them to be used in multiple rooms
				// Deduplication happens later in filterDuplicateCycles
				cycles.push(cycle);
			}
		}
	}

	return cycles;
}

/**
 * Filter out duplicate cycles (same vertices in different order/direction)
 */
function filterDuplicateCycles(cycles: string[][]): string[][] {
	const seen = new Set<string>();
	const unique: string[][] = [];

	for (const cycle of cycles) {
		// Create a normalized representation of the cycle
		// Find the lexicographically smallest rotation
		const normalized = normalizeVertexCycle(cycle);
		const key = normalized.join('|');

		if (!seen.has(key)) {
			seen.add(key);
			unique.push(cycle);
		}
	}

	return unique;
}

/**
 * Normalize a cycle to its canonical form (smallest lexicographic rotation)
 * This handles both forward and reverse directions
 */
function normalizeVertexCycle(cycle: string[]): string[] {
	if (cycle.length === 0) {
		return cycle;
	}

	// Try both forward and reverse directions
	const forward = [...cycle];
	const reverse = [...cycle].reverse();

	const getMinRotation = (arr: string[]): string[] => {
		let minRotation = arr;
		let minStr = arr.join('|');

		for (let i = 1; i < arr.length; i++) {
			const rotation = [...arr.slice(i), ...arr.slice(0, i)];
			const rotStr = rotation.join('|');
			if (rotStr < minStr) {
				minStr = rotStr;
				minRotation = rotation;
			}
		}

		return minRotation;
	};

	const forwardMin = getMinRotation(forward);
	const reverseMin = getMinRotation(reverse);

	// Return the lexicographically smaller one
	return forwardMin.join('|') < reverseMin.join('|') ? forwardMin : reverseMin;
}

/**
 * Normalize angle to [0, 2*PI)
 */
function normalizeAngle(angle: number): number {
	const TWO_PI = 2 * Math.PI;
	let normalized = angle % TWO_PI;
	if (normalized < 0) {
		normalized += TWO_PI;
	}
	return normalized;
}

/**
 * Convert a cycle of vertex keys to a polygon of points
 */
function cycleToPolygon(cycle: string[], graph: PlanarGraph): Point[] {
	return cycle.map((vertexKey) => graph.vertices.get(vertexKey)!);
}

/**
 * Check if a polygon represents a valid room
 */
function isValidRoom(polygon: Point[], maxArea: number): boolean {
	if (polygon.length < 3) {
		return false;
	}

	const area = Math.abs(calculatePolygonArea(polygon));

	// Filter out exterior face (very large) and too small rooms
	if (area > maxArea || area < MIN_ROOM_AREA) {
		return false;
	}

	return true;
}

/**
 * Calculate signed area of a polygon using shoelace formula
 */
function calculatePolygonArea(polygon: Point[]): number {
	if (polygon.length < 3) {
		return 0;
	}

	let area = 0;
	for (let i = 0; i < polygon.length; i++) {
		const current = polygon[i];
		const next = polygon[(i + 1) % polygon.length];
		area += current.x * next.y - next.x * current.y;
	}

	return area / 2;
}

/**
 * Calculate the center point of a polygon
 */
function calculateCenter(polygon: Point[]): Point {
	if (polygon.length === 0) {
		return { x: 0, y: 0 };
	}

	let sumX = 0;
	let sumY = 0;

	for (const point of polygon) {
		sumX += point.x;
		sumY += point.y;
	}

	return {
		x: sumX / polygon.length,
		y: sumY / polygon.length,
	};
}
