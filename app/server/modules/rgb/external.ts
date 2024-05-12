import { MatchHandlerParams } from '../../lib/bot-state';
import { createExternalClass } from '../../lib/external';
import { LogObj } from '../../lib/logging/lob-obj';
import { LED_NAME } from '../../config/led-config';
import { APIHandler, ColorTarget } from './api';
import { RGBClient } from './client/RGBClient';
import { JoinedConfigs } from './types';
import { play } from './marked-audio';
import { Effects } from './ring-api';
import { getLed } from './clients';
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

	public async markedAudio(
		file: string,
		helpers: Pick<MatchHandlerParams, 'ask' | 'sendText' | 'askCancelable'>
	): ReturnType<typeof play> {
		return this.runRequest((_res, logObj) => {
			return play(file, logObj, helpers);
		});
	}

	public async getClient(name: LED_NAME): Promise<RGBClient | null> {
		return this.runRequest(() => {
			return getLed(name);
		});
	}
}
