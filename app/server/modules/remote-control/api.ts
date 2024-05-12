import { errorHandle, authAll, requireParams } from '../../lib/decorators';
import { ResponseLike } from '../../lib/logging/response-logger';
import { LogObj } from '../../lib/logging/lob-obj';
import { update } from './get-set-listener';

export class APIHandler {
	@errorHandle
	@authAll
	public static async play(
		res: ResponseLike,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_params: {
			auth?: string;
		}
	): Promise<void> {
		const msg = LogObj.fromRes(res).attachMessage('Command: "play"');
		await update(
			{
				action: 'play',
			},
			msg.attachMessage('Updates')
		);
		res.status(200);
		res.end();
	}

	@errorHandle
	@authAll
	public static async pause(
		res: ResponseLike,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_params: {
			auth?: string;
		}
	): Promise<void> {
		const msg = LogObj.fromRes(res).attachMessage('Command: "pause"');
		await update(
			{
				action: 'pause',
			},
			msg.attachMessage('Updates')
		);
		res.status(200);
		res.end();
	}

	@errorHandle
	@authAll
	public static async playpause(
		res: ResponseLike,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_params: {
			auth?: string;
		}
	): Promise<void> {
		const msg = LogObj.fromRes(res).attachMessage('Command: "playpause"');
		await update(
			{
				action: 'playpause',
			},
			msg.attachMessage('Updates')
		);
		res.status(200);
		res.end();
	}

	@errorHandle
	@authAll
	public static async close(
		res: ResponseLike,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_params: {
			auth?: string;
		}
	): Promise<void> {
		const msg = LogObj.fromRes(res).attachMessage('Command: "close"');
		await update(
			{
				action: 'close',
			},
			msg.attachMessage('Updates')
		);
		res.status(200);
		res.end();
	}

	@errorHandle
	@authAll
	public static async volumeUp(
		res: ResponseLike,
		{
			amount = 10,
		}: {
			auth?: string;
			amount?: number;
		}
	): Promise<void> {
		const msg = LogObj.fromRes(res).attachMessage(
			`Command: "volumeUp", amount: "${amount}"`
		);
		await update(
			{
				action: 'volumeUp',
				amount: amount,
			},
			msg.attachMessage('Updates')
		);
		res.status(200);
		res.end();
	}

	@errorHandle
	@authAll
	public static async volumeDown(
		res: ResponseLike,
		{
			amount = 10,
		}: {
			auth?: string;
			amount?: number;
		}
	): Promise<void> {
		const msg = LogObj.fromRes(res).attachMessage(
			`Command: "volumeDown", amount: "${amount}"`
		);
		await update(
			{
				action: 'volumeDown',
				amount: amount,
			},
			msg.attachMessage('Updates')
		);
		res.status(200);
		res.end();
	}

	@errorHandle
	@requireParams('amount')
	@authAll
	public static async setVolume(
		res: ResponseLike,
		{
			amount,
		}: {
			auth?: string;
			amount: number;
		}
	): Promise<void> {
		const msg = LogObj.fromRes(res).attachMessage(
			`Command: "setVolume", amount: "${amount}"`
		);
		await update(
			{
				action: 'setVolume',
				amount,
			},
			msg.attachMessage('Updates')
		);
		res.status(200);
		res.end();
	}
}
