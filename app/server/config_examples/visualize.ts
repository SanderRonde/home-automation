import { createReporter } from '../modules/visualize/report';
import { LogObj } from '../lib/logging/lob-obj';
import { AllModules } from '../modules';

export function initVisualizerHooks(
	modules: AllModules,
	reporter: ReturnType<typeof createReporter>
): void {
	const logObj = LogObj.fromEvent('Visualizer');
	void new modules.temperature.External(logObj).onUpdate('mytemp', (temp) => {
		void reporter('temperature', 'mytemp', temp);
	});
}
