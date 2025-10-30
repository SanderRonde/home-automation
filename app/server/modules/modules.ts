import { HomeDetector } from './home-detector';
import { Notification } from './notification';
import { Temperature } from './temperature';
import { HexLed } from './hex-led/hex-led';
import { InfoScreen } from './info-screen';
import { Wakelight } from './wakelight';
import { Dashboard } from './dashboard';
import { Webhook } from './webhook';
import { EWeLink } from './ewelink';
import { Secret } from './secret/';
import { Matter } from './matter';
import { Device } from './device';
import { WLed } from './wled';
import { Auth } from './auth';
import { MCP } from './mcp';
import { Bot } from './bot';

import type { Database } from '../lib/db';
import type { AppConfig } from '../app';
import type { SQL } from 'bun';

export type AllModules = ReturnType<typeof getModuleObj>;

export interface ModuleConfig {
	config: AppConfig;
	wsPublish: (data: string) => Promise<Bun.ServerWebSocketSendStatus>;
	db: Database<unknown>;
	sqlDB: SQL;
	modules: AllModules;
}

const getModuleObj = () => ({
	bot: Bot,
	auth: Auth,
	wled: WLed,
	hexLed: HexLed,
	device: Device,
	matter: Matter,
	dashboard: Dashboard,
	secret: Secret,
	wakelight: Wakelight,
	webhook: Webhook,
	ewelink: EWeLink,
	infoScreen: InfoScreen,
	temperature: Temperature,
	homeDetector: HomeDetector,
	notification: Notification,
	mcp: MCP,
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
