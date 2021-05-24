import { RemoteControl } from './remote-control';
import { SpotifyBeats } from './spotify-beats';
import { HomeDetector } from './home-detector';
import { Temperature } from './temperature';
import { SmartHome } from './smart-home';
import { Pressure } from './pressure';
import { Movement } from './movement';
import { Explain } from './explain';
import { Webhook } from './webhook';
import { Script } from './script';
import { KeyVal } from './keyval';
import { OAuth } from './oauth';
import { Auth } from './auth';
import { Cast } from './cast';
import { Bot } from './bot';
import { RGB } from './rgb';

import { WSSimulator, WSWrapper } from '../lib/ws';
import { InfoScreen } from './info-screen';
import { Database } from '../lib/db';
import * as express from 'express';
import { Config } from '../app';
import { ModuleMeta } from './meta';

export { RemoteControl } from './remote-control';
export { SpotifyBeats } from './spotify-beats';
export { HomeDetector } from './home-detector';
export { Temperature } from './temperature';
export { SmartHome } from './smart-home';
export { Pressure } from './pressure';
export { Movement } from './movement';
export { Explain } from './explain';
export { Webhook } from './webhook';
export { Script } from './script';
export { KeyVal } from './keyval';
export { OAuth } from './oauth';
export { Auth } from './auth';
export { Cast } from './cast';
export { Bot } from './bot';
export { RGB } from './rgb';

export type AllModules = typeof moduleObj;

export type InstanceOf<T> = T extends {
	new (...args: unknown[]): infer I;
}
	? I
	: void;

export type ModuleHookables = {
	[K in keyof AllModules]: InstanceOf<
		AllModules[K]['meta']['external']['Handler']
	>;
};

export interface NoDBModuleConfig {
	app: express.Application;
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
	oauth: OAuth,
	script: Script,
	keyval: KeyVal,
	webhook: Webhook,
	explain: Explain,
	pressure: Pressure,
	movement: Movement,
	smartHome: SmartHome,
	infoScreen: InfoScreen,
	temperature: Temperature,
	spotifyBeats: SpotifyBeats,
	homeDetector: HomeDetector,
	remoteControl: RemoteControl,
};
const moduleArr = Object.values(moduleObj);

let notified = false;
export async function notifyAllModules(): Promise<void> {
	notified = true;

	for (const mod of moduleArr) {
		await (
			mod as {
				meta: ModuleMeta;
			}
		).meta.notifyModulesFromExternal(moduleObj);
	}
}

export async function getAllModules(notify = true): Promise<typeof moduleObj> {
	if (!notified && notify) {
		await notifyAllModules();
	}

	return moduleObj;
}
