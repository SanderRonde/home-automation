import { RemoteControl } from './remote-control';
import { SpotifyBeats } from './spotify-beats';
import { HomeDetector } from './home-detector';
import { Temperature } from './temperature';
import { Pressure } from './pressure';
import { Movement } from './movement';
import { Explain } from './explain';
import { Actions } from './actions';
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

export { RemoteControl } from './remote-control';
export { SpotifyBeats } from './spotify-beats';
export { HomeDetector } from './home-detector';
export { Temperature } from './temperature';
export { Pressure } from './pressure';
export { Movement } from './movement';
export { Explain } from './explain';
export { Actions } from './actions';
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
	actions: Actions,
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
		await mod.meta.notifyModulesFromExternal(moduleObj);
	}
}

export async function getAllModules(notify: boolean = true) {
	if (!notified && notify) {
		await notifyAllModules();
	}

	return moduleObj;
}
