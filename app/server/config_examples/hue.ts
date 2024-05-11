import { MotionSensor } from '@server/modules/hue/devices';
import { AllModules } from '@server/modules';
import { Api } from 'node-hue-api/dist/esm/api/Api';

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
				void new modules.keyval.External({}, 'HUE.MOTION').set(
					'someKey',
					'1'
				);
			});
		}
	}
}
