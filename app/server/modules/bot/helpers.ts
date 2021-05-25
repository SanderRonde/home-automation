import chalk from 'chalk';
import { Bot } from '.';
import { logFirst } from '../../lib/logger';

export async function printCommands(): Promise<void> {
	logFirst(
		`${chalk.bold('Available commands are')}:\n\n${Object.values(
			await Bot.modules
		)
			.map((mod) => {
				const meta = 'meta' in mod ? mod.meta : mod;
				return typeof meta.bot === 'function' ? meta.bot : meta.bot.Bot;
			})
			.map((bot) => {
				return `${Object.keys(bot.commands)
					.map((cmd) => {
						return `${chalk.bold(cmd.slice(1))} - ${
							bot.commands[cmd as keyof typeof bot.commands]
						}`;
					})
					.join('\n')}`;
			})
			.join('\n')}\n`
	);
}
