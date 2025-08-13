export class SettablePromise<V> {
	private _isSet = false;
	private _resolver!: (value: V) => void;
	private _promise = new Promise<V>((resolve) => {
		this._resolver = resolve;
	});

	public get isSet(): boolean {
		return this._isSet;
	}

	public get value(): Promise<V> {
		return this._promise;
	}

	public set(value: V): void {
		this._resolver(value);
		this._isSet = true;
	}
}
