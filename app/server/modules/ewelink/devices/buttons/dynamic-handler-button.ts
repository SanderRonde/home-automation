import { ButtonTriggerType } from '@server/modules/ewelink/devices/buttons/power-button';
import { EwelinkButtonBase } from '@server/modules/ewelink/devices/buttons/base-button';
import { EWeLinkSharedConfig } from '@server/modules/ewelink/devices/shared';
import { AllModules } from '@server/modules';

export class EwelinkDynamicHandlerButton<
	C extends number,
	A extends number = C,
> extends EwelinkButtonBase<A> {
	public static TriggerType = ButtonTriggerType;

	public constructor(
		eWeLinkConfig: EWeLinkSharedConfig,
		protected readonly _handlers: {
			[K in C]?: (modules: AllModules) => Promise<void>;
		}
	) {
		super(eWeLinkConfig, {
			default: (action) => this._onPress(action),
		});
	}

	protected async _triggerHandler(button: C): Promise<void> {
		const usedHandler = this._handlers[button];
		if (!usedHandler) {
			return;
		}
		return usedHandler(this._eWeLinkConfig.modules);
	}

	protected async _onPress(button: A): Promise<void> {
		await this._triggerHandler(button as unknown as C);
	}
}
