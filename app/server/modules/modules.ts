import { RemoteControl } from '@server/modules/remote-control';
import { SpotifyBeats } from '@server/modules/spotify-beats';
import { HomeDetector } from '@server/modules/home-detector';
import { Temperature } from '@server/modules/temperature';
import { SmartHome } from '@server/modules/smart-home';
import { SwitchBot } from '@server/modules/switchbot';
import { Pressure } from '@server/modules/pressure';
import { Movement } from '@server/modules/movement';
import { Explain } from '@server/modules/explain';
import { Webhook } from '@server/modules/webhook';
import { EWeLink } from '@server/modules/ewelink';
import { Script } from '@server/modules/script';
import { Secret } from '@server/modules/secret';
import { Notion } from '@server/modules/notion';
import { KeyVal } from '@server/modules/keyval';
import { OAuth } from '@server/modules/oauth';
import { Tuya } from '@server/modules/tuya';
import { Auth } from '@server/modules/auth';
import { Cast } from '@server/modules/cast';
import { Hue } from '@server/modules/hue';
import { Bot } from '@server/modules/bot';
import { RGB } from '@server/modules/rgb';

import { AsyncExpressApplication } from '@server/types/express';
import { SQLDatabaseWithSchema } from '@server/lib/sql-db';
import { WSSimulator, WSWrapper } from '@server/lib/ws';
import { InfoScreen } from '@server/modules/info-screen';
import { Database } from '@server/lib/db';
import { ModuleMeta } from '@server/modules/meta';
import { Config } from '@server/app';

export { RemoteControl } from './remote-control';
export { SpotifyBeats } from './spotify-beats';
export { HomeDetector } from './home-detector';
export { Temperature } from './temperature';
export { SmartHome } from './smart-home/';
export { SwitchBot } from './switchbot/';
export { Pressure } from './pressure';
export { Movement } from './movement';
export { Explain } from './explain';
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
	explain: Explain,
	pressure: Pressure,
	movement: Movement,
	smartHome: SmartHome,
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
