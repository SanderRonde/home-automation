import { BotState } from '../../lib/bot-state';
import { MatchParameters } from '../bot/message';
import { MatchResponse } from '../bot/types';
import { ExternalHandler } from './external';
import { LOCAL_URLS } from './local-urls';
import { PASTAS } from './pasta';

export class Bot extends BotState.Base {
	static readonly commands = {
		'/castoff': 'Turn off cast that is playing',
		'/casturl': 'Cast given URL',
		'/say': 'Say given text',
		'/pasta': 'Serve given pasta',
		'/pastas': 'List all pastas',
		'/mp3s': 'List all mp3 files',
	};

	static readonly botName = 'Cast';

	static readonly matches = Bot.createMatchMaker(({ matchMaker: mm }) => {
		mm('/castoff', /stop cast(ing)?/, async ({ logObj }) => {
			await new ExternalHandler(logObj, 'CAST.BOT').stop();
			return 'Stopped casting';
		});
		mm(/(cast url|\/casturl)(\s*)(.*)/, async ({ logObj, match }) => {
			await new ExternalHandler(logObj, 'CAST.BOT').url(match[3]);
			return `Casting URL "${match[3]}"`;
		});
		mm(
			/(say|\/say)(\s*)(in lang(uage)?(\s*)(\w+))?(\s*)(.*)/,
			async ({ logObj, match }) => {
				const lang = match[6] || 'en';
				const text = match[8];
				await new ExternalHandler(logObj, 'CAST.BOT').say(text, lang);
				return `Saying "${text}" in lang "${lang}"`;
			}
		);
		mm(
			/\/pastas/,
			/show me all (of your)? pasta(s)?/,
			/what pasta(s)? do you have/,
			() => {
				return `The pastas we have are: ${Bot.formatList(
					Object.keys(PASTAS)
				)}`;
			}
		);
		mm(
			/(pasta|show pasta|play pasta|\/pasta)(\s*)(.*)/,
			async ({ logObj, match }) => {
				const pasta = match[3];
				if (!(pasta in PASTAS)) {
					return "We don't have that pasta";
				}
				await new ExternalHandler(logObj, 'CAST.BOT').pasta(pasta);
				return `Played pasta: "${pasta}"`;
			}
		);
		mm(/\/mp3s/, /show all mp3s/, () => {
			return `The mp3s are: ${Bot.formatList(Object.keys(LOCAL_URLS))}`;
		});
	});

	constructor(_json?: Record<string, never>) {
		super();
	}

	static async match(
		config: MatchParameters
	): Promise<MatchResponse | undefined> {
		return await this.matchLines({
			...config,
			matchConfig: Bot.matches,
		});
	}

	toJSON(): Record<string, never> {
		return {};
	}
}
