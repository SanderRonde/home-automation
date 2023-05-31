import {
	EWeLinkInitable,
	EWeLinkSharedConfig,
	EWeLinkUpdateMessage,
} from '../shared';
import { ExternalHandler } from '../../../keyval/external';
import { logTag } from '../../../../lib/logger';

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

	protected async _onTrigger(
		message: EWeLinkButtonPressMessage<A>
	): Promise<void> {
		const key = message.params.outlet ?? message.params.key;
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
				message.deviceid === this._eWeLinkConfig.device.deviceid
			) {
				logTag('ewelink', 'cyan', 'Button triggered');
				await this._onTrigger(message as EWeLinkButtonPressMessage<A>);
			}
		});
		return Promise.resolve();
	}
}

export class EwelinkKeyvalButtonBase<
	A extends number
> extends EwelinkButtonBase<A> {
	private _keyvalExternal!: ExternalHandler;

	public constructor(
		eWeLinkConfig: EWeLinkSharedConfig,
		private readonly _keyVal: {
			[K in A]?: string[];
		}
	) {
		super(eWeLinkConfig, {
			default: (action) => this._onPress(action),
		});
	}

	private async _onPress(button: A): Promise<void> {
		const usedKeyval = this._keyVal[button];
		if (!usedKeyval) {
			return;
		}
		await Promise.all(
			usedKeyval.map((val) => this._keyvalExternal.toggle(val))
		);
	}

	public async init(): Promise<void> {
		await super.init();
		this._keyvalExternal = new this._eWeLinkConfig.modules.keyval.External(
			{},
			'EWELINK.POWER.INIT'
		);
	}
}
