import {
	ConfigurableWebComponent,
	Props,
	config,
	ComplexType,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { ColorButton } from '../color-button/color-button.js';
import { RgbControlsHTML } from './rgb-controls.html.js';
import { RgbControlsCSS } from './rgb-controls.css.js';

@config({
	is: 'rgb-controls',
	css: RgbControlsCSS,
	html: RgbControlsHTML,
})
export class RgbControls extends ConfigurableWebComponent<{
	selectors: {
		IDS: {
			hueSlider: HTMLInputElement;
		};
		CLASSES: Record<string, never>;
	};
}> {
	private static readonly RANGE_COLORS = [
		[255, 0, 0],
		[255, 255, 0],
		[0, 255, 0],
		[0, 255, 255],
		[0, 0, 255],
		[255, 0, 255],
		[255, 0, 0],
	];

	public props = Props.define(this, {
		reflect: {
			parent: ComplexType<ColorButton>(),
		},
	});

	public lastColor: [number, number, number] = [0, 0, 0];

	public static getColorAtIndex(index: number): [number, number, number] {
		const groupSize = 100 / (this.RANGE_COLORS.length - 1);
		const closestGroup = Math.ceil(index / groupSize) * groupSize;
		const { start, end } = (() => {
			if (index === 100) {
				return {
					start: 100 - groupSize,
					end: 100,
				};
			}
			if (index < closestGroup) {
				return {
					start: closestGroup - groupSize,
					end: closestGroup,
				};
			} else {
				return {
					start: closestGroup,
					end: closestGroup + groupSize,
				};
			}
		})();
		const startColor = this.RANGE_COLORS[Math.round(start / groupSize)];
		const endColor = this.RANGE_COLORS[Math.round(end / groupSize)];

		const percentage = (index - start) / groupSize;
		const diffColor = startColor.map((color, index) => {
			return endColor[index] - color;
		});
		const percentageDiff = diffColor.map((c) => Math.round(c * percentage));
		return startColor.map((value, index) => {
			return value + percentageDiff[index];
		}) as [number, number, number];
	}

	public async onChange(): Promise<void> {
		const value = this.$.hueSlider.valueAsNumber;
		const color = RgbControls.getColorAtIndex(value);
		this.lastColor = color;
		this.props.parent!.updateCanvasColor(color);
		await this.props.parent!.onDrag();
	}
}
