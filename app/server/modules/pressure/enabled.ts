import { LogObj } from '../../lib/logging/lob-obj';
import { Database } from '../../lib/db';
import { Pressure } from '.';

export class PressureStateKeeper {
	public enabled: boolean;

	public constructor(private readonly _db: Database) {
		this.enabled = _db.get('enabled', true);
	}

	public async enable(updateKeyval: boolean = true): Promise<void> {
		this.enabled = true;
		this._db.setVal('enabled', this.enabled);
		if (updateKeyval) {
			await new (await Pressure.modules).keyval.External(
				LogObj.fromEvent('PRESSURE.ON')
			).set('state.pressure', '1', false);
		}
	}

	public async disable(updateKeyval: boolean = true): Promise<void> {
		this.enabled = false;
		this._db.setVal('enabled', this.enabled);
		if (updateKeyval) {
			await new (await Pressure.modules).keyval.External(
				LogObj.fromEvent('PRESSURE.OFF')
			).set('state.pressure', '0', false);
		}
	}

	public isEnabled(): boolean {
		return this.enabled;
	}
}
