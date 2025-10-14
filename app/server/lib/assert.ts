export function assertUnreachable(value: never): never {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	throw new Error(`Unreachable code reached with value: ${value as any}`);
}
