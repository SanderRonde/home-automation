// Type definitions for modules - this file should not import from modules.ts
// to avoid circular dependencies. Instead, we import each module type individually.

import type { AndroidControl } from './android-control';
import type { HomeDetector } from './home-detector';
import type { Notification } from './notification';
import type { Temperature } from './temperature';
import type { HomeWizard } from './homewizard';
// Note: We use a type-only import for Wakelight to avoid the cycle
// This should work because we're only using it as a type, not a value
import type { Wakelight } from './wakelight';
import type { Dashboard } from './dashboard';
import type { Location } from './location';
import type { BambuLab } from './bambulab';
import type { Webhook } from './webhook';
import type { EWeLink } from './ewelink';
import type { Secret } from './secret/';
import type { LedArt } from './led-art';
import type { System } from './system';
import type { Matter } from './matter';
import type { Device } from './device';
import type { Backup } from './backup';
import type { Kiosk } from './kiosk';
import type { WLed } from './wled';
import type { Tuya } from './tuya';
import type { Nuki } from './nuki';
import type { Logs } from './logs';
import type { Auth } from './auth';
import type { Bot } from './bot';
import type { AI } from './ai';

// Define AllModules by importing each module type
// Using type-only imports should prevent the circular dependency
export type AllModules = {
	ai: typeof AI;
	androidControl: typeof AndroidControl;
	bot: typeof Bot;
	auth: typeof Auth;
	logs: typeof Logs;
	wled: typeof WLed;
	tuya: typeof Tuya;
	kiosk: typeof Kiosk;
	ledArt: typeof LedArt;
	device: typeof Device;
	matter: typeof Matter;
	secret: typeof Secret;
	system: typeof System;
	ewelink: typeof EWeLink;
	webhook: typeof Webhook;
	wakelight: typeof Wakelight;
	dashboard: typeof Dashboard;
	homewizard: typeof HomeWizard;
	temperature: typeof Temperature;
	nuki: typeof Nuki;
	homeDetector: typeof HomeDetector;
	location: typeof Location;
	notification: typeof Notification;
	backup: typeof Backup;
	bambulab: typeof BambuLab;
};

// Re-export ModuleConfig from modules (this should be safe as it doesn't depend on AllModules)
export type { ModuleConfig } from './modules';
