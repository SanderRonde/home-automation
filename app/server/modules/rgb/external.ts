import { createExternalClass } from '../../lib/external';
import type { LED_NAME } from '../../config/led-config';
import type { RGBClient } from './client/RGBClient';
import { LogObj } from '../../lib/logging/lob-obj';
import type { JoinedConfigs } from './types';
import type { Effects } from './ring-api';
import type { ColorTarget } from './api';
import { getLed } from './clients';
import { APIHandler } from './api';
import { RGB } from '.';

export class ExternalHandler extends createExternalClass(true) {
	public async color(
		color: string,
		target: ColorTarget | LED_NAME = 'all',
		intensity = 0
	): Promise<boolean> {
		return this.runRequest(async (res) => {
			return APIHandler.setColor(res, {
				color,
				intensity: intensity,
				auth: await this._getKey(LogObj.fromRes(res), RGB),
				target: target,
			});
		});
	}

	public async rgb(
		red: string,
		green: string,
		blue: string,
		intensity = 0,
		target: ColorTarget | LED_NAME = 'all'
	): Promise<boolean> {
		return this.runRequest(async (res) => {
			return APIHandler.setRGB(res, {
				red,
				green,
				blue,
				intensity: intensity,
				auth: await this._getKey(LogObj.fromRes(res), RGB),
				target: target,
			});
		});
	}

	public async power(
		state: 'on' | 'off',
		target: ColorTarget | LED_NAME = 'all'
	): Promise<boolean> {
		return this.runRequest(async (res) => {
			return APIHandler.setPower(res, {
				power: state,
				auth: await this._getKey(LogObj.fromRes(res), RGB),
				target,
			});
		});
	}

	public async effect(
		name: Effects,
		extra: JoinedConfigs = {}
	): Promise<boolean> {
		return this.runRequest(async (res) => {
			return APIHandler.runEffect(res, {
				effect: name,
				auth: await this._getKey(LogObj.fromRes(res), RGB),
				...extra,
			});
		});
	}

	public async getClient(name: LED_NAME): Promise<RGBClient | null> {
		return this.runRequest(() => {
			return getLed(name);
		});
	}
}
