import type { AllModules, ModuleConfig } from '../modules';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initSecretModule(
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_config: ModuleConfig
): Promise<void> {
	return Promise.resolve();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function notifySecretModules(_modules: AllModules): Promise<void> {
	return Promise.resolve();
}
