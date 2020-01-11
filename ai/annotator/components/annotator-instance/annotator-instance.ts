import { ConfigurableWebComponent, Props, config, PROP_TYPE } from '../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { AnnotatorInstanceHTML } from './annotator-instance.html.js';
import { AnnotatorInstanceCSS } from './annotator-instance.css.js';
import { IDMap, ClassMap } from './annotator-instance-querymap';

type IDMapT = {
	[key: string]: HTMLElement;
} & IDMap;
type ClassMapT = {
	[key: string]: HTMLElement;
} & ClassMap;

type Entry = {
	type: 'melody';
	time: number;
	duration: number;
} | {
	type: 'beat';
	time: number;
};

type Items = Entry[];

type AnnotatedFile = {
	items: Items;
	genre: {
		hard: number;
		uptempo: number;
	}
};

function waitUntil(fn: () => boolean, interval: number = 50) {
	return new Promise((resolve) => {
		function doCheck() {
			if (fn()) {
				resolve();
			} else {
				window.setTimeout(doCheck, interval);
			}
		}
		doCheck();
	});
}


@config({
	is: 'annotator-instance',
	css: AnnotatorInstanceCSS,
	html: AnnotatorInstanceHTML
})
export class AnnotatorInstance extends ConfigurableWebComponent<{
	selectors: {
		IDS: IDMapT;
		CLASSES: ClassMapT;
	}
}> {
	items: Items = [];
	genre: {
		hard: number;
		uptempo: number;
	} | null = null;

	props = Props.define(this, {
		reflect: {
			filename: {
				type: PROP_TYPE.STRING,
				value: null
			},
			length: {
				type: PROP_TYPE.NUMBER,
				value: 0
			}
		}
	});

	private _setGenre(x: number, y: number) {
		this.genre = {
			hard: x,
			uptempo: y
		};

		const canvas = this.$.genreSelect;
		const ctx = this.$.genreSelect.getContext('2d')!;
		ctx.fillStyle = '#ff0000';
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillRect(canvas.width * x, canvas.height * y, 20, 10);
	}

	defineGenre(e: MouseEvent) {
		const x = e.clientX - this.$.genreSelect.getBoundingClientRect().left;
		const y = e.clientY - this.$.genreSelect.getBoundingClientRect().top;
		this._setGenre(x / 150, y / 150);
	}

	seekLeft() {
		if (!this.$.vid) return;

		this.$.vid.currentTime -= 5;
	}

	seekRight() {
		if (!this.$.vid) return;

		this.$.vid.currentTime += 5;
	}

	paint(type: 'melody' | 'beat', time = this.$.vid.currentTime, duration = 0.01) {
		const canvas = type === 'melody' ? this.$.melodies : this.$.beats;
		const zoomedCanvas = type === 'melody' ? this.$.zoomedMelodies : this.$.zoomedBeats;
		const color = type === 'melody' ? '#3F51B5' : '#ff2110';

		const ctx = canvas.getContext('2d')!;
		const zoomedCtx = zoomedCanvas.getContext('2d')!;
		ctx.fillStyle = zoomedCtx.fillStyle = color;
		const startX = (time / this.$.vid.duration) * canvas.width;
		const endX = type === 'beat' ?
			1 :
			((((time + duration) / this.$.vid.duration) * canvas.width) - startX);
		ctx.fillRect(startX, 0, endX, canvas.height);

		const zoomedStartX = time * 10;
		const zoomedEndX = type === 'beat' ?
			1 : (((time + duration) * 10) - zoomedStartX);
		zoomedCtx.fillRect(zoomedStartX, 0, zoomedEndX, canvas.height);
	}

	mark(type: 'melody' | 'beat', time = this.$.vid.currentTime, duration = 0.01) {
		this.paint(type, time, duration);

		if (type === 'melody') {
			this.items.push({
				type, time, duration
			});
		} else {
			this.items.push({
				type,
				time
			});
		}
	}

	markMelody(time?: number, duration?: number) {
		this.mark('melody', time, duration);
	}

	markBeat(time?: number, duration?: number) {
		this.mark('beat', time, duration);
	}

	paintMelody(time?: number, duration?: number) {
		this.paint('melody', time, duration);
	}

	paintBeat(time?: number, duration?: number) {
		this.paint('beat', time, duration);
	}

	private _markTimesInCanvas(canvas: HTMLCanvasElement, zoomedCanvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = '#fff';
		const delta = canvas.width / 10;
		new Array(9).fill('').forEach((_, index) => {
			ctx.fillRect((delta * (index + 1)) - 1, 0, 2, canvas.height);
		});

		const zoomedCtx = zoomedCanvas.getContext('2d')!;
		zoomedCtx.fillStyle = '#fff';

		for (let i = 10; i < this.props.length; i += 10) {
			zoomedCtx.fillRect(((10 * i)) - 1, 0, 2, canvas.height);
		}
	}
	
	private _secsToTime(secs: number): string {
		const mins = Math.floor(secs / 60);
		const remSecs = (() => {
			const sec = Math.round(secs % 60);
			if (sec > 9) {
				return sec + '';
			} else {
				return sec + '0';
			}
		})();
	
		const hours = Math.floor(mins / 60);
		const remMins = Math.round(mins % 60);
	
		if (hours) {
			return `${hours}:${remMins}:${remSecs}`;
		}
		return `${remMins}:${remSecs}`;
	}

	private _markTimeText() {
		const canvas = this.$.text;
		const zoomedCanvas = this.$.zoomedText;
		const ctx = canvas.getContext('2d')!;
		const zoomedCtx = zoomedCanvas.getContext('2d')!;
		ctx.fillStyle = zoomedCtx.fillStyle = '#fff';
		ctx.textAlign = zoomedCtx.textAlign = "center";
		ctx.font = zoomedCtx.font = '12px Arial';

		for (let i = 0; i < 10; i++) {
			const time = this._secsToTime(this.props.length * i / 10);
			ctx.fillText(time, canvas.width * i / 10, canvas.height * 0.7);
		}
		for (let i = 0; i < this.props.length; i += 10) {
			const time = this._secsToTime(i);
			zoomedCtx.fillText(time, 10 * i, zoomedCanvas.height * 0.7);
		}
	}

	private _melody: {
		startTime: number;
	} | null = null;
	melodyStart() {
		if (this._melody) return;
		this._melody = {
			startTime: this.$.vid.currentTime
		}
	}

	melodyEnd() {
		const start = this._melody!.startTime;
		const now = this.$.vid.currentTime;
		this.markMelody(start, now - start);
		this._melody = null;
	}

	markStart() {
		if (this.markType === 'melody') {
			this.melodyStart();
		} else {
			this.markBeat();
		}
	}

	markEnd() {
		if (this.markType === 'melody') {
			this.melodyEnd();
		}
	}

	prepDownload() {
		this.$.download.href = `data:text/plain;charset=utf-8,${
			encodeURIComponent(JSON.stringify({
				items: this.items,
				genre: this.genre || {
					hard: 0.5,
					uptempo: 0.5
				}
			}))
			}`;
	}

	get markType() {
		return this.$.markMode.checked ?
			'melody' : 'beat';
	}

	clearLast() {
		const time = this.$.vid.currentTime;
		this.items = this.items.filter((item) => {
			return item.time < (time - 10) || item.type !== this.markType;
		});

		// Repaint
		this._forcePaint(this.items);
		
		// Seek
		this.seekLeft();
	}

	undo() {
		const last = this.items.filter(i => i.type === this.markType).pop();

		this.items = this.items.filter(i => i !== last);

		// Repaint
		this._forcePaint(this.items);
	}

	private _pressed: HTMLButtonElement|null = null;
	private _markPressed(element: HTMLButtonElement) {
		this._pressed = element;
		this._pressed.classList.add('active');
	}

	private _release() {
		this._pressed?.classList.remove('active');
		this._pressed = null;
	}

	keyDown(e: KeyboardEvent) {
		switch (e.keyCode) {
			// <-
			case 37:
				this._markPressed(this.$.left);
				this.seekLeft();
				break;
			// ->
			case 39:
				this._markPressed(this.$.right);
				this.seekRight();
				break;
			// space
			case 32:
				this._markPressed(this.$.beat);
				this.markStart();
				break;
			// c
			case 67:
				this._markPressed(this.$.clearBeat);
				this.clearLast();
				break;
			// d
			case 68:
				this._markPressed(this.$.prepDownload);
				this.prepDownload();
				break;
			// p
			case 80:
				this._markPressed(this.$.pauseplay);
				this.pausePlay();
				break;
			// u
			case 85:
				this._markPressed(this.$.undo);
				this.undo();
				break;
		}
	}

	keyUp(e: KeyboardEvent) {
		switch (e.keyCode) {
			// space
			case 32:
				this.markEnd();
				break;
		}
		this._release();
	}

	pausePlay() {
		this.$.vid.paused ? 
			this.$.vid.play() : this.$.vid.pause();
	}

	postRender() {
		if (this.$.vid) {
			this.props.length = this.$.vid.duration;
		}
	}

	private async _getJsonFile() {
		try {
			return await fetch(`${location.origin}/${this.props.filename!.replace('.wav', '.json')}`);
		} catch (e) {
			return null;
		}
	}

	private _clearAll() {
		// Clear everything
		[this.$.beats, this.$.melodies, this.$.zoomedBeats, this.$.zoomedMelodies, this.$.zoomedText, this.$.text].map((canvas) => {
			canvas.getContext('2d') ?.clearRect(0, 0, canvas.width, canvas.height);
		});
		this._markTimesInCanvas(this.$.beats, this.$.zoomedBeats);
		this._markTimesInCanvas(this.$.melodies, this.$.zoomedMelodies);
		this._markTimesInCanvas(this.$.times, this.$.zoomedTimes);
		this._markTimeText();
	}

	private _forcePaint(entries: Entry[]) {
		this._clearAll();
		for (const entry of entries) {
			if (entry.type === 'beat') {
				this.paintBeat(entry.time);
			} else {
				this.paintMelody(entry.time, entry.duration);
			}
		}
	}

	private async _fileNameChange() {
		await waitUntil(() => {
			return !!(this.$.vid && this.$.vid.duration);
		});

		// Reset everything
		this._clearAll();
		this.items = [];

		// Fill based on associated JSON file's markings
		if (this.props.filename === null || this.props.filename === 'null') return;
		const file = await this._getJsonFile();
		if (!file || file.status === 404) return;

		const content = await file.json() as AnnotatedFile;
		if (content.items) {
			this._forcePaint(content.items);
		}
		if (content.genre) {
			this._setGenre(content.genre.hard, content.genre.uptempo);
		}

		this.items = [...content.items];
	}
	
	private _secPx = window.innerWidth / 100;
	private _boundPaint = this._paintTime.bind(this);
	private _paintTime() {
		const vid = this.$.vid;
		if (vid && !vid.paused) {
			const canvas = this.$.time;
			const zoomedCanvas = this.$.zoomedTime;
			const ctx = canvas.getContext('2d')!;
			const zoomedCtx = zoomedCanvas.getContext('2d')!;
			zoomedCtx.fillStyle = ctx.fillStyle = '#fff';
			zoomedCtx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			// Paint zoomed range
			const midTime = Math.max(Math.min(vid.currentTime, vid.duration - 50), 50);
			const startTime = midTime - 50;
			const endTime = midTime + 50;

			const startX = canvas.width * (startTime / vid.duration) - 1;
			const endX = canvas.width * (endTime / vid.duration) - 1;
			ctx.fillRect(startX, 0, 2, canvas.height);
			ctx.fillStyle = '#242424';
			ctx.fillRect(startX + 2, 0, (endX - startX) - 2, canvas.height);
			ctx.fillStyle = '#fff';
			ctx.fillRect(endX, 0, 2, canvas.height);

			// Paint time dot
			const percentage = vid.currentTime / vid.duration;
			ctx.beginPath();
			ctx.arc(percentage * canvas.width, canvas.height / 2, 15, 0, 2 * Math.PI);
			ctx.fill();
			ctx.stroke();

			// Paint zoomed time dot
			zoomedCtx.beginPath();
			zoomedCtx.arc(vid.currentTime * 10, canvas.height / 2, 15, 0, 2 * Math.PI);
			zoomedCtx.fill();
			zoomedCtx.stroke();

			// Move the range
			this.$.zoomedTimeline.style.transform = `translateX(-${Math.round(this._secPx * startTime)}px)`;
		}
		window.requestAnimationFrame(this._boundPaint);
	}

	async mounted() {
		this.listen('propChange', (name: string) => {
			if (name === 'filename') {
				this._fileNameChange();
			}
		});
		window.addEventListener('keydown', this.keyDown.bind(this));
		window.addEventListener('keyup', this.keyUp.bind(this));
		window.requestAnimationFrame(this._boundPaint);
		window.addEventListener('resize', () => {
			this._secPx = window.innerWidth / 100;
		});

		// await new Promise(resolve => window.setTimeout(resolve, 1000));

		// this.props.filename = `ANNA  - Hidden Beauties (Original Mix).wav`;
	}
}