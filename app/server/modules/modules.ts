import {
	RemoteControl,
	HomeDetector,
	SpotifyBeats,
	Temperature,
	Pressure,
	Movement,
	Explain,
	Webhook,
	Script,
	KeyVal,
	Multi,
	Cast,
	RGB,
	Bot,
	Auth
} from '.';
import { WSSimulator, WSWrapper } from '../lib/ws';
import { InfoScreen } from './info-screen';
import { AppWrapper } from '../lib/routes';
import { Database } from '../lib/db';
import { Config } from '../app';

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
	webhook: Webhook,
	explain: Explain,
	pressure: Pressure,
	movement: Movement,
	infoScreen: InfoScreen,
	temperature: Temperature,
	spotifyBeats: SpotifyBeats,
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

export async function getAllModules(notify: boolean = true) {
	if (!notified && notify) {
		await notifyAllModules();
	}

	return moduleObj;
}
