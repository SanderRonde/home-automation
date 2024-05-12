import { getTime } from './logger';
import chalk from 'chalk';

export class ProgressLogger {
	private _progress = 0;
	private _startTime = Date.now();

	public constructor(
		private readonly _name: string,
		private readonly _max: number
	) {}

	private _getProgressBar() {
		if (this._max - this._progress < 0) {
			console.log(
				chalk.red('Increment got called more often than configured')
			);
		}
		return `[${new Array(this._progress).fill('*').join('')}${new Array(
			this._max - this._progress
		)
			.fill(' ')
			.join('')}]`;
	}

	public logInitial(): void {
		console.log(
			chalk.bgBlack(
				getTime(),
				chalk.bgBlack(
					chalk.bold(
						chalk.white(`${this._name}: ${this._getProgressBar()}`)
					)
				)
			)
		);
	}

	public increment(name: string): void {
		this._progress++;
		console.log(
			chalk.bgBlack(
				getTime(),
				chalk.bgBlack(
					chalk.bold(
						chalk.white(
							`${this._name}: ${this._getProgressBar()} - `
						),
						chalk.green('✔'),
						chalk.white(name)
					)
				)
			)
		);
	}

	public done(): void {
		if (this._progress > this._max) {
			console.log(
				chalk.red('Increment got called more often than configured')
			);
		} else if (this._progress < this._max) {
			console.log(
				chalk.red('Increment got called less times than configured')
			);
		}

		console.log(
			chalk.bgBlack(
				getTime(),
				chalk.bgBlack(
					chalk.bold(
						`Done loading ${this._name} in ${Date.now() - this._startTime}ms`
					)
				)
			)
		);
	}
}
