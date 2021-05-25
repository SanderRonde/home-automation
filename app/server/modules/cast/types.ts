export class DummyCastLog {
	constructor(public componentName: string = 'castv2') {}

	_addPrefix(firstArg?: unknown, ...args: unknown[]): unknown[] {
		if (firstArg) {
			return [`${this.componentName} - ${String(firstArg)}`, ...args];
		}
		return [];
	}

	error(): void {
		// eslint-disable-next-line prefer-rest-params
		const prefixed = this._addPrefix(...arguments);
		// eslint-disable-next-line prefer-spread
		console.error.apply(console, prefixed);
	}
	warn(): void {}
	info(): void {}
	debug(): void {}
}
