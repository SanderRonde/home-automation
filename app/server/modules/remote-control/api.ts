import { errorHandle, authAll, requireParams } from '../../lib/decorators';
import { ResponseLike, attachMessage } from '../../lib/logger';
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
		const msg = attachMessage(res, 'Command: "play"');
		await update(
			{
				action: 'play',
			},
			attachMessage(msg, 'Updates')
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
		const msg = attachMessage(res, 'Command: "pause"');
		await update(
			{
				action: 'pause',
			},
			attachMessage(msg, 'Updates')
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
		const msg = attachMessage(res, 'Command: "playpause"');
		await update(
			{
				action: 'playpause',
			},
			attachMessage(msg, 'Updates')
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
		const msg = attachMessage(res, 'Command: "close"');
		await update(
			{
				action: 'close',
			},
			attachMessage(msg, 'Updates')
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
		const msg = attachMessage(
			res,
			`Command: "volumeUp", amount: "${amount}"`
		);
		await update(
			{
				action: 'volumeUp',
				amount: amount,
			},
			attachMessage(msg, 'Updates')
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
		const msg = attachMessage(
			res,
			`Command: "volumeDown", amount: "${amount}"`
		);
		await update(
			{
				action: 'volumeDown',
				amount: amount,
			},
			attachMessage(msg, 'Updates')
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
		const msg = attachMessage(
			res,
			`Command: "setVolume", amount: "${amount}"`
		);
		await update(
			{
				action: 'setVolume',
				amount,
			},
			attachMessage(msg, 'Updates')
		);
		res.status(200);
		res.end();
	}
}
