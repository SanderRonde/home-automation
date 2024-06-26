import chalk from 'chalk';
import { Bot } from '.';

export async function printCommands(): Promise<void> {
	console.log(
		`${chalk.bold('Available commands are')}:\n\n${Object.values(
			await Bot.modules
		)
			.map((meta) => {
				return meta.Bot;
			})
			.map((bot) => {
				return `${Object.keys(bot.commands)
					.map((cmd) => {
						return `${chalk.bold(cmd.slice(1))} - ${
							bot.commands[
								cmd as keyof typeof bot.commands
							] as string
						}`;
					})
					.join('\n')}`;
			})
			.join('\n')}\n`
	);
}
