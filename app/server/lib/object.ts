export function fromEntries<V>(entries: [string, V][]): {
	[key: string]: V;
} {
	const obj: {
		[key: string]: V;
	} = {};
	for (const [key, value] of entries) {
		obj[key] = value;
	}
	return obj;
}
export function flattenObject(
	obj: Record<string, unknown>[]
): Record<string, unknown> {
	let joined: Record<string, unknown> = {};
	for (const item of obj) {
		joined = { ...joined, ...item };
	}
	return joined;
}
