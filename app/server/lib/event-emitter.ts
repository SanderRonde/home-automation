import { SettablePromise } from './settable-promise';
import * as util from 'util';

export class EventEmitter<V, M = V> implements Disposable {
	protected _handlers: Set<(value: M) => void> = new Set();

	public constructor(
		public readonly initializer?: () => Promise<V | undefined>
	) {}

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

	public listen(
		handler: (value: NonNullable<M>) => void,
		initial: boolean = false
	): () => void {
		this._handlers.add(handler);

		if (initial && this._initialized && this._value) {
			handler(this._value);
		}

		return () => this.removeListener(handler);
	}

	public [util.inspect.custom](): string {
		return `${this.constructor.name} { value: ${String(this._value)} }`;
	}
}

export class CombinedAsyncEventEmitter<V> extends AsyncEventEmitter<V[]> {
	public constructor(eventEmitters: AsyncEventEmitter<V>[]) {
		const initializer = () => {
			return Promise.all(eventEmitters.map((emitter) => emitter.value));
		};
		super(initializer);

		for (let i = 0; i < eventEmitters.length; i++) {
			const eventEmitter = eventEmitters[i];
			eventEmitter.listen(async (value) => {
				if (value === undefined) {
					return;
				}
				const currentValue = [...(await this.value)];
				currentValue[i] = value;
				void this.emit(currentValue);
			});
		}
	}
}

export class MappedAsyncEventEmitter<V, M> extends AsyncEventEmitter<M> {
	public constructor(
		private readonly _eventEmitter: AsyncEventEmitter<V>,
		private readonly mapper: (value: V) => M | Promise<M>
	) {
		super(_eventEmitter.initializer as () => Promise<M | undefined>);
		this._eventEmitter.listen(async (value) => {
			if (value === undefined) {
				return;
			}
			void this.emit(await this.mapper(value));
		});
	}

	public get value(): Promise<M> {
		return this._eventEmitter.value.then(this.mapper);
	}
}
