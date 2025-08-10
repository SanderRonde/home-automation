/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type {
	DeviceLevelControlCluster,
	DeviceOnOffCluster,
} from '../../device/device';
import { MappedAsyncEventEmitter } from '../../../lib/event-emitter';
import type { EWeLinkWebSocketMessage } from './clusters/shared';
import type { EWeLinkSharedConfig } from './clusters/shared';
import { asyncSetInterval } from '../../../lib/util';

class EwelinkClusterProxy<PARAMS extends object> implements Disposable {
	private _disposables: (() => void)[] = [];
	private readonly _eventEmitters = new Set<
		MappedAsyncEventEmitter<unknown, unknown>
	>();

	public constructor(private readonly _eWeLinkConfig: EWeLinkSharedConfig) {
		let wsDisabled = false;
		this._eWeLinkConfig.wsConnection.on(
			'data',
			(data: EWeLinkWebSocketMessage<PARAMS>) => {
				if (wsDisabled) {
					return;
				}

				if (
					typeof data === 'string' ||
					!('action' in data) ||
					data.action !== 'update' ||
					data.deviceid !==
						this._eWeLinkConfig.device.itemData.deviceid
				) {
					return;
				}

				for (const eventEmitter of this._eventEmitters) {
					void eventEmitter.emit(data.params);
				}
			}
		);
		this._disposables.push(() => {
			wsDisabled = true;
		});

		const timer = asyncSetInterval(async () => {
			const status = await this._eWeLinkConfig.connection.getThingStatus<{
				data: {
					params: PARAMS;
				};
			}>({
				id: this._eWeLinkConfig.device.itemData.deviceid,
				// Type 1 means deviceid
				type: 1,
			});

			if (!status) {
				return;
			}

			for (const eventEmitter of this._eventEmitters) {
				void eventEmitter.emit(status.data.params);
			}
		}, 1000 * 60);

		this._disposables.push(() => {
			clearInterval(timer);
		});
	}

	public attributeGetter<R>(
		mapper: (value: PARAMS) => R
	): MappedAsyncEventEmitter<PARAMS | null, R | null> {
		const eventEmitter = new MappedAsyncEventEmitter<
			PARAMS | null,
			R | null
		>(mapper, async () => {
			const status = await this._eWeLinkConfig.connection.getThingStatus<{
				data: {
					params: PARAMS;
				};
			}>({
				id: this._eWeLinkConfig.device.itemData.deviceid,
				// Type 1 means deviceid
				type: 1,
			});

			if (!status) {
				return undefined;
			}

			return status.data.params;
		});

		this._eventEmitters.add(eventEmitter);

		return eventEmitter;
	}

	public attributeSetter<M extends keyof PARAMS, A = void>(
		attribute: M,
		mapper: (args: A) => PARAMS[M]
	): (args: A) => Promise<void>;
	public attributeSetter<M extends keyof PARAMS>(
		attribute: M
	): (args: PARAMS[M]) => Promise<void>;
	public attributeSetter<M extends Extract<keyof PARAMS, string>, A = void>(
		attribute: M,
		mapper?: (args: A) => PARAMS[M]
	): (args: A) => Promise<void> {
		return async (args: A) => {
			const mappedInput = mapper ? mapper(args) : args;

			await this._eWeLinkConfig.connection.setThingStatus({
				id: this._eWeLinkConfig.device.itemData.deviceid,
				type: 1,
				params: {
					[attribute]: mappedInput,
				},
			});
		};
	}

	public [Symbol.dispose](): void {
		for (const disposable of this._disposables) {
			disposable();
		}
	}
}

export class EwelinkCluster<DATA extends object> implements Disposable {
	protected readonly proxy: EwelinkClusterProxy<DATA>;
	public constructor(protected readonly _eWeLinkConfig: EWeLinkSharedConfig) {
		this.proxy = new EwelinkClusterProxy<DATA>(_eWeLinkConfig);
	}

	public [Symbol.dispose](): void {
		this.proxy[Symbol.dispose]();
	}
}

abstract class MappedEwelinkCluster<
	IN extends object,
	OUT extends object,
> extends EwelinkCluster<OUT> {
	protected abstract _fromState(state: IN): OUT;

	protected abstract _toState(state: OUT): IN;
}

export interface EwelinkOnOffClusterState {
	enabled: boolean;
}

export abstract class EwelinkOnOffCluster<PARAMS extends object>
	extends MappedEwelinkCluster<PARAMS, EwelinkOnOffClusterState>
	implements DeviceOnOffCluster
{
	public isOn = this.proxy.attributeGetter((value) => value.enabled);

	public setOn = this.proxy.attributeSetter(
		'enabled',
		(enabled: boolean) => enabled
	);

	public toggle = async (): Promise<void> => {
		const current = await this.isOn.value;
		if (current === null) {
			throw new Error('Toggle failed: could not get current state');
		}
		return this.setOn(!current);
	};
}

export interface EwelinkLevelControlClusterState {
	level: number;
}

export abstract class EwelinkLevelControlCluster<PARAMS extends object>
	extends MappedEwelinkCluster<PARAMS, EwelinkLevelControlClusterState>
	implements DeviceLevelControlCluster
{
	public currentLevel = this.proxy.attributeGetter((value) => value.level);

	// Does not exist, noop
	public startupLevel = this.proxy.attributeGetter(() => 1.0);

	// Does not exist, noop
	public setStartupLevel = (): Promise<void> => Promise.resolve();

	public setLevel = this.proxy.attributeSetter(
		'level',
		(args: { level: number; transitionTimeDs?: number }) => args.level
	);

	// Noop
	public stop = (): Promise<void> => Promise.resolve();
}
