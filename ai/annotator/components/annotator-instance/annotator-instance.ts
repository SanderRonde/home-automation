import { ConfigurableWebComponent, Props, config, PROP_TYPE } from '../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { IDMap, ClassMap } from './annotator-instance-querymap';
import { AnnotatorInstanceHTML } from './annotator-instance.html.js';
import { AnnotatorInstanceCSS } from './annotator-instance.css.js';

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
}|{
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
	}|null = null;

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

		this.$.vid.currentTime -= 10;
	}

	seekRight() {
		if (!this.$.vid) return;

		this.$.vid.currentTime += 10;
	}

	mark(type: 'melody'|'beat', time = this.$.vid.currentTime, duration = 0.01) {
		const canvas = type === 'melody' ? this.$.melodies : this.$.beats;
		const color = type === 'melody' ? '#3F51B5' : '#ff2110';

		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = color;
		const startX = (time / this.$.vid.duration) * canvas.width;
		const endX = type === 'beat' ? 
			1 : 
			((((time + duration) / this.$.vid.duration) * canvas.width) - startX);
		ctx.fillRect(startX, 0, endX, canvas.height);

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

	private _markTimesInCanvas(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = '#fff';
		const delta = canvas.width / 10;
		new Array(9).fill('').forEach((_, index) => {
			ctx.fillRect((delta * (index + 1)) - 1, 0, 2, canvas.height);
		});
	}

	private _melody: {
		startTime: number;
	}|null = null;
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

	clearLast() {
		const time = this.$.vid.currentTime;
		this.items = this.items.filter((item) => {
			return item.time < (time - 10);
		});

		// Repaint
		this._forcePaint(this.items);
	}

	keyDown(e: KeyboardEvent) {
		switch (e.keyCode) {
			case 37:
				this.seekLeft();
				break;
			case 39:
				this.seekRight();
				break;
			case 32:
				this.markBeat();
				break;
			case 68:
				this.prepDownload();
				break;
			case 77:
				this.melodyStart();
				break;
		}
	}

	keyUp(e: KeyboardEvent) {
		switch (e.keyCode) {
			case 77:
				this.melodyEnd();
				break;
		}
	}

	postRender() {
		if (this.$.vid) {
			this.props.length = this.$.vid.duration;
		}
	}

	private async _getJsonFile() {
		try {
			return await fetch(`${location.origin}/${this.props.filename!.replace('.wav', '.json')}`);
		} catch(e) {
			return null;
		}
	}

	private _forcePaint(entries: Entry[]) {
		for (const entry of entries) {
			if (entry.type === 'beat') {
				this.markBeat(entry.time);
			} else {
				this.markMelody(entry.time, entry.duration);
			}
		}
	}

	private async _fileNameChange() {
		// Reset everything
		this._markTimesInCanvas(this.$.beats);
		this._markTimesInCanvas(this.$.melodies);
		this._markTimesInCanvas(this.$.times);
		this.items = [];

		// Fill based on associated JSON file's markings
		if (this.props.filename === null || this.props.filename === 'null') return;
		const file = await this._getJsonFile();
		if (!file) return;

		const content = await file.json() as AnnotatedFile;
		await waitUntil(() => {
			return !!(this.$.vid && this.$.vid.duration);
		});
		if (content.items) {
			this._forcePaint(content.items);
		}
		if (content.genre) {
			this._setGenre(content.genre.hard, content.genre.uptempo);
		}

		this.items = [...content.items];
	}

	mounted() {
		this.listen('propChange', (name: string) => {
			if (name === 'filename') {
				this._fileNameChange();
			}
		});
		window.addEventListener('keydown', this.keyDown.bind(this));
		window.addEventListener('keyup', this.keyUp.bind(this));
	}
}