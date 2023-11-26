import { EwelinkKeyvalButtonBase } from './base-button';

export enum SceneControllerTriggerType {
	TOP_LEFT = 5,
	TOP_MIDDLE = 4,
	TOP_RIGHT = 3,
	BOTTOM_LEFT = 0,
	BOTTOM_MIDDLE = 1,
	BOTTOM_RIGHT = 2,
}

export class EWeLinkSceneController extends EwelinkKeyvalButtonBase<SceneControllerTriggerType> {
	public static TriggerType = SceneControllerTriggerType;
}
