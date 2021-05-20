import { ResDummy } from './logger';

type QueuedRequestFn<T> = (
	res: ResDummy,
	source: string,
	logObj: any
) => Promise<T> | T;

type QueuedRequest<T = any> = {
	fn: QueuedRequestFn<T>;
	instance: ExternalClass;
};

export abstract class ExternalClass {
	protected abstract requiresInit: boolean;
	private static _initialized: boolean = false;
	private static _isReady(instance: ExternalClass) {
		return !instance.requiresInit || this._initialized;
	}

	constructor(private _logObj: any, private _source: string) {}

	private static _queuedRequests: QueuedRequest[] = [];

	private static async _handleQueuedRequest<T>({
		fn,
		instance
	}: QueuedRequest<T>): Promise<T> {
		const { _logObj: logObj, _source: source } = instance;
		const resDummy = new ResDummy();
		const value = await fn(resDummy, source, logObj);
		resDummy.transferTo(logObj);
		return value;
	}

	static async init(_args?: any) {
		this._initialized = true;
		for (const req of this._queuedRequests) {
			this._handleQueuedRequest(req);
		}
	}

	/**
	 * Runs a request. Either now (when the class is ready)
	 * or later when it has been intiialized
	 */
	runRequest<T>(fn: QueuedRequestFn<T>): Promise<T> {
		return new Promise<T>(resolve => {
			if (ExternalClass._isReady(this)) {
				ExternalClass._handleQueuedRequest({
					fn,
					instance: this
				}).then(resolve);
			} else {
				ExternalClass._queuedRequests.push({
					fn: (res, source, logObj) => {
						const result = fn(res, source, logObj);
						resolve(result);
						return result;
					},
					instance: this
				});
			}
		});
	}
}
