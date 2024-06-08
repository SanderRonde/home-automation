import type { EWeLinkSharedConfig, EWeLinkUpdateMessage } from '../shared';
import type { ExternalHandler } from '../../../keyval/external';
import { LogObj } from '../../../../lib/logging/lob-obj';
import { logTag } from '../../../../lib/logging/logger';
import { EWeLinkInitable } from '../shared';

type EWeLinkButtonPressMessage<A extends number> = EWeLinkUpdateMessage<{
	trigTime: string;
	key: A;
	outlet?: A;
}>;

export class EwelinkButtonBase<A extends number> extends EWeLinkInitable {
	public constructor(
		protected _eWeLinkConfig: EWeLinkSharedConfig,
		private readonly _actions:
			| Record<A, (action: A) => Promise<unknown>>
			| { default: (action: A) => Promise<unknown> }
	) {
		super();
	}

	protected async _onTrigger(key: A): Promise<void> {
		const action =
			'default' in this._actions
				? this._actions.default
				: this._actions[key];
		if (action) {
			await action(key);
		}
	}

	public init(): Promise<void> {
		this._eWeLinkConfig.wsConnection.on('data', async (message) => {
			if (typeof message === 'string') {
				return;
			}
			if (
				'action' in message &&
				message.action === 'update' &&
				message.deviceid ===
					this._eWeLinkConfig.device.itemData.deviceid
			) {
				const ewelinkMessage = message as EWeLinkButtonPressMessage<A>;
				const key =
					ewelinkMessage.params.outlet ?? ewelinkMessage.params.key;
				logTag('ewelink', 'cyan', `Button triggered: ${key}`);
				await this._onTrigger(key);
			}
		});
		return Promise.resolve();
	}
}

export class EwelinkKeyvalButtonBase<
	C extends number,
	A extends number = C,
> extends EwelinkButtonBase<A> {
	private _keyvalExternal!: ExternalHandler;

	public constructor(
		eWeLinkConfig: EWeLinkSharedConfig,
		protected readonly _keyVal: {
			[K in C]?: string[];
		}
	) {
		super(eWeLinkConfig, {
			default: (action) => this._onPress(action),
		});
	}

	protected async _triggerHandler(button: C): Promise<void> {
		const usedKeyval = this._keyVal[button];
		if (!usedKeyval) {
			return;
		}
		await Promise.all(
			usedKeyval.map((val) => this._keyvalExternal.toggle(val))
		);
	}

	protected async _onPress(button: A): Promise<void> {
		await this._triggerHandler(button as unknown as C);
	}

	public async init(): Promise<void> {
		await super.init();
		this._keyvalExternal = new this._eWeLinkConfig.modules.keyval.External(
			LogObj.fromEvent('EWELINK.POWER.INIT')
		);
	}
}
