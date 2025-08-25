import { SettablePromise } from './settable-promise';
import { promiseTimeout } from './promise';
import { logTag } from './logging/logger';
import * as util from 'util';

const noValue = Symbol('noValue');

function promiseHandlers<T>() {
	const errorPromise = new SettablePromise<Error>();

	return {
		checkTimeout: (promise: Promise<unknown>) => {
			const originalTrace = new Error().stack;
			void promiseTimeout(1000 * 10, promise, () => {
				logTag(
					'event-emitter',
					'red',
					'Initialization/getter did not resolve within 10 seconds',
					originalTrace
				);
			});
		},
		catchError: (error: Error) => {
			logTag(
				'event-emitter',
				'red',
				'Initialization/getter failed',
				error
			);
			errorPromise.set(error);
			return undefined;
		},
		resolver: (promise: Promise<T>): Promise<T> => {
			return Promise.race([
				promise,
				errorPromise.value.then<T>((error) => {
					return Promise.reject(error);
				}),
			]);
		},
	};
}

export class EventEmitter<V, M = V> implements Disposable {
	protected _handlers = new Map<(value: M) => void, boolean>();

	public listen(handler: (value: NonNullable<M>) => void): () => void {
		this._handlers.set(handler, true);
		return () => this.removeListener(handler);
	}

	public removeListener(handler: (value: M) => void): void {
		this._handlers.delete(handler);
	}

	protected _emit(value: M | null | undefined): void {
		if (value === null || value === undefined) {
			return;
		}

		for (const handler of this._handlers.keys()) {
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
	protected _value: M | typeof noValue = noValue;

	public get value(): Promise<M> {
		return new Promise<M>((resolve) => {
			this.listen(resolve, { initial: true, once: true });
		});
	}

	protected _emit(value: M): void {
		if (value === null || value === undefined) {
			return;
		}

		const wasSame = value === this._value;
		this._value = value;

		for (const [handler, dedup] of this._handlers.entries()) {
			if (!dedup || !wasSame) {
				handler(value);
			}
		}
	}

	protected _listen(
		handler: (value: NonNullable<M>) => void,
		dedup: boolean,
		options?: { initial?: boolean; once?: boolean }
	): () => void {
		if (
			options?.initial &&
			this._value !== noValue &&
			this._value !== undefined &&
			this._value !== null
		) {
			handler(this._value);
			if (options?.once) {
				return () => {};
			}
		}

		const listener = (value: NonNullable<M>) => {
			handler(value);
			if (options?.once) {
				this.removeListener(listener);
			}
		};
		this._handlers.set(listener, dedup);
		return () => this.removeListener(listener);
	}

	public listen(
		handler: (value: NonNullable<M>) => void,
		options?: { initial?: boolean; once?: boolean }
	): () => void {
		return this._listen(handler, true, options);
	}

	public [util.inspect.custom](): string {
		return `${this.constructor.name} { value: ${String(this._value)} }`;
	}
}

export class LazyAsyncEventEmitter<V, M = V> extends AsyncEventEmitter<V, M> {
	private _initialized = false;

	public constructor(
		private readonly getInitialValue: () => Promise<V | undefined>
	) {
		super();
	}

	public get value(): Promise<M> {
		const { catchError, resolver, checkTimeout } = promiseHandlers<M>();

		if (!this._initialized) {
			this._initialized = true;
			const initialValue = this.getInitialValue().catch(catchError);
			checkTimeout(initialValue);
			void initialValue.then((value) => {
				this.emit(value);
			});
		}

		return resolver(
			new Promise<M>((resolve) => {
				this._listen(resolve, false, { initial: true, once: true });
			})
		);
	}
}

export class GetterAsyncEventEmitter<V, M = V> extends AsyncEventEmitter<V, M> {
	public constructor(
		private readonly getValue: () => Promise<V | undefined>
	) {
		super();
	}

	public get value(): Promise<M> {
		const { catchError, resolver, checkTimeout } = promiseHandlers<M>();

		const listenerPromise = new Promise<M>((resolve) => {
			this._listen(
				(listenedValue) => {
					resolve(listenedValue);
				},
				false,
				{ once: true }
			);
		});

		const valueGetterPromise = this.getValue().catch(catchError);
		checkTimeout(valueGetterPromise);
		void valueGetterPromise.then((value) => {
			this.emit(value);
		});

		return resolver(listenerPromise);
	}
}

export class CombinedAsyncEventEmitter<V> extends AsyncEventEmitter<V[]> {
	public constructor(
		private readonly _eventEmitters: AsyncEventEmitter<V>[]
	) {
		super();

		for (let i = 0; i < _eventEmitters.length; i++) {
			const eventEmitter = _eventEmitters[i];
			eventEmitter.listen(async (value) => {
				const currentValue = [...(await this.value)];
				currentValue[i] = value;
				void this.emit(currentValue);
			});
		}
	}

	public get value(): Promise<V[]> {
		const initialValue = this._eventEmitters.map(
			(emitter) => emitter.value
		);
		return Promise.all(initialValue);
	}
}

export class MappedAsyncEventEmitter<V, M> extends AsyncEventEmitter<M> {
	private _lastError: SettablePromise<Error> = new SettablePromise();

	public constructor(
		private readonly _eventEmitter: AsyncEventEmitter<V>,
		private readonly mapper: (value: V) => M | Promise<M>
	) {
		super();
		this._eventEmitter.listen(
			async (value) => {
				if (value === undefined || value === null) {
					return;
				}
				const asyncMapper = async (value: V) => this.mapper(value);
				const mapped = asyncMapper(value).catch((error) => {
					this._lastError.set(error);
					logTag('event-emitter', 'red', 'Mapper failed', error);
					return null;
				});
				void super.emit(await mapped);
			},
			{
				initial: true,
			}
		);
	}

	// @ts-expect-error
	public emit(value: V | null | undefined): void {
		this._eventEmitter.emit(value);
	}

	public get value(): Promise<M> {
		const promise = new Promise<M>((resolve) => {
			this._listen(resolve, false, { once: true });
		});
		void this._eventEmitter.value.then((value) => this.emit(value));
		return Promise.race([
			promise,
			this._lastError.value.then((error) => Promise.reject(error)),
		]);
	}
}
