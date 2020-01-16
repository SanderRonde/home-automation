import { RemoteControl } from '../modules/remote-control';
import { HomeDetector } from '../modules/home-detector';
import { Temperature } from '../modules/temperature';
import { WSSimulator, WSWrapper } from '../lib/ws';
import { AppWrapper } from '../lib/routes';
import { Script } from '../modules/script';
import { KeyVal } from '../modules/keyval';
import { Multi } from '../modules/multi';
import { Cast } from '../modules/cast';
import { Database } from '../lib/db';
import { RGB } from '../modules/rgb';
import { Bot } from '../modules/bot';
import { Config } from '../app';
import { Auth } from './auth';

export type AllModules = typeof moduleObj;

export type InstanceOf<T> = T extends {
	new (...args: any[]): infer I;
}
	? I
	: void;

export type ModuleHookables = {
	[K in keyof AllModules]: InstanceOf<
		AllModules[K]['meta']['external']['Handler']
	>;
};

export interface NoDBModuleConfig {
	app: AppWrapper;
	websocketSim: WSSimulator;
	websocket: WSWrapper;
	config: Config;
	randomNum: number;
}

export interface ModuleConfig extends NoDBModuleConfig {
	db: Database;
}

const moduleObj = {
	bot: Bot,
	RGB: RGB,
	cast: Cast,
	auth: Auth,
	multi: Multi,
	script: Script,
	keyval: KeyVal,
	temperature: Temperature,
	homeDetector: HomeDetector,
	remoteControl: RemoteControl
};
const moduleArr = Object.values(moduleObj);

let notified: boolean = false;
export async function notifyAllModules() {
	notified = true;

	for (const mod of moduleArr) {
		await mod.meta.notifyModules(moduleObj);
	}
}

export async function getAllModules() {
	if (!notified) {
		await notifyAllModules();
	}

	return moduleObj;
}
