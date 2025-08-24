export async function promiseTimeout<T>(
	timeout: number,
	promise: Promise<T>,
	onTimeout: () => void
): Promise<void> {
	const didFinish = await Promise.race([
		promise.then(() => true),
		new Promise((resolve) =>
			setTimeout(() => {
				resolve(false);
			}, timeout)
		),
	]);
	if (!didFinish) {
		onTimeout();
	}
}
