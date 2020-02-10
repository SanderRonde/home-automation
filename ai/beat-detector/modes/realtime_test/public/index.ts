namespace RealtimeTester {
	namespace Elements {
		export function getSubmit() {
			return document.querySelector('#submit') as HTMLButtonElement;
		}

		export function getInput() {
			return document.querySelector('#urlInput') as HTMLInputElement;
		}

		export function getVideo() {
			return document.querySelector('video') as HTMLVideoElement;
		}

		export function beat() {
			return document.querySelector('#beatSide') as HTMLElement;
		}

		export function melody() {
			return document.querySelector('#melodySide') as HTMLElement;
		}
	}

	namespace Util {
		export function wait(time: number) {
			return new Promise((resolve) => window.setTimeout(resolve, time));
		}
		
		export async function waitUntil(condition: () => boolean|Promise<boolean>, interval: number) {
			while (!await condition()) {
				await wait(interval);
			}
		}
	}

	namespace BeatDetector {
		export namespace YTContent {
			const BINS = 100;
			const url = '/api/beat';

			namespace Notify {
				export function showBeat(intensity: number) {
					const rounded = Math.round(intensity * 100) / 100;
					Elements.beat().style.transform = `scaleX(${rounded})`;
				}

				export function showMelody(intensity: number) {
					const rounded = Math.round(intensity * 100) / 100;
					Elements.melody().style.transform = `scaleX(${rounded})`;
				}
			}
		
			namespace Connection {		
				export async function send(data: number[]) {
					const result = await fetch(`${url}`, {
						method: 'POST',
						body: JSON.stringify({
							data
						}),
						headers: {
							'Content-Type': 'application/json'
						}
					}).then(r => r.json()) as {
						beat: number;
						melody: number;
					};

					Notify.showBeat(result.beat);
					Notify.showMelody(result.melody);
				}
			}
		
			namespace Analysis {
				let analyser: AnalyserNode|null = null;
				let dataArray: Float32Array|null = null;
				export function init(_analyser: AnalyserNode) {
					analyser = _analyser;
					dataArray = new Float32Array(analyser.frequencyBinCount);
					analyser.getFloatFrequencyData(dataArray!);
				}
		
				function cleanData(arr: Float32Array): number[] {
					for (let i in arr) {
						if (arr[i] <= -100 || arr[i] === -80 || arr[i] === -50) {
							arr[i] = 0;
							continue;
						}
						arr[i] = (arr[i] + 100) / 100;
					}
		
					const newArray: number[] = [];
		
					const delta = (arr.length / BINS);
					for (let i = 0; i < arr.length; i += delta) {
						let average = arr.slice(i, i + delta).reduce((a, b) => {
							return a + b;
						}, 0) / delta;
						newArray.push(average);
					}
		
					return newArray.slice(0, BINS);
				}
		
				let _video: HTMLVideoElement|null = null;
				export function analyse() {
					if (!_video) {
						_video = Elements.getVideo();
					}
					if (_video.paused) return;

					analyser!.getFloatFrequencyData(dataArray!);
					const bins = cleanData(dataArray!);
					Connection.send(bins);
					onScreen.show(bins);
				}
			}
		
			function attachAnalyser() {
				const video = Elements.getVideo();
				const ctx = new AudioContext();
		
				const analyser = ctx.createAnalyser();
				const src = ctx.createMediaElementSource(video);
		
				src.connect(analyser);
				src.connect(ctx.destination);
		
				return analyser;
			}
		
			export async function hook() {
				const { interval } = await fetch('/api/interval').then(r => r.json()) as {
					interval: number;
				};
		
				const analyser = attachAnalyser();
				if (!analyser) return;
				Analysis.init(analyser);
				setInterval(Analysis.analyse, interval);
			}

			export function play() {
				const video = Elements.getVideo();
				video.play();
			}
		
			export namespace onScreen {
				let bins: HTMLElement[] = [];
				let container: HTMLElement = document.createElement('div');
		
				function insertCSS() {
					const css = document.createElement('style');
					css.type = 'text/css';
					css.appendChild(document.createTextNode(`#bin_container {
						position: fixed;
						bottom: 0;
						width: 100vw;
						height: 50vh;
						pointer-events: none;
						display: flex;
						flex-direction: row;
						justify-content: center;
					}`));
					css.appendChild(document.createTextNode(`.bin {
						height: 50vh;
						background-color: rgba(255, 0, 255, 0.7);
						margin: 0 1px;
						flex-grow: 100;
						will-change: transform;
						transform: scaleY(0);
						transform-origin: bottom;
					}`));
					document.head.append(css);
				}
		
				export function init() {
					for (let i = 0; i < BINS; i++) {
						bins.push(document.createElement('div'));
					}
					
					document.body.appendChild(container);
					container.id = 'bin_container';
		
					bins.forEach((bin) => {
						bin.classList.add('bin');
						container.appendChild(bin);
					});
		
					insertCSS();
				}
		
				export function show(data: number[]) {
					if (bins.length === 0) return;
					data.forEach((value, index) => {
						bins[index].style.transform = `scaleY(${value.toPrecision(5)})`;
					});
				}
			}
		}

		YTContent.hook();
		YTContent.onScreen.init();
	}

	namespace Downloading {
		async function checkDLStatus(url: string) {
			const result = await fetch(`/api/dlReady`, {
				method: 'POST',
				body: JSON.stringify({
					url
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			}).then(r => r.json()) as {
				done: boolean;
				url: string;
			};

			if (!result.done) return false;
			
			const video = Elements.getVideo();
			const src = document.createElement('source');
			src.src = result.url;
			src.type = 'audio/mp3';

			video.appendChild(src);

			return true;
		}

		export async function dlURL(url: string) {
			fetch(`/api/dl`, {
				method: 'POST',
				body: JSON.stringify({
					url
				}),
				headers: {
					'Content-Type': 'application/json'
				}
			});
	
			await Util.waitUntil(async () => {
				return await checkDLStatus(url);
			}, 2500);
		}
	}

	export async function onSubmit() {
		const value = Elements.getInput().value;
		if (!value) {
			alert('Please input a URL');
			return;
		}
		
		await Downloading.dlURL(value);

		await Util.wait(2000);
			
		BeatDetector.YTContent.play();
	}

	export function init() {
		Elements.getSubmit().addEventListener('click', onSubmit);
	}
}

RealtimeTester.init();