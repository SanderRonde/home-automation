import { ModuleMeta } from '@server/modules/meta';
import { LogObj, ResDummy } from '@server/lib/logger';

type QueuedRequestFn<T> = (
	res: ResDummy,
	source: string,
	logObj: LogObj
) => Promise<T> | T;

type QueuedRequest<T = unknown> = {
	fn: QueuedRequestFn<T>;
	instance: InstanceType<ReturnType<typeof createExternalClass>>;
};

const initializedClasses: WeakSet<ReturnType<typeof createExternalClass>> =
	new WeakSet();
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createExternalClass(requiresInit: boolean, name?: string) {
	return class ExternalClass {
		private static _queuedRequests: QueuedRequest[] = [];
		protected static _initialized = false;
		protected static _name = name;

		public constructor(
			private readonly _logObj: LogObj,
			private readonly _source: string
		) {}

		private static _isReady(requiresInit: boolean) {
			if (requiresInit === undefined) {
				throw new Error('"requiresInit" not set');
			}
			return !requiresInit || this._initialized;
		}

		private static async _handleQueuedRequest<T>({
			fn,
			instance,
		}: QueuedRequest<T>): Promise<T> {
			const { _logObj: logObj, _source: source } = instance;
			const resDummy = new ResDummy();
			const value = await fn(resDummy, source, logObj);
			resDummy.transferTo(logObj);
			return value;
		}

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		public static async init(_args?: unknown) {
			initializedClasses.add(this);
			this._initialized = true;
			for (const req of this._queuedRequests) {
				await this._handleQueuedRequest(req);
			}
		}

		public async _getKey(
			logObj: LogObj,
			module: ModuleMeta
		): Promise<string> {
			return await new (await module.modules).auth.External(
				logObj,
				`${module.name}.EXTERNAL`
			).getSecretKey();
		}

		/**
		 * Runs a request. Either now (when the class is ready)
		 * or later when it has been intiialized
		 */
		public runRequest<T>(fn: QueuedRequestFn<T>): Promise<T> {
			return new Promise<T>((resolve) => {
				const constructor = this.constructor as typeof ExternalClass;
				if (constructor._isReady(requiresInit)) {
					void constructor
						._handleQueuedRequest({
							fn,
							instance: this,
						})
						.then(resolve);
				} else {
					constructor._queuedRequests.push({
						fn: (res, source, logObj) => {
							const result = fn(res, source, logObj);
							resolve(result);
							return result;
						},
						instance: this,
					});
				}
			});
		}
	};
}
