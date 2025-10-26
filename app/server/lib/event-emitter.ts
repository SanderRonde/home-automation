export class EventEmitter<V> implements Disposable {
	protected _handlers = new Set<(value: V) => void>();

	public listen(handler: (value: NonNullable<V>) => void): () => void {
		this._handlers.add(handler);
		return () => this.removeListener(handler);
	}

	public removeListener(handler: (value: V) => void): void {
		this._handlers.delete(handler);
	}

	public emit(value: V): void {
		for (const handler of this._handlers.values()) {
			handler(value);
		}
	}

	public [Symbol.dispose](): void {
		this._handlers.clear();
	}
}
