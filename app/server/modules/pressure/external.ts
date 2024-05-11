import { createExternalClass } from '@server/lib/external';
import { attachMessage } from '@server/lib/logger';
import { PressureStateKeeper } from '@server/modules/pressure/enabled';
import { PressureValueKeeper } from '@server/modules/pressure/values';

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
		return this.runRequest(async (_res, _source, logObj) => {
			await ExternalHandler._pressureStateKeeper.enable();
			attachMessage(logObj, 'Enabled pressure module');
		});
	}

	public async disable(): Promise<void> {
		return this.runRequest(async (_res, _source, logObj) => {
			await ExternalHandler._pressureStateKeeper.disable();
			attachMessage(logObj, 'Disabled pressure module');
		});
	}

	public async isEnabled(): Promise<boolean> {
		return this.runRequest((_res, _source, logObj) => {
			const enabled = ExternalHandler._pressureStateKeeper.isEnabled();
			attachMessage(logObj, 'Got enabled status of pressure module');
			return enabled;
		});
	}

	public async get(key: string): Promise<number | null> {
		return this.runRequest((_res, _source, logObj) => {
			const pressure =
				ExternalHandler._pressureValueKeeper.getPressure(key);
			attachMessage(
				logObj,
				`Returning pressure ${String(pressure)} for key ${key}`
			);
			return pressure;
		});
	}
}
