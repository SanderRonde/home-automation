#!/usr/bin/env node

import * as MultiProgress from 'multi-progress';
import * as httpServer from 'http-server';
import * as ProgressBar from 'progress';
import * as puppeteer from 'puppeteer';
import * as symbols from 'log-symbols';
import * as chalk from 'chalk';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as http from 'http';
import * as path from 'path';

interface HTTPServer {
	server: http.Server;
	listen: http.Server['listen'];
	close(): void;
}

interface BinFile {
	file: string;
	data: number[][];
}

interface PuppetGlobal extends Window {
	data?: number[][];
	interval?: number;
	done?: boolean;
}

const HOST_PATH = '__webserver__';
const PORT = 5123;
const BINS = 100;

namespace BinGenerator {
	namespace Util {
		export function wait(time: number) {
			return new Promise((resolve) => setTimeout(resolve, time));
		}

		export async function waitUntil(
			condition: () => boolean | Promise<boolean>,
			interval: number
		) {
			while (!(await condition())) {
				await wait(interval);
			}
		}
	}

	namespace Log {
		export function groupStart(name: string) {
			process.stdout.write(`${chalk.bold(name)}\n`);
		}

		export const PREFIX = '  ';
		export function groupLog(text: string) {
			process.stdout.write(`${PREFIX}${text}\n`);
		}

		export function groupEnd() {
			process.stdout.write('\n');
		}
	}

	namespace IO {
		export namespace Input {
			function globPromise(
				globPattern: string,
				cwd: string = process.cwd()
			) {
				return new Promise<string[]>((resolve, reject) => {
					glob(
						globPattern,
						{
							cwd,
							nodir: true,
						},
						(err, matches) => {
							if (err) {
								reject(err);
							} else {
								resolve(matches);
							}
						}
					);
				});
			}

			function flat<T>(arr: T[][]): T[] {
				const acc: T[] = [];
				for (const subArr of arr) {
					acc.push(...subArr);
				}
				return acc;
			}

			async function getInputFiles(globs: string[]) {
				return flat(
					await Promise.all(
						globs.map((globPattern) => {
							return globPromise(globPattern);
						})
					)
				);
			}

			export interface IO {
				outDir: string;
				interval: number;
				inFiles: string[];
			}

			export async function getIO() {
				const io: Partial<IO> = {};

				let inFileGlobs: string[] = [];

				for (let i = 2; i < process.argv.length; i++) {
					const arg = process.argv[i];
					if (arg === '-o') {
						io.outDir = process.argv[++i];
					} else if (arg === '--output=') {
						io.outDir = arg.slice('--output='.length);
					} else if (arg === '-n') {
						io.interval = parseInt(process.argv[++i], 10);
					} else if (arg === '--interval=') {
						io.interval = parseInt(
							arg.slice('--interval='.length),
							10
						);
					} else {
						inFileGlobs.push(arg);
					}
				}

				if (!io.outDir) {
					process.stderr.write('Please supply an output dir\n');
					process.exit(1);
				} else if (!io.interval) {
					process.stderr.write('Please supply an interval\n');
					process.exit(1);
				} else if (inFileGlobs.length === 0) {
					process.stderr.write('Please supply input files\n');
					process.exit(1);
				}

				const files = await getInputFiles(inFileGlobs);

				if (files.length === 0) {
					process.stderr.write('No files found\n');
					process.exit(1);
				}

				io.inFiles = files;

				return io as IO;
			}

			export namespace Webserver {
				async function createDir() {
					await fs.ensureDir(path.join(__dirname, HOST_PATH));
				}

				export async function close(server: HTTPServer) {
					const dir = path.join(__dirname, HOST_PATH);
					const files = await fs.readdir(dir);
					await Promise.all(
						files.map((file) => fs.unlink(path.join(dir, file)))
					);
					await fs.rmdir(dir);
					server.close();
				}

				export async function copy(io: IO.Input.IO) {
					await createDir();

					await Promise.all(
						io.inFiles.map((file) => {
							return fs.copy(
								file,
								path.join(
									__dirname,
									HOST_PATH,
									path.basename(file)
								)
							);
						})
					);
				}

				export function host(): Promise<HTTPServer> {
					return new Promise((resolve) => {
						const server = httpServer.createServer({
							root: path.join(__dirname, HOST_PATH),
						}) as unknown as HTTPServer;
						server.listen(PORT, () => {
							server.server.unref();
							resolve(server);
						});
					});
				}
			}
		}

		export namespace Output {
			function getOutDir() {
				return path.join(process.cwd(), process.argv[2]);
			}

			function removeExt(file: string) {
				return file.split('.').slice(0, -1).join('.');
			}

			function getFileOutPath({ file }: BinFile) {
				return path.join(
					getOutDir(),
					`${removeExt(path.basename(file))}.bins.json`
				);
			}

			export async function writeBin(binFile: BinFile) {
				await fs.writeFile(
					getFileOutPath(binFile),
					JSON.stringify(binFile.data),
					{
						encoding: 'utf8',
					}
				);
			}

			export async function writeBins(binFiles: BinFile[]) {
				let done: number = 0;
				return Promise.all(
					binFiles.map(async (binFile) => {
						await writeBin(binFile);
						Log.groupLog(
							`Wrote file ${chalk.bold(++done + '')}/${chalk.bold(
								binFiles.length + ''
							)} "${getFileOutPath(binFile)}"`
						);
					})
				);
			}
		}
	}

	namespace Browser {
		export async function create() {
			return await puppeteer.launch();
		}

		export async function createPage(
			browser: puppeteer.Browser,
			file: string
		): Promise<puppeteer.Page> {
			const page = await browser.newPage();
			await page.goto(`http://localhost:${PORT}/${path.basename(file)}`);
			return page;
		}
	}

	namespace GenBins {
		export namespace JS {
			export async function ready(page: puppeteer.Page) {
				await page.evaluate(() => {
					const player = document.querySelector('video')!;
					player.pause();
					player.currentTime = 0;

					return Promise.resolve();
				});
				page.on('console', (msg) => {
					console.log(`Message from page: ${msg.text()}`);
				});
			}

			export async function insertBinCollection(
				page: puppeteer.Page,
				io: IO.Input.IO
			) {
				await page.evaluate(
					(BINS, INTERVAL) => {
						const puppetGlobal: PuppetGlobal = window;
						puppetGlobal.data = [];
						puppetGlobal.done = false;

						const player = document.querySelector('video')!;
						const ctx = new AudioContext();
						const analyser = ctx.createAnalyser();
						const src = ctx.createMediaElementSource(player);

						src.connect(analyser);
						src.connect(ctx.destination);

						const dataArray = new Float32Array(
							analyser.frequencyBinCount
						);
						analyser.getFloatFrequencyData(dataArray);

						function cleanData(arr: Float32Array): number[] {
							for (let i in arr) {
								if (
									arr[i] <= -100 ||
									arr[i] === -80 ||
									arr[i] === -50
								) {
									arr[i] = 0;
									continue;
								}
								arr[i] = (arr[i] + 100) / 100;
							}

							const newArray: number[] = [];

							const delta = arr.length / BINS;
							for (let i = 0; i < arr.length; i += delta) {
								let average =
									arr.slice(i, i + delta).reduce((a, b) => {
										return a + b;
									}, 0) / delta;
								newArray.push(average);
							}

							return newArray.slice(0, BINS);
						}

						function fn() {
							if (player.paused) {
								if (
									player.currentTime >=
									player.duration * 0.9
								) {
									puppetGlobal.done = true;
									window.clearInterval(puppetGlobal.interval);
								}
								return;
							}

							analyser!.getFloatFrequencyData(dataArray!);
							const bins = cleanData(dataArray!);
							puppetGlobal.data!.push(bins);
						}

						puppetGlobal.interval = window.setInterval(
							fn,
							INTERVAL
						);

						return Promise.resolve();
					},
					BINS,
					io.interval
				);
			}

			export async function getDuration(
				page: puppeteer.Page
			): Promise<number> {
				return await page.evaluate((): Promise<number> => {
					const video = document.querySelector('video')!;
					return new Promise((resolve) => {
						if (video.duration) {
							resolve(video.duration);
							return;
						}
						const interval = window.setInterval(() => {
							if (video.duration) {
								window.clearInterval(interval);
								resolve(video.duration);
							}
						}, 100);
					});
				});
			}

			export async function play(page: puppeteer.Page) {
				return await page.evaluate(() => {
					return document.querySelector('video')!.play();
				});
			}

			export async function check(page: puppeteer.Page): Promise<{
				done: boolean;
				time: number;
			}> {
				return await page.evaluate((): Promise<{
					done: boolean;
					time: number;
				}> => {
					const puppetGlobal = window as PuppetGlobal;
					return Promise.resolve({
						done: puppetGlobal.done!,
						time: document.querySelector('video')!.currentTime,
					});
				});
			}

			export async function extract(
				page: puppeteer.Page
			): Promise<number[][]> {
				return await page.evaluate((): Promise<number[][]> => {
					const puppetGlobal = window as PuppetGlobal;
					return Promise.resolve(puppetGlobal.data!);
				});
			}
		}

		namespace Bars {
			export namespace BarContent {
				export class Bar {
					private _bar: ProgressBar;
					private _barLength: number;

					private _file: string;

					private _steps: number = 0;
					private _total: number;

					private _timeRemaining: number;

					private _done: boolean = false;

					private get _progressPercent() {
						return this._steps / this._total;
					}

					constructor(
						multi: MultiProgress,
						private _duration: number,
						file: string
					) {
						this._barLength = getScaledLength(this._duration);
						this._bar = multi.newBar(
							`${Log.PREFIX}:done [:bar] :padding :etas :file`,
							{
								complete: '=',
								incomplete: ' ',
								width: this._barLength,
								total: this._duration,
								curr: 0,
							}
						);
						this._file = path.basename(file);

						this._total = this._duration;
						this._timeRemaining = this._duration;
					}

					static readonly FILE_LENGTH = 40;

					private _clipFile() {
						return this._file.slice(0, Bar.FILE_LENGTH);
					}

					private _update() {
						this._bar.update(this._progressPercent, {
							done: this._done ? symbols.success : ' ',
							file: `| ${this._clipFile()}`,
							padding: BarContent.leftpad(
								' ',
								getPadding(this._barLength, this._timeRemaining)
							),
						});
					}

					tick(time: number) {
						this._timeRemaining = this._duration - time;
						this._steps++;
						this._update();
					}

					done() {
						this._steps = this._total;
						this._timeRemaining = 0;
						this._done = true;
						this._update();
					}

					terminate() {
						this._bar.terminate();
					}
				}

				export function leftpad(char: string, amount: number) {
					return new Array(amount).fill(char).join('');
				}
			}

			// Max length is 10 minutes
			const MAX_LEN = 10 * 60;
			const PRE_PADDING = `${Log.PREFIX}✔ [`.length;
			const POST_PADDING = ' 10.0s '.length;
			const FILE_PADDING = BarContent.Bar.FILE_LENGTH + 2;
			const EDGE_PADDING = '       '.length;
			const TOTAL_PADDING =
				PRE_PADDING + POST_PADDING + FILE_PADDING + EDGE_PADDING;
			function getScaledLength(duration: number) {
				const scale = duration / MAX_LEN;
				return Math.max(
					Math.round(
						(process.stdout.columns - TOTAL_PADDING) * scale
					),
					10
				);
			}

			function getPadding(barLength: number, timeRemaining: number) {
				const target =
					process.stdout.columns -
					POST_PADDING -
					FILE_PADDING -
					EDGE_PADDING;
				const padding = target - barLength;
				if (timeRemaining < 10) {
					return padding + 1;
				}
				return padding;
			}

			export async function create(
				pages: {
					file: string;
					page: puppeteer.Page;
				}[]
			) {
				// Create progress bars
				const multi = new MultiProgress(process.stdout);
				return await Promise.all(
					pages.map(async ({ page, file }) => {
						const duration = await JS.getDuration(page);
						const bar = new BarContent.Bar(multi, duration, file);

						return {
							file,
							page,
							bar,
						};
					})
				);
			}

			export function terminate(bars: BarContent.Bar[]) {
				bars.map((bar) => bar.terminate());
			}
		}

		export async function setupPage(
			browser: puppeteer.Browser,
			file: string,
			io: IO.Input.IO
		) {
			const page = await Browser.createPage(browser, file);
			await JS.ready(page);
			await JS.insertBinCollection(page, io);
			return page;
		}

		export async function genFileBins(
			page: puppeteer.Page,
			bar: Bars.BarContent.Bar
		): Promise<number[][]> {
			await JS.play(page);
			await Util.waitUntil(async () => {
				const { done, time } = await JS.check(page);
				bar.tick(time);
				return done;
			}, 1000);

			bar.done();
			const data = await JS.extract(page);

			return data;
		}

		export async function genPages(
			browser: puppeteer.Browser,
			io: IO.Input.IO
		) {
			return await Promise.all(
				io.inFiles.map(async (file) => {
					return {
						file,
						page: await setupPage(browser, file, io),
					};
				})
			);
		}

		export async function genBins(
			pages: {
				file: string;
				page: puppeteer.Page;
			}[]
		) {
			const bars = await Bars.create(pages);

			const results = await Promise.all(
				bars.map(async ({ file, page, bar }) => {
					const data = await genFileBins(page, bar);
					return {
						file,
						data,
					};
				})
			);

			Bars.terminate(bars.map(({ bar }) => bar));

			return results;
		}
	}

	export async function main() {
		Log.groupStart('Input');
		Log.groupLog('Reading IO');
		const io = await IO.Input.getIO();
		Log.groupLog('Copying files');
		Log.groupEnd();

		Log.groupStart('Webserver:');
		await IO.Input.Webserver.copy(io);
		Log.groupLog('Starting webserver');
		const server = await IO.Input.Webserver.host();
		Log.groupLog(`Listening on port ${PORT}`);
		Log.groupEnd();

		Log.groupStart('Prep:');
		Log.groupLog('Creating browser');
		const browser = await Browser.create();
		Log.groupLog('Generating pages');
		const pages = await GenBins.genPages(browser, io);
		Log.groupEnd();

		Log.groupStart('Bins:');
		const bins = await GenBins.genBins(pages);
		Log.groupEnd();

		Log.groupStart('Export:');
		Log.groupLog('Writing bins');
		await IO.Output.writeBins(bins);
		Log.groupEnd();

		Log.groupStart('Shutdown:');
		Log.groupLog('Closing browser');
		await browser.close();
		Log.groupLog('Closing server');
		await IO.Input.Webserver.close(server);
		Log.groupEnd();

		Log.groupStart('Done!');
	}
}

(async () => {
	await BinGenerator.main();
})();
