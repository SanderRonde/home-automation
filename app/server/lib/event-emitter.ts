export class EventEmitter<V> implements Disposable {
	protected _handlers = new Map<(value: V) => void, boolean>();

	public listen(handler: (value: NonNullable<V>) => void): () => void {
		this._handlers.set(handler, true);
		return () => this.removeListener(handler);
	}

	public removeListener(handler: (value: V) => void): void {
		this._handlers.delete(handler);
	}

	public emit(value: V | null | undefined): void {
		if (value === null || value === undefined) {
			return;
		}

		for (const handler of this._handlers.keys()) {
			handler(value);
		}
	}

	public [Symbol.dispose](): void {
		this._handlers.clear();
	}
}
