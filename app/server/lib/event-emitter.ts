import { SettablePromise } from './util';
import util from 'util';

export class EventEmitter<V, M = V> implements Disposable {
	protected _handlers: Set<(value: M) => void> = new Set();

	public constructor() {}

	public listen(handler: (value: NonNullable<M>) => void): () => void {
		this._handlers.add(handler);

		return () => this.removeListener(handler);
	}

	public removeListener(handler: (value: M) => void): void {
		this._handlers.delete(handler);
	}

	protected _emit(value: M | null | undefined): void {
		if (value === null || value === undefined) {
			return;
		}

		for (const handler of this._handlers) {
			handler(value);
		}
	}

	public emit(value: V | null | undefined): void {
		this._emit(value as unknown as M);
	}

	public [util.inspect.custom](): string {
		return `${this.constructor.name} { }`;
	}

	public [Symbol.dispose](): void {
		this._handlers.clear();
	}
}

export class AsyncEventEmitter<V, M = V> extends EventEmitter<V, M> {
	protected _initialValue: SettablePromise<M> = new SettablePromise();
	private _initialized = false;
	private _value: M | null = null;

	public constructor(
		private readonly initializer?: () => Promise<V | undefined>
	) {
		super();
	}

	public get value(): Promise<M> {
		if (!this._initialized) {
			this._initialized = true;
			if (this.initializer) {
				void this.initializer().then((value) => this.emit(value));
			}
		}
		return this._value
			? Promise.resolve(this._value)
			: this._initialValue.value;
	}

	protected _emit(value: M): void {
		if (value === this._value || value === undefined) {
			return;
		}

		this._initialValue.set(value);
		this._value = value;

		super._emit(value);
	}

	public [util.inspect.custom](): string {
		return `${this.constructor.name} { value: ${String(this._value)} }`;
	}
}

export class MappedAsyncEventEmitter<V, M = V> extends AsyncEventEmitter<V, M> {
	public constructor(
		private readonly mapper?: (value: V) => M | Promise<M>,
		initializer?: () => Promise<V | undefined>
	) {
		super(initializer);
	}

	public async emit(value: V): Promise<void> {
		if (value === undefined) {
			return;
		}

		const mapped = this.mapper
			? await this.mapper(value)
			: (value as unknown as M);
		this._emit(mapped);
	}
}
