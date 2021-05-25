export function str(value: unknown | undefined): string {
	return JSON.stringify(value || null);
}
