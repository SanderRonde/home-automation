import { RemoteControl } from './remote-control';
import { HomeAssistant } from './home-assistant';
import { SpotifyBeats } from './spotify-beats';
import { HomeDetector } from './home-detector';
import { Temperature } from './temperature';
import { SmartHome } from './smart-home';
import { Visualize } from './visualize/';
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

import type { AsyncExpressApplication } from '../types/express';
import type { SQLDatabaseWithSchema } from '../lib/sql-db';
import type { WSSimulator, WSWrapper } from '../lib/ws';
import { InfoScreen } from './info-screen';
import type { Database } from '../lib/db';
import type { ModuleMeta } from './meta';
import type { Config } from '../app';

export { RemoteControl } from './remote-control';
export { HomeAssistant } from './home-assistant';
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

export type AllModules = ReturnType<typeof getModuleObj>;

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

const getModuleObj = () => ({
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
	homeAssistant: HomeAssistant,
});

let notified = false;
export function notifyAllModules(): void {
	notified = true;

	const moduleObj = getModuleObj();
	for (const mod of Object.values(moduleObj)) {
		mod.notifyModulesFromExternal(moduleObj);
	}
}

export function getAllModules(notify = true): ReturnType<typeof getModuleObj> {
	if (!notified && notify) {
		notifyAllModules();
	}

	return getModuleObj();
}
