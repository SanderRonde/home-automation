import { AllModules, ModuleConfig } from '../../../app/server/modules';

export function initSecretModule(config: ModuleConfig): Promise<void>;

export function notifySecretModules(modules: AllModules): Promise<void>;
