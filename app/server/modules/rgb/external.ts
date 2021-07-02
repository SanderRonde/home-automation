import { RGB } from '.';
import { BotState } from '../../lib/bot-state';
import { LED_NAMES } from '../../lib/constants';
import { createExternalClass } from '../../lib/external';
import { APIHandler, ColorTarget } from './api';
import { Effects } from './arduino-api';
import { getLed, RGBClient } from './clients';
import { play } from './marked-audio';
import { JoinedConfigs } from './types';

export class ExternalHandler extends createExternalClass(true) {
	async color(
		color: string,
		target: ColorTarget | LED_NAMES = 'all',
		intensity = 0
	): Promise<boolean> {
		return this.runRequest(async (res, source) => {
			return APIHandler.setColor(
				res,
				{
					color,
					intensity: intensity,
					auth: await this._getKey(res, RGB),
					target: target,
				},
				source
			);
		});
	}

	async rgb(
		red: string,
		green: string,
		blue: string,
		intensity = 0,
		target: ColorTarget | LED_NAMES = 'all'
	): Promise<boolean> {
		return this.runRequest(async (res, source) => {
			return APIHandler.setRGB(
				res,
				{
					red,
					green,
					blue,
					intensity: intensity,
					auth: await this._getKey(res, RGB),
					target: target,
				},
				source
			);
		});
	}

	async power(
		state: 'on' | 'off',
		target: ColorTarget | LED_NAMES = 'all'
	): Promise<boolean> {
		return this.runRequest(async (res, source) => {
			return APIHandler.setPower(
				res,
				{
					power: state,
					auth: await this._getKey(res, RGB),
					target,
				},
				source
			);
		});
	}

	async effect(name: Effects, extra: JoinedConfigs = {}): Promise<boolean> {
		return this.runRequest(async (res, source) => {
			return APIHandler.runEffect(
				res,
				{
					effect: name,
					auth: await this._getKey(res, RGB),
					...extra,
				},
				source
			);
		});
	}

	async markedAudio(
		file: string,
		helpers: Pick<
			BotState.MatchHandlerParams,
			'ask' | 'sendText' | 'askCancelable'
		>
	): ReturnType<typeof play> {
		return this.runRequest((_res, _source, logObj) => {
			return play(file, logObj, helpers);
		});
	}

	async getClient(name: LED_NAMES): Promise<RGBClient | null> {
		return this.runRequest(() => {
			return getLed(name);
		});
	}
}
