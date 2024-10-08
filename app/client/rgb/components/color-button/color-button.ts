import {
	ComplexType,
	ConfigurableWebComponent,
	Props,
	PROP_TYPE,
	config,
	bindToClass,
	Mounting,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import type {
	RGBController,
	ColorOption,
} from '../rgb-controller/rgb-controller.js';
import type { ColorControls } from '../color-controls/color-controls.js';
import type { ColorDisplay } from '../color-display/color-display.js';
import { RgbControls } from '../rgb-controls/rgb-controls.js';
import { ColorButtonHTML } from './color-button.html.js';
import { ColorButtonCSS } from './color-button.css.js';

@config({
	is: 'color-button',
	css: ColorButtonCSS,
	html: ColorButtonHTML,
	dependencies: [RgbControls],
})
export class ColorButton
	extends ConfigurableWebComponent
	implements ColorOption
{
	private static readonly _touchBallSize =
		Math.min(window.innerWidth, 1000) * 0.07;
	private static readonly _COLOR_UPDATE_INTERVAL = 100;
	private _canvasContainer: HTMLElement | null = null;
	private _canvas: HTMLCanvasElement | null = null;
	private _controls: RgbControls | null = null;
	private _touchBall: HTMLElement | null = null;
	private _canvasDimensions: {
		width: number;
		height: number;
	} | null = null;
	private _lastTouch: {
		x: number;
		y: number;
	} | null = null;
	private _lastColorUpdate: number = Date.now();
	private _lastQueuedColor: null | {
		timeout: number;
		color: [number, number, number];
	} = null;

	public props = Props.define(this, {
		reflect: {
			selected: PROP_TYPE.BOOL,
			parent: ComplexType<RGBController>(),
		},
	});

	public get canvas(): HTMLCanvasElement {
		if (this._canvas) {
			return this._canvas;
		}
		this._canvas = document.createElement('canvas');
		return this._canvas;
	}
	public get canvasDimensions(): {
		width: number;
		height: number;
	} {
		if (this._canvasDimensions) {
			return this._canvasDimensions;
		}
		const { width, height } = this.canvas.getBoundingClientRect();
		this._canvasDimensions = {
			width,
			height,
		};
		return this._canvasDimensions;
	}
	public get canvasContainer(): HTMLElement {
		if (this._canvasContainer) {
			return this._canvasContainer;
		}

		this._canvasContainer = document.createElement('div');
		this._canvasContainer.appendChild(this.canvas);
		this.canvas.style.width = '100%';
		this.canvas.style.height = '100%';

		const blackShade = document.createElement('div');
		blackShade.style.width = '100%';
		blackShade.style.height = '100%';
		blackShade.style.transform = 'translateY(-100%)';
		blackShade.style.backgroundImage =
			'linear-gradient(to bottom, rgba(0, 0, 0, 0), rgb(0, 0, 0))';
		blackShade.addEventListener('touchmove', (e) => void this.onDrag(e), {
			passive: false,
		});
		blackShade.addEventListener(
			'touchstart',
			(e) => {
				void this.onDrag(e, true);
			},
			{
				passive: false,
			}
		);
		blackShade.addEventListener(
			'touchend',
			(e) => {
				void this.onDrag(e, true);
			},
			{
				passive: false,
			}
		);
		blackShade.addEventListener(
			'click',
			(e) => {
				void this.onDrag(e, true);
			},
			{
				passive: false,
			}
		);
		this._canvasContainer.appendChild(blackShade);
		return this._canvasContainer;
	}
	public get controls(): RgbControls {
		if (this._controls) {
			return this._controls;
		}
		this._controls = document.createElement('rgb-controls') as RgbControls;
		void Mounting.awaitMounted(this._controls).then(() => {
			this._controls!.props.parent = this;
		});
		return this._controls;
	}
	public get touchBall(): HTMLElement {
		if (this._touchBall) {
			return this._touchBall;
		}
		this._touchBall = document.createElement('div');
		this._touchBall.style.borderRadius = '50%';
		const size = ColorButton._touchBallSize;
		this._touchBall.style.width = `${size}px`;
		this._touchBall.style.height = `${size}px`;
		this._touchBall.style.border = `${size / 6}px solid white`;
		this._touchBall.style.position = 'absolute';
		this._touchBall.style.top = '0';
		this._touchBall.style.left = '0';
		this.touchBall.style.willChange = 'transform';
		this.canvasContainer.appendChild(this._touchBall);

		return this._touchBall;
	}

	private _getTouchPos(e?: TouchEvent | MouseEvent) {
		if (!e) {
			return this._lastTouch;
		}
		if ('clientX' in e) {
			const pos = {
				x: e.clientX,
				y: e.clientY,
			};
			return (this._lastTouch = pos);
		} else {
			if (!e.touches.length) {
				return null;
			}
			const pos = {
				x: e.touches[0].clientX,
				y: e.touches[0].clientY,
			};
			return (this._lastTouch = pos);
		}
	}

	private _getColorAtCoord({
		x,
		y,
	}: {
		x: number;
		y: number;
	}): [number, number, number] {
		const xFactor = Math.max(
			Math.min(1 - x / this.canvasDimensions.width, 1),
			0
		);
		const yFactor = Math.max(
			Math.min(1, 1 - y / this.canvasDimensions.height),
			0
		);
		return [255, 255, 255]
			.map((color, index) => {
				return color - this.controls.lastColor[index];
			})
			.map((c) => Math.round(c * xFactor))
			.map((diffColor, index) => {
				return this.controls.lastColor[index] + diffColor;
			})
			.map((c) => Math.round(c * yFactor)) as [number, number, number];
	}

	private async _updateColor(color: [number, number, number]) {
		this._lastColorUpdate = Date.now();
		this._lastQueuedColor = null;
		await this.getRoot<RGBController>().setColor(color);
	}
	private async _queueSetColor(color: [number, number, number]) {
		if (this._lastQueuedColor) {
			window.clearTimeout(this._lastQueuedColor.timeout);
		}
		if (
			Date.now() >
			this._lastColorUpdate + ColorButton._COLOR_UPDATE_INTERVAL
		) {
			// Do it now
			await this._updateColor(color);
			return;
		}

		// Queue render
		this._lastQueuedColor = {
			timeout: window.setTimeout(
				() => {
					void this._updateColor(color);
				},
				ColorButton._COLOR_UPDATE_INTERVAL -
					(Date.now() - this._lastColorUpdate)
			),
			color,
		};
	}

	@bindToClass
	public async onDrag(
		e?: TouchEvent | MouseEvent,
		force = false
	): Promise<void> {
		e?.preventDefault();
		const coords = this._getTouchPos(e);
		if (!coords) {
			return;
		}

		const offset = ColorButton._touchBallSize / 2;
		this.touchBall.style.transform = `translate(${coords.x - offset}px, ${
			coords.y - offset
		}px)`;
		const color = this._getColorAtCoord(coords);
		if (force) {
			await this._updateColor(color);
		} else {
			await this._queueSetColor(color);
		}
	}

	@bindToClass
	public onClick(): void {
		this.props.parent!.deselectAll();
		this.props.parent!.setSelected(this);
	}

	public setDisplay(display: ColorDisplay): void {
		display.appendElement(this.canvasContainer);
	}

	public setControls(controls: ColorControls): void {
		controls.appendElement(this.controls);
		const color = RgbControls.getColorAtIndex(50);
		this.controls.lastColor = color;
		this.updateCanvasColor(color);
	}

	public updateCanvasColor([red, green, blue]: [
		number,
		number,
		number,
	]): void {
		const ctx = this.canvas.getContext('2d')!;

		const gradient = ctx.createLinearGradient(
			0,
			this.canvas.height / 2,
			this.canvas.width,
			this.canvas.height / 2
		);
		gradient.addColorStop(0, 'white');
		gradient.addColorStop(1, `rgb(${red}, ${green}, ${blue})`);

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
	}
}
