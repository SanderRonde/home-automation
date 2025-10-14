const activeWithables = new Map<string, number>();

export async function withFn<R>(
	fn: () => Promise<R>,
	after: () => Promise<void> | void
): Promise<R> {
	const err = new Error();
	if (!err.stack) {
		throw new Error('No stack trace');
	}
	const callSite = err.stack.split('\n')[1];
	const identifier = Math.random();

	activeWithables.set(callSite, identifier);
	const result = await fn();
	if (activeWithables.get(callSite) === identifier) {
		await after();
		activeWithables.delete(callSite);
	}
	return result;
}
