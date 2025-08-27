import { HomeDetector } from './home-detector';
import { Temperature } from './temperature';
import { Webhook } from './webhook';
import { EWeLink } from './ewelink';
import { Secret } from './secret/';
import { Matter } from './matter';
import { KeyVal } from './keyval';
import { Device } from './device';
import { Config } from './config';
import { Auth } from './auth';
import { Bot } from './bot';

import type { AsyncExpressApplication } from '../types/express';
import type { SQLDatabase } from '../lib/sql-db';
import { InfoScreen } from './info-screen';
import type { WSWrapper } from '../lib/ws';
import type { Database } from '../lib/db';
import type { AppConfig } from '../app';

export { HomeDetector } from './home-detector';
export { Temperature } from './temperature';
export { Webhook } from './webhook';
export { EWeLink } from './ewelink';
export { Secret } from './secret/';
export { KeyVal } from './keyval';
export { Matter } from './matter';
export { Config } from './config';
export { Auth } from './auth';
export { Bot } from './bot';

export type AllModules = ReturnType<typeof getModuleObj>;

export type InstanceOf<T> = T extends {
	new (...args: unknown[]): infer I;
}
	? I
	: void;

export type ModuleHookables = {
	[K in keyof AllModules]: AllModules[K];
};

export interface BaseModuleConfig {
	app: AsyncExpressApplication;
	websocket: WSWrapper;
	config: AppConfig;
	randomNum: number;
}

export interface ModuleConfig extends BaseModuleConfig {
	db: Database;
	sqlDB: SQLDatabase;
	modules: AllModules;
}

const getModuleObj = () => ({
	bot: Bot,
	auth: Auth,
	device: Device,
	keyval: KeyVal,
	matter: Matter,
	config: Config,
	secret: Secret,
	webhook: Webhook,
	ewelink: EWeLink,

	infoScreen: InfoScreen,
	temperature: Temperature,
	homeDetector: HomeDetector,
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
