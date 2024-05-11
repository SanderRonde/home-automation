import { createReporter } from '../modules/visualize/report';
import { AllModules } from '../modules';

export default function initVisualizerHooks(
	modules: AllModules,
	reporter: ReturnType<typeof createReporter>
): Promise<void>;
