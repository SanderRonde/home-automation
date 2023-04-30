const exitHandlers: (() => Promise<void> | void)[] = [];

process.on('exit', async () => {
	await Promise.all(exitHandlers.map((handler) => handler()));
});

export function registerExitHandler(handler: () => Promise<void> | void): void {
	exitHandlers.push(handler);
}
