export function html(l: TemplateStringsArray, ...p: any[]): string {
	let str: string = l[0];
	for (let i = 0; i < l.length - 1; i++) {
		str = `${str}${p[i]}${l[i + 1]}`;
	}
	return str;
}
