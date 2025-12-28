// Type definitions for modules - this file should not import from modules.ts
// to avoid circular dependencies. Instead, we import each module type individually.

import type { HomeDetector } from './home-detector';
import type { Notification } from './notification';
import type { Temperature } from './temperature';
import type { LedArt } from './led-art/led-art';
import type { HomeWizard } from './homewizard';
// Note: We use a type-only import for Wakelight to avoid the cycle
// This should work because we're only using it as a type, not a value
import type { Wakelight } from './wakelight';
import type { Dashboard } from './dashboard';
import type { Webhook } from './webhook';
import type { EWeLink } from './ewelink';
import type { Secret } from './secret/';
import type { Matter } from './matter';
import type { Device } from './device';
import type { Kiosk } from './kiosk';
import type { WLed } from './wled';
import type { Tuya } from './tuya';
import type { Logs } from './logs';
import type { Auth } from './auth';
import type { Bot } from './bot';
import type { AI } from './ai';

// Define AllModules by importing each module type
// Using type-only imports should prevent the circular dependency
export type AllModules = {
	ai: typeof AI;
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
	ewelink: typeof EWeLink;
	webhook: typeof Webhook;
	wakelight: typeof Wakelight;
	dashboard: typeof Dashboard;
	homewizard: typeof HomeWizard;
	temperature: typeof Temperature;
	homeDetector: typeof HomeDetector;
	notification: typeof Notification;
};

// Re-export ModuleConfig from modules (this should be safe as it doesn't depend on AllModules)
export type { ModuleConfig } from './modules';
