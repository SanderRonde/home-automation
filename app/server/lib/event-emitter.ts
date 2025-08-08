import { SettablePromise } from './util';

export class EventEmitter<V, M = V> {
	protected _handlers: Set<(value: M) => void> = new Set();

	public constructor() {}

	public listen(handler: (value: M) => void): () => void {
		this._handlers.add(handler);

		return () => this.removeListener(handler);
	}

	public removeListener(handler: (value: M) => void): void {
		this._handlers.delete(handler);
	}

	protected _emit(value: M): void {
		for (const handler of this._handlers) {
			handler(value);
		}
	}

	public emit(value: V): void {
		this._emit(value as unknown as M);
	}
}

export class AsyncEventEmitter<V, M = V> extends EventEmitter<V, M> {
	protected _initialValue: SettablePromise<M> = new SettablePromise();
	private _initialized = false;
	private _value: Promise<M> = this._initialValue.value;

	public constructor(private readonly initializer?: () => Promise<V>) {
		super();
	}

	public get value(): Promise<M> {
		if (!this._initialized) {
			this._initialized = true;
			if (this.initializer) {
				void this.initializer().then((value) => this.emit(value));
			}
		}
		return this._value;
	}

	protected _emit(value: M): void {
		this._initialValue.set(value);
		this._value = Promise.resolve(value);
		super._emit(value);
	}
}

export class MappedAsyncEventEmitter<V, M = V> extends AsyncEventEmitter<V, M> {
	public constructor(
		private readonly mapper?: (value: V) => M,
		initializer?: () => Promise<V>
	) {
		super(initializer);
	}

	public emit(value: V): void {
		const mapped = this.mapper
			? this.mapper(value)
			: (value as unknown as M);
		this._emit(mapped);
	}
}
