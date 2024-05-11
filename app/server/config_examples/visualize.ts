import { createReporter } from '../modules/visualize/report';
import { attachMessage } from '../lib/logger';
import { AllModules } from '../modules';

export function initVisualizerHooks(
	modules: AllModules,
	reporter: ReturnType<typeof createReporter>
): void {
	const logObj = attachMessage({}, 'Visualizer');
	void new modules.temperature.External(logObj, 'VISUALIZER').onUpdate(
		'mytemp',
		(temp) => {
			void reporter('temperature', 'mytemp', temp);
		}
	);
}
