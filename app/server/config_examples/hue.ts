import type { AllModules } from '../../../app/server/modules';
import { MotionSensor } from '../modules/hue/devices';
import { LogObj } from '../lib/logging/lob-obj';
import type * as hue from 'node-hue-api';

export async function linkHueDevices(
	api: Awaited<ReturnType<ReturnType<typeof hue.api.createLocal>['connect']>>,
	modules: AllModules
): Promise<void> {
	const hueSensors = await api.sensors.getAll();
	for (const sensor of hueSensors) {
		if (sensor.id === 1) {
			// Motion sensor
			const motionSensor = new MotionSensor(sensor, api);
			motionSensor.onMotion.listen(() => {
				// TODO: trigger some keyval module
				void modules.keyval.set(
					LogObj.fromEvent('HUE.MOTION'),
					'someKey',
					'1'
				);
			});
		}
	}
}
