import { EventEmitter } from '../../../../lib/event-emitter';
import type { model } from '@peter-murray/hue-bridge-model';
import type * as hue from 'node-hue-api';

export class MotionSensor {
	private _hadPresence: boolean = false;
	public onMotion: EventEmitter<void> = new EventEmitter();

	public constructor(
		_sensor: model.Sensor,
		_api: Awaited<
			ReturnType<ReturnType<typeof hue.api.createLocal>['connect']>
		>
	) {
		setInterval(async () => {
			const sensor = await _api.sensors.getSensor(_sensor);
			const presence = sensor.getStateAttributeValue('presence');
			if (presence !== this._hadPresence) {
				if (presence) {
					this.onMotion.emit();
				}
				this._hadPresence = presence;
			}
		}, 1000 * 5);
	}
}
