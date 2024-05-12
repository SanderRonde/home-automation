import { createExternalClass } from '../../lib/external';
import { handleHooks } from './hooks';
import { Detector } from './classes';
import { HOME_STATE } from './types';

export class ExternalHandler extends createExternalClass(true) {
	private static _detector: Detector;

	public static async init({
		detector,
	}: {
		detector: Detector;
	}): Promise<void> {
		this._detector = detector;
		await super.init();
	}

	public triggerHook(newState: HOME_STATE, name: string): Promise<void> {
		return this.runRequest((_res, logObj) => {
			return handleHooks(newState, name, logObj);
		});
	}

	public getState(name: string): Promise<HOME_STATE | '?'> {
		return this.runRequest(() => {
			return ExternalHandler._detector.get(name);
		});
	}

	public onUpdate(
		handler: (newState: HOME_STATE, name: string) => void | Promise<void>
	): Promise<void> {
		return this.runRequest(() => {
			Detector.addListener(null, handler);
		});
	}
}
