import { createExternalClass } from '../../lib/external';
import { Detector } from './classes';
import { handleHooks } from './hooks';
import { HOME_STATE } from './types';

export class ExternalHandler extends createExternalClass(true) {
	private static _detector: Detector;

	public triggerHook(newState: HOME_STATE, name: string): Promise<void> {
		return this.runRequest((_res, _source, logObj) => {
			return handleHooks(newState, name, logObj);
		});
	}

	public getState(name: string): Promise<HOME_STATE | '?'> {
		return this.runRequest(() => {
			return ExternalHandler._detector.get(name);
		});
	}

	static async init({ detector }: { detector: Detector }): Promise<void> {
		this._detector = detector;
		await super.init();
	}
}
