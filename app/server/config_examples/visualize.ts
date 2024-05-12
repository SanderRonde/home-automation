import { createReporter } from '../modules/visualize/report';
import { createLogObjWithName } from '../lib/logger';
import { AllModules } from '../modules';

export function initVisualizerHooks(
	modules: AllModules,
	reporter: ReturnType<typeof createReporter>
): void {
	const logObj = createLogObjWithName('Visualizer');
	void new modules.temperature.External(logObj).onUpdate('mytemp', (temp) => {
		void reporter('temperature', 'mytemp', temp);
	});
}
