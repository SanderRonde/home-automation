import { EwelinkKeyvalButtonBase } from './base-button';

export enum ButtonTriggerType {
	PRESS = 0,
	DOUBLE_PRESS = 1,
	HOLD = 2,
}

export type ButtonTriggerActions = {
	[K in ButtonTriggerType]?: () => Promise<unknown>;
};

export class EWeLinkPowerButton extends EwelinkKeyvalButtonBase<ButtonTriggerType> {
	public static TriggerType = ButtonTriggerType;
}
