import { AllModules, ModuleConfig } from '../modules';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initSecretModule(_config: ModuleConfig): Promise<void> {
	return Promise.resolve();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function notifySecretModules(_modules: AllModules): Promise<void> {
	return Promise.resolve();
}
