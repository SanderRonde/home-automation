import { attachSourcedMessage, LogObj, ResponseLike } from '../../lib/logger';
import { auth, errorHandle, requireParams } from '../../lib/decorators';
import { Action, getInTimeWindow, getLastX } from './explaining';
import { Explain } from './index';

export class APIHandler {
	private static async _castActions(
		logObj: LogObj,
		descr: string,
		actions: Action[]
	) {
		await new (await Explain.modules).cast.External(
			logObj,
			'EXPLAIN.API'
		).say(
			`${descr}. ${actions
				.map((action) => {
					return `At ${new Date(
						action.timestamp
					).toLocaleTimeString()}, source ${
						action.source
					} and module ${action.moduleName}. Description: ${
						action.description
					}`;
				})
				.join('')}`
		);
	}

	@errorHandle
	@requireParams('amount')
	@auth
	public static async getLastX(
		res: ResponseLike,
		{
			amount,
			announce = false,
		}: {
			amount: number;
			announce?: boolean;
			auth?: string;
		},
		source: string
	): Promise<Action[]> {
		const actions = getLastX(amount);
		const msg = attachSourcedMessage(
			res,
			source,
			await Explain.explainHook,
			`Showing last ${amount} actions`,
			JSON.stringify(actions)
		);

		if (announce) {
			await this._castActions(msg, `Last ${amount} actions are`, actions);
		}

		return actions;
	}

	@errorHandle
	@requireParams('mins')
	@auth
	public static async getLastXMins(
		res: ResponseLike,
		{
			mins,
			announce = false,
		}: {
			mins: number;
			announce?: boolean;
			auth?: string;
		},
		source: string
	): Promise<Action[]> {
		const actions = getInTimeWindow(mins);
		const msg = attachSourcedMessage(
			res,
			source,
			await Explain.explainHook,
			`Showing last ${mins}ms of actions`,
			JSON.stringify(actions)
		);

		if (announce) {
			await this._castActions(
				msg,
				`Last ${mins}ms of actions are`,
				actions
			);
		}

		return actions;
	}
}
