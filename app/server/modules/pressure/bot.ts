import { BotStateBase } from '../../lib/bot-state';
import { MatchParameters } from '../bot/message';
import { PressureValueKeeper } from './values';
import { MatchResponse } from '../bot/types';
import { ExternalHandler } from './external';

export class Bot extends BotStateBase {
	public static valueKeeper: PressureValueKeeper | null = null;

	public static readonly commands = {
		'/pressure': 'Turn on pressure module',
		'/pressureoff': 'Turn off pressure module',
		'/help_pressure': 'Print help comands for keyval',
	};

	public static readonly botName = 'Pressure';

	public static readonly matches = Bot.createMatchMaker(
		({ matchMaker: mm, fallbackSetter: fallback }) => {
			mm(
				'/pressureoff',
				/turn off pressure( module)?/,
				async ({ logObj }) => {
					await new ExternalHandler(logObj, 'PRESSURE.BOT').disable();
					return 'Turned off pressure module';
				}
			);
			mm('/pressures', /what are the pressures/, () => {
				return Bot.makeTable({
					header: ['key', 'value'],
					contents: Array.from(
						(this.valueKeeper?.getAll() ?? new Map()).entries()
					).map(([key, pressure]) => {
						return [key, String(pressure)];
					}),
				});
			});
			mm(
				'/pressure',
				/turn on pressure( module)?/,
				async ({ logObj }) => {
					await new ExternalHandler(logObj, 'PRESSURE.BOT').enable();
					return 'Turned on pressure module';
				}
			);
			mm('/help_pressure', /what commands are there for pressure/, () => {
				return `Commands are:\n${Bot.matches.matches
					.map((match) => {
						return `RegExps: ${match.regexps
							.map((r) => r.source)
							.join(', ')}. Texts: ${match.texts.join(', ')}}`;
					})
					.join('\n')}`;
			});

			fallback(({ state }) => {
				Bot.resetState(state);
			});
		}
	);

	public static async match(
		config: MatchParameters
	): Promise<MatchResponse | undefined> {
		return await this.matchLines({
			...config,
			matchConfig: Bot.matches,
		});
	}

	public toJSON(): Record<string, never> {
		return {};
	}
}
