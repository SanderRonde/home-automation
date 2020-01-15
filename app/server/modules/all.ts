import { RemoteControl } from '../modules/remote-control';
import { HomeDetector } from '../modules/home-detector';
import { Temperature } from '../modules/temperature';
import { KeyVal } from '../modules/keyval';
import { Script } from '../modules/script';
import { Multi } from '../modules/multi';
import { Cast } from '../modules/cast';
import { RGB } from '../modules/rgb';
import { Bot } from '../modules/bot';

export type AllModules = typeof moduleObj;

export interface NotifyFn {
	(modules: AllModules): void;
}

type InstanceOf<T> = T extends {
	new (...args: any[]): infer I;
}
	? I
	: void;

export type ModuleHookables = {
	[K in keyof AllModules]: InstanceOf<AllModules[K]['External']['Handler']>;
};

const moduleObj = {
	bot: Bot,
	RGB: RGB,
	cast: Cast,
	multi: Multi,
	script: Script,
	keyval: KeyVal,
	temperature: Temperature,
	homeDetector: HomeDetector,
	remoteControl: RemoteControl
};
const moduleArr = Object.values(moduleObj);

let notified: boolean = false;
export function notifyAll() {
	notified = true;

	for (const mod of moduleArr) {
		if ('notifyModules' in mod) {
			((mod as any).notifyModules as NotifyFn)(moduleObj);
		}
	}
}

export function getAll() {
	if (!notified) {
		notifyAll();
	}

	return moduleObj;
}
