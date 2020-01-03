export function wait(time: number) {
	return new Promise(resolve => { setTimeout(resolve, time) });
}

export function objToArr<V>(obj: {
	[key: string]: V;
}): [string, V][] {
	return Object.keys(obj).map(k => [k, obj[k]]);
}

export function arrToObj<V>(arr: [string, V][]): {
	[key: string]: V;
} {
	const obj: {
		[key: string]: V;
	} = {};
	for (const [ key, val ] of arr) {
		obj[key] = val;
	}
	return obj;
}