import { AllModules } from '../../../@server/modules';
import { Api } from 'node-hue-api/dist/esm/api/Api';

export function linkHueDevices(api: Api, modules: AllModules): Promise<void>;
