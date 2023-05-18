export class EventEmitter<V> {
	public lastValue: V | null = null;
	public handlers: ((value: V) => void)[] = [];

	public listen(handler: (value: V) => void): void {
		this.handlers.push(handler);
	}

	public emit(value: V): void {
		this.lastValue = value;
		for (const handler of this.handlers) {
			handler(value);
		}
	}
}
