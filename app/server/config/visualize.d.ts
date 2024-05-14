import { AllModules, ModuleConfig, Visualize } from '../modules';
import { createReporter } from '../modules/visualize/report';
import { API } from '../../client/visualize/api';

export default function initVisualizerHooks(
	modules: AllModules,
	reporter: ReturnType<typeof createReporter>
): Promise<void>;

export function getData(db: ModuleConfig<typeof Visualize>['sqlDB']): API;
