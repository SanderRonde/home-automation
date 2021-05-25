import { BotState } from '../../lib/bot-state';
import { LED_NAMES } from '../../lib/constants';
import { createExternalClass } from '../../lib/external';
import { Auth } from '../auth';
import { APIHandler } from './api';
import { Effects } from './arduino-api';
import { getLed, RGBClient } from './clients';
import { play } from './marked-audio';
import { JoinedConfigs } from './types';

export class ExternalHandler extends createExternalClass(true) {
	async color(
		color: string,
		target = 'all',
		intensity = 0
	): Promise<boolean> {
		return this.runRequest((res, source) => {
			return APIHandler.setColor(
				res,
				{
					color,
					intensity: intensity,
					// TODO: change to external
					auth: Auth.Secret.getKey(),
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
		target = 'all'
	): Promise<boolean> {
		return this.runRequest((res, source) => {
			return APIHandler.setRGB(
				res,
				{
					red,
					green,
					blue,
					intensity: intensity,
					auth: Auth.Secret.getKey(),
					target: target,
				},
				source
			);
		});
	}

	async power(state: 'on' | 'off'): Promise<boolean> {
		return this.runRequest((res, source) => {
			return APIHandler.setPower(
				res,
				{
					power: state,
					auth: Auth.Secret.getKey(),
				},
				source
			);
		});
	}

	async effect(name: Effects, extra: JoinedConfigs = {}): Promise<boolean> {
		return this.runRequest((res, source) => {
			return APIHandler.runEffect(
				res,
				{
					effect: name,
					auth: Auth.Secret.getKey(),
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
