export function flatMap<I, R>(arr: I[], map: (item: I) => R | R[]): R[] {
	const result: R[] = [];
	for (const item of arr) {
		const mapped = map(item);
		const flattened = Array.isArray(mapped) ? flatten(mapped) : [mapped];
		result.push(...flattened);
	}
	return result;
}
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
export function splitIntoGroups<V>(arr: V[], size: number): V[][] {
	const result: V[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		result.push(arr.slice(i, i + size));
	}
	return result;
}
export function arrToObj<V>(arr: [string, V][]): {
	[key: string]: V;
} {
	const obj: {
		[key: string]: V;
	} = {};
	for (const [key, val] of arr) {
		obj[key] = val;
	}
	return obj;
}
export function optionalArrayValue<V>(
	condition: boolean,
	value: V
): V[] | never[] {
	return condition ? [value] : [];
}
