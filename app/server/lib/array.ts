export function flatten<V>(arr: V[][]): V[];
export function flatten<V>(arr: V[]): V[];
export function flatten<V>(arr: V[][] | V[]): V[] {
	const flattened: V[] = [];
	for (const value of arr) {
		if (Array.isArray(value)) {
			flattened.push(...flatten<V>(value as unknown as V[][]));
		} else {
			flattened.push(value);
		}
	}
	return flattened;
}

export function diff<T>(
	previous: T[],
	next: T[]
): {
	added: T[];
	removed: T[];
} {
	return {
		added: next.filter((x) => !previous.includes(x)),
		removed: previous.filter((x) => !next.includes(x)),
	};
}
