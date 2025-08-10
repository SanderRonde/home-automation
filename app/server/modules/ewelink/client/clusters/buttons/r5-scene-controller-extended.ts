import type { SceneControllerTriggerType } from './r5-scene-controller';
import { EwelinkKeyvalButtonBase } from './base-button';
import { debounce } from '../../../../../lib/util';

enum SceneControllerExtendedTriggerType {
	TOP_LEFT_PRESS,
	TOP_MIDDLE_PRESS,
	TOP_RIGHT_PRESS,
	BOTTOM_LEFT_PRESS,
	BOTTOM_MIDDLE_PRESS,
	BOTTOM_RIGHT_PRESS,
	TOP_LEFT_HOLD,
	TOP_MIDDLE_HOLD,
	TOP_RIGHT_HOLD,
	BOTTOM_LEFT_HOLD,
	BOTTOM_MIDDLE_HOLD,
	BOTTOM_RIGHT_HOLD,
	TOP_LEFT_DOUBLE_PRESS,
	TOP_MIDDLE_DOUBLE_PRESS,
	TOP_RIGHT_DOUBLE_PRESS,
	BOTTOM_LEFT_DOUBLE_PRESS,
	BOTTOM_MIDDLE_DOUBLE_PRESS,
	BOTTOM_RIGHT_DOUBLE_PRESS,
}

/**
 * Implements hold and double press for the R5 scene controller.
 */
export class EWeLinkSceneControllerExtended extends EwelinkKeyvalButtonBase<
	SceneControllerExtendedTriggerType,
	SceneControllerTriggerType
> {
	public static TriggerType = SceneControllerExtendedTriggerType;

	// This becomes big but not so big that it's worrysome
	private _buttonPresses: Partial<
		Record<SceneControllerTriggerType, number[]>
	> = {};

	private async _triggerHandler2(
		actionType: 'hold' | 'press' | 'doublePress',
		button: SceneControllerTriggerType
	): Promise<void> {
		const mappedKey = ((): SceneControllerExtendedTriggerType => {
			if (actionType === 'doublePress') {
				return button + 6;
			} else if (actionType === 'hold') {
				return button + 12;
			}
			return button as unknown as SceneControllerExtendedTriggerType;
		})();

		await this._triggerHandler(mappedKey);
	}

	protected override _onPress(
		button: SceneControllerTriggerType
	): Promise<void> {
		const now = Date.now();
		this._buttonPresses[button] ??= [];
		const currentButtonPresses = this._buttonPresses[button]!;
		currentButtonPresses.push(now);

		debounce(() => {
			if (currentButtonPresses[currentButtonPresses.length] !== now) {
				// Another press was triggered, leave that press to decide
				return;
			}

			let chainedPresses = 0;
			let lastPress = now;
			for (let i = currentButtonPresses.length - 1; i >= 0; i--) {
				if (currentButtonPresses[i] + 500 < lastPress) {
					break;
				}
				lastPress = currentButtonPresses[i];
				chainedPresses++;
			}

			if (chainedPresses === 1) {
				void this._triggerHandler(
					button as unknown as SceneControllerExtendedTriggerType
				);
			} else if (chainedPresses === 2) {
				void this._triggerHandler2('doublePress', button);
			} else if (chainedPresses >= 3) {
				void this._triggerHandler2('hold', button);
			}
		}, 500);
		return Promise.resolve();
	}
}
