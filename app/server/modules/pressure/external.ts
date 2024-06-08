import { createExternalClass } from '../../lib/external';
import type { PressureStateKeeper } from './enabled';
import type { PressureValueKeeper } from './values';

export class ExternalHandler extends createExternalClass(true) {
	private static _pressureStateKeeper: PressureStateKeeper;
	private static _pressureValueKeeper: PressureValueKeeper;

	public static async init({
		pressureStateKeeper,
		pressureValueKeeper,
	}: {
		pressureStateKeeper: PressureStateKeeper;
		pressureValueKeeper: PressureValueKeeper;
	}): Promise<void> {
		await super.init();
		this._pressureStateKeeper = pressureStateKeeper;
		this._pressureValueKeeper = pressureValueKeeper;
	}

	public async enable(): Promise<void> {
		return this.runRequest(async (_res, logObj) => {
			await ExternalHandler._pressureStateKeeper.enable();
			logObj.attachMessage('Enabled pressure module');
		});
	}

	public async disable(): Promise<void> {
		return this.runRequest(async (_res, logObj) => {
			await ExternalHandler._pressureStateKeeper.disable();
			logObj.attachMessage('Disabled pressure module');
		});
	}

	public async isEnabled(): Promise<boolean> {
		return this.runRequest((_res, logObj) => {
			const enabled = ExternalHandler._pressureStateKeeper.isEnabled();
			logObj.attachMessage('Got enabled status of pressure module');
			return enabled;
		});
	}

	public async get(key: string): Promise<number | null> {
		return this.runRequest((_res, logObj) => {
			const pressure =
				ExternalHandler._pressureValueKeeper.getPressure(key);
			logObj.attachMessage(
				`Returning pressure ${String(pressure)} for key ${key}`
			);
			return pressure;
		});
	}
}
