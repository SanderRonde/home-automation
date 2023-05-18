export function arraySame<V>(values: V[]): boolean {
	if (!values.length) {
		return true;
	}
	const firstValue = values[0];
	return values.every((value) => value === firstValue);
}
