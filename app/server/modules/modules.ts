import { AndroidControl } from './android-control';
import { HomeDetector } from './home-detector';
import { Notification } from './notification';
import { Temperature } from './temperature';
import { SmartThings } from './smartthings';
import { HomeWizard } from './homewizard';
import { Wakelight } from './wakelight';
import { Dashboard } from './dashboard';
import { Location } from './location';
import { Filament } from './filament';
import { BambuLab } from './bambulab';
import { Webhook } from './webhook';
import { EWeLink } from './ewelink';
import { Secret } from './secret/';
import { LedArt } from './led-art';
import { System } from './system';
import { Matter } from './matter';
import { Device } from './device';
import { Backup } from './backup';
import { Kiosk } from './kiosk';
import { WLed } from './wled';
import { Tuya } from './tuya';
import { Nuki } from './nuki';
import { Logs } from './logs';
import { Auth } from './auth';
import { Bot } from './bot';
import { AI } from './ai';

import type { Database } from '../lib/db';
import type { AppConfig } from '../app';
import type { SQL } from 'bun';

// Import AllModules type from types.ts to avoid circular dependency
import type { AllModules } from './types';

// The runtime value is still computed here
export type { AllModules };

export interface ModuleConfig {
	config: AppConfig;
	wsPublish: (data: string) => Promise<Bun.ServerWebSocketSendStatus>;
	db: Database<unknown>;
	sqlDB: SQL;
	modules: AllModules;
}

const getModuleObj = () => ({
	ai: AI,
	androidControl: AndroidControl,
	bot: Bot,
	auth: Auth,
	logs: Logs,
	wled: WLed,
	tuya: Tuya,
	kiosk: Kiosk,
	ledArt: LedArt,
	device: Device,
	matter: Matter,
	secret: Secret,
	backup: Backup,
	system: System,
	ewelink: EWeLink,
	webhook: Webhook,
	location: Location,
	wakelight: Wakelight,
	dashboard: Dashboard,
	homewizard: HomeWizard,
	temperature: Temperature,
	smartthings: SmartThings,
	nuki: Nuki,
	homeDetector: HomeDetector,
	notification: Notification,
	bambulab: BambuLab,
	filament: Filament,
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
