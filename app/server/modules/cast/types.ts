export class DummyCastLog {
	public constructor(public componentName: string = 'castv2') {}

	private _addPrefix(firstArg?: unknown, ...args: unknown[]): unknown[] {
		if (firstArg) {
			return [`${this.componentName} - ${String(firstArg)}`, ...args];
		}
		return [];
	}

	public error(): void {
		// eslint-disable-next-line prefer-rest-params
		const prefixed = this._addPrefix(...arguments);
		// eslint-disable-next-line prefer-spread
		console.error.apply(console, prefixed);
	}
	public warn(): void {}
	public info(): void {}
	public debug(): void {}
}
