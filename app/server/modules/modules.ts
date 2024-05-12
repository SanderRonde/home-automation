import { RemoteControl } from './remote-control';
import { SpotifyBeats } from './spotify-beats';
import { HomeDetector } from './home-detector';
import { Temperature } from './temperature';
import { SmartHome } from './smart-home/';
import { Visualize } from './/visualize/';
import { SwitchBot } from './switchbot/';
import { Pressure } from './pressure';
import { Movement } from './movement';
import { Webhook } from './webhook';
import { EWeLink } from './ewelink';
import { Script } from './script/';
import { Secret } from './secret/';
import { Notion } from './notion/';
import { KeyVal } from './keyval';
import { OAuth } from './oauth/';
import { Tuya } from './tuya';
import { Auth } from './auth';
import { Cast } from './cast';
import { Hue } from './hue/';
import { Bot } from './bot';
import { RGB } from './rgb';

import { AsyncExpressApplication } from '../types/express';
import { SQLDatabaseWithSchema } from '../lib/sql-db';
import { WSSimulator, WSWrapper } from '../lib/ws';
import { InfoScreen } from './info-screen';
import { Database } from '../lib/db';
import { ModuleMeta } from './meta';
import { Config } from '../app';

export { RemoteControl } from './remote-control';
export { SpotifyBeats } from './spotify-beats';
export { HomeDetector } from './home-detector';
export { Temperature } from './temperature';
export { SmartHome } from './smart-home/';
export { Visualize } from './visualize/';
export { SwitchBot } from './switchbot/';
export { Pressure } from './pressure';
export { Movement } from './movement';
export { Webhook } from './webhook';
export { EWeLink } from './ewelink';
export { Notion } from './notion/';
export { Script } from './script/';
export { KeyVal } from './keyval';
export { Secret } from './secret/';
export { OAuth } from './oauth/';
export { Tuya } from './tuya';
export { Auth } from './auth';
export { Cast } from './cast';
export { Bot } from './bot';
export { RGB } from './rgb';
export { Hue } from './hue/';

export type AllModules = typeof moduleObj;

export type InstanceOf<T> = T extends {
	new (...args: unknown[]): infer I;
}
	? I
	: void;

export type ModuleHookables = {
	[K in keyof AllModules]: InstanceType<AllModules[K]['External']>;
};

export interface BaseModuleConfig {
	app: AsyncExpressApplication;
	websocketSim: WSSimulator;
	websocket: WSWrapper;
	config: Config;
	randomNum: number;
}

export interface ModuleConfig<M extends ModuleMeta> extends BaseModuleConfig {
	db: Database;
	sqlDB: SQLDatabaseWithSchema<M['schema']>;
	modules: AllModules;
}

const moduleObj = {
	bot: Bot,
	RGB: RGB,
	hue: Hue,
	cast: Cast,
	auth: Auth,
	tuya: Tuya,
	oauth: OAuth,
	script: Script,
	keyval: KeyVal,
	secret: Secret,
	notion: Notion,
	webhook: Webhook,
	ewelink: EWeLink,
	pressure: Pressure,
	movement: Movement,
	smartHome: SmartHome,
	visualize: Visualize,
	switchbot: SwitchBot,
	infoScreen: InfoScreen,
	temperature: Temperature,
	spotifyBeats: SpotifyBeats,
	homeDetector: HomeDetector,
	remoteControl: RemoteControl,
};
const moduleArr = Object.values(moduleObj);

let notified = false;
export function notifyAllModules(): void {
	notified = true;

	for (const mod of moduleArr) {
		mod.notifyModulesFromExternal(moduleObj);
	}
}

export function getAllModules(notify = true): typeof moduleObj {
	if (!notified && notify) {
		notifyAllModules();
	}

	return moduleObj;
}
