import {
	ConfigurableWebComponent,
	Props,
	config,
	ComplexType,
	PROP_TYPE,
	bindToClass,
	Mounting,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import type {
	PatternConfig,
	RGBController,
	ColorOption,
} from '../rgb-controller/rgb-controller.js';
import { PatternControls } from '../pattern-controls/pattern-controls.js';
import type { ColorControls } from '../color-controls/color-controls.js';
import type { ColorDisplay } from '../color-display/color-display.js';
import { PatternButtonHTML } from './pattern-button.html.js';
import { PatternButtonCSS } from './pattern-button.css.js';
import type { TransitionTypes } from 'magic-home';

@config({
	is: 'pattern-button',
	css: PatternButtonCSS,
	html: PatternButtonHTML,
	dependencies: [PatternControls],
})
export class PatternButton
	extends ConfigurableWebComponent
	implements ColorOption
{
	public props = Props.define(this, {
		reflect: {
			pattern: ComplexType<PatternConfig>(),
			selected: PROP_TYPE.BOOL,
			parent: ComplexType<RGBController>(),
		},
	});

	@bindToClass
	public async onClick(): Promise<void> {
		// Ignore clicks if this is an empty pattern
		if (this.props.pattern!.colors.length === 0) {
			return;
		}

		this.props.parent!.deselectAll();
		this.props.parent!.setSelected(this);
		await this.getRoot<RGBController>().setPattern(
			this.props.pattern!.name,
			this.props.pattern!.defaultSpeed,
			this.props.pattern!.transitionType
		);
	}

	public setDisplay(display: ColorDisplay): void {
		const displayPattern = document.createElement('div');
		displayPattern.style.backgroundImage = `linear-gradient(to bottom right, ${this.props
			.pattern!.colors.map(({ red, green, blue }) => {
				return `rgb(${red}, ${green}, ${blue})`;
			})
			.join(', ')})`;
		display.appendElement(displayPattern);
	}

	public async setControls(controls: ColorControls): Promise<void> {
		const controller = document.createElement(
			'pattern-controls'
		) as PatternControls;
		controller.setAttribute(
			'defaultSpeed',
			String(this.props.pattern!.defaultSpeed)
		);
		controller.setAttribute(
			'defaultTransition',
			String(this.props.pattern!.transitionType)
		);
		await Mounting.awaitMounted(controller).then(() => {
			controller.props.parent = this;
		});
		controls.appendElement(controller);
	}

	public async updateParams({
		speed,
		transitionType,
	}: {
		speed: number;
		transitionType: TransitionTypes;
	}): Promise<void> {
		await this.getRoot<RGBController>().setPattern(
			this.props.pattern!.name,
			speed,
			transitionType
		);
	}
}
