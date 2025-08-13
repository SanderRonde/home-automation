export function pad(str: string, length: number, padChar: string): string {
	while (str.length < length) {
		str = `${padChar}${str}`;
	}
	return str;
}
