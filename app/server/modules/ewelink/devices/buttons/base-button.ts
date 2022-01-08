import {
	EWeLinkInittable,
	EWeLinkSharedConfig,
	EWeLinkUpdateMessage,
} from '../shared';

export enum ButtonTriggerType {
	PRESS = 0,
	DOUBLE_PRESS = 1,
	HOLD = 2,
}

export type ButtonTriggerActions = {
	[K in ButtonTriggerType]?: () => Promise<unknown>;
};

type EWeLinkButtonPressMessage = EWeLinkUpdateMessage<{
	trigTime: string;
	key: ButtonTriggerType;
}>;

export class EwelinkButtonBase extends EWeLinkInittable {
	public constructor(
		protected _eWeLinkConfig: EWeLinkSharedConfig,
		private _actions: ButtonTriggerActions
	) {
		super();
	}

	private async _onTrigger(
		message: EWeLinkButtonPressMessage
	): Promise<void> {
		const action = this._actions[message.params.key];
		if (action) {
			await action();
		}
	}

	protected setActions(actions: ButtonTriggerActions): void {
		this._actions = actions;
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
				await this._onTrigger(message as EWeLinkButtonPressMessage);
			}
		});
		return Promise.resolve();
	}
}
