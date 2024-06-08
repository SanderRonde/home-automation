import type { AllModules, ModuleConfig, Visualize } from '../modules';
import type { createReporter } from '../modules/visualize/report';
import type { API } from '../../client/visualize/api';
import { LogObj } from '../lib/logging/lob-obj';

export function initVisualizerHooks(
	modules: AllModules,
	reporter: ReturnType<typeof createReporter>
): void {
	const logObj = LogObj.fromEvent('Visualizer');
	void new modules.temperature.External(logObj).onUpdate('mytemp', (temp) => {
		void reporter('temperature', 'mytemp', temp);
	});
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getData(_db: ModuleConfig<typeof Visualize>['sqlDB']): API {
	return {
		graphs: [
			{
				name: 'Numbers',
				labels: ['A', 'B', 'C'],
				datasets: [
					{
						label: 'Numbers',
						data: [1, 2, 3],
					},
				],
			},
		],
	};
}
