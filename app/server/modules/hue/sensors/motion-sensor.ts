import { EventEmitter } from '../../../lib/event-emitter';
import { model } from '@peter-murray/hue-bridge-model';
import { Api } from 'node-hue-api/dist/esm/api/Api';

export class MotionSensor {
	private _hadPresence: boolean = false;
	public onMotion: EventEmitter<void> = new EventEmitter();

	public constructor(_sensor: model.Sensor, _api: Api) {
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
