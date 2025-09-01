export class Data<T> {
	protected readonly _subscribers: Set<DataCallback<T>> = new Set();
	protected _setN: number = 0;

	public constructor(protected _value: T) {}

	protected create(): void {}
	protected destroy(): void {}

	public subscribe(callback: DataCallback<T>): () => void {
		if (!this._subscribers.size) {
			this.create();
		}
		this._subscribers.add(callback);
		callback(this._value, true);
		return () => this.unsubscribe(callback);
	}

	public unsubscribe(callback: DataCallback<T>): void {
		const exists = this._subscribers.delete(callback);
		if (exists && this._subscribers.size === 0) {
			this.destroy();
		}
	}

	public get(): Promise<Exclude<T, undefined>> {
		return new Promise((resolve) => {
			const callback = (value: T) => {
				if (value !== undefined) {
					this.unsubscribe(callback);
					resolve(value as Exclude<T, undefined>);
				}
			};
			this.subscribe(callback);
		});
	}

	public current(): T {
		return this._value;
	}

	public set(value: T): void {
		if (this._value === value) {
			return;
		}

		this._value = value;
		const n = ++this._setN;

		// Make copy, as this.subscribers might change when running callbacks
		const callbacks = this._subscribers.values();
		for (const callback of callbacks) {
			if (this._setN !== n) {
				break;
			}

			if (!this._subscribers.has(callback)) {
				continue;
			}

			callback(value, false);
		}
	}

	public update(change: (oldValue: T) => T): void {
		this.set(change(this._value));
	}
}

type DataCallback<T> = {
	bivarianceHack(value: T, isInitial?: boolean): void;
}['bivarianceHack'];
// Subset of `Data` that allows us to also map on data object that don't
// expose the full Data interface.

export class MappedData<Type, UpstreamType> extends Data<Type> {
	private readonly upstream: Data<UpstreamType>;
	private readonly mapper: Mapper<UpstreamType, Type>;

	public constructor(
		upstream: Data<UpstreamType>,
		mapper: Mapper<UpstreamType, Type>,
		alwaysTrack?: boolean
	) {
		// @ts-ignore Technically, _value is undefined which is not part of Type, but for visible consumers it is.
		super(undefined);
		this.upstream = upstream;
		this.mapper = mapper;
		if (alwaysTrack) {
			// When set, always track upstream changes and execute mapper. Otherwise, we
			// only do so when we have subscribers ourselves.
			this.subscribe(() => {});
		}
	}

	private readonly sub: DataCallback<UpstreamType> = (
		upstreamValue: UpstreamType
	) => {
		this.set(this.mapper(upstreamValue, this._value as Type | undefined));
	};

	public override create(): void {
		this.upstream.subscribe(this.sub);
	}

	public override destroy(): void {
		this.upstream.unsubscribe(this.sub);
	}

	public override current(): Type {
		if (!this._subscribers.size) {
			// Assign to this._value, so if subscribe() is called soon we can use this as
			// prevValue and do things immutably.
			const upstreamValue = this.upstream.current();
			this._value = this.mapper(upstreamValue, undefined);
		}
		return this._value;
	}
}

type Mapper<InputType = unknown, OutputType = unknown> = {
	bivarianceHack(
		input: InputType,
		prevOutput: OutputType | undefined
	): OutputType;
}['bivarianceHack'];
export class CombinedData<T, U> extends Data<[T, U]> {
	private readonly upstreams: CombinedDataUpstreams<T, U>;
	private readonly subs: [DataCallback<T>, DataCallback<U>];

	public constructor(upstreams: CombinedDataUpstreams<T, U>) {
		super([upstreams[0].current(), upstreams[1].current()]);
		this.upstreams = upstreams;

		this.subs = [
			(value) => this.setSingle(0, value),
			(value) => this.setSingle(1, value),
		];
	}

	private setSingle(key: 0, value: T): void;
	private setSingle(key: 1, value: U): void;
	private setSingle(key: number, value: T | U): void {
		const newArray: [T, U] = [...this.current()];
		newArray[key] = value;
		this.set(newArray);
	}

	protected override create(): void {
		this.upstreams[0].subscribe(this.subs[0]);
		this.upstreams[1].subscribe(this.subs[1]);
	}

	protected override destroy(): void {
		this.upstreams[0].unsubscribe(this.subs[0]);
		this.upstreams[1].unsubscribe(this.subs[1]);
	}
}

export type CombinedDataUpstreams<T, U> = [Data<T>, Data<U>];
export class PromiseData<T> extends Data<T | undefined> {
	private getData: null | (() => Promise<T>);

	public constructor(getData: () => Promise<T>) {
		super(undefined);
		this.getData = getData;
	}

	public override create(): void {
		if (this.getData) {
			void this.getData().then((value) => this.set(value));
			this.getData = null;
		}
	}
}
