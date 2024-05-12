import { MotionSensor } from '../../../app/server/modules/hue/devices';
import { AllModules } from '../../../app/server/modules';
import { Api } from 'node-hue-api/dist/esm/api/Api';
import { LogObj } from '../lib/logging/lob-obj';

export async function linkHueDevices(
	api: Api,
	modules: AllModules
): Promise<void> {
	const hueSensors = await api.sensors.getAll();
	for (const sensor of hueSensors) {
		if (sensor.id === 1) {
			// Motion sensor
			const motionSensor = new MotionSensor(sensor, api);
			motionSensor.onMotion.listen(() => {
				// TODO: trigger some keyval module
				void new modules.keyval.External(
					LogObj.fromEvent('HUE.MOTION')
				).set('someKey', '1');
			});
		}
	}
}
