export function str(value: unknown): string {
	return JSON.stringify(value || null);
}
