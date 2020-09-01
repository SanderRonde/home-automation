import {
	ConfigurableWebComponent,
	Props,
	config,
	ComplexType,
	PROP_TYPE,
	bindToClass,
	Mounting
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import {
	PatternConfig,
	RGBController,
	ColorOption
} from '../rgb-controller/rgb-controller.js';
import { PatternControls } from '../pattern-controls/pattern-controls.js';
import { ColorControls } from '../color-controls/color-controls.js';
import { ColorDisplay } from '../color-display/color-display.js';
import { PatternButtonHTML } from './pattern-button.html.js';
import { PatternButtonCSS } from './pattern-button.css.js';
import { TransitionTypes } from 'magic-home';

@config({
	is: 'pattern-button',
	css: PatternButtonCSS,
	html: PatternButtonHTML,
	dependencies: [PatternControls]
})
export class PatternButton extends ConfigurableWebComponent
	implements ColorOption {
	props = Props.define(this, {
		reflect: {
			pattern: ComplexType<PatternConfig>(),
			selected: PROP_TYPE.BOOL,
			parent: ComplexType<RGBController>()
		}
	});

	@bindToClass
	onClick() {
		// Ignore clicks if this is an empty pattern
		if (this.props.pattern!.colors.length === 0) return;

		this.props.parent!.deselectAll();
		this.props.parent!.setSelected(this);
		this.getRoot<RGBController>().setPattern(
			this.props.pattern!.name,
			this.props.pattern!.defaultSpeed,
			this.props.pattern!.transitionType
		);
	}

	setDisplay(display: ColorDisplay) {
		const displayPattern = document.createElement('div');
		displayPattern.style.backgroundImage = `linear-gradient(to bottom right, ${this.props
			.pattern!.colors.map(({ red, green, blue }) => {
				return `rgb(${red}, ${green}, ${blue})`;
			})
			.join(', ')})`;
		display.appendElement(displayPattern);
	}

	setControls(controls: ColorControls) {
		const controller = document.createElement(
			'pattern-controls'
		) as PatternControls;
		controller.setAttribute(
			'defaultSpeed',
			this.props.pattern!.defaultSpeed + ''
		);
		controller.setAttribute(
			'defaultTransition',
			this.props.pattern!.transitionType + ''
		);
		Mounting.awaitMounted(controller).then(() => {
			controller!.props.parent = this;
		});
		controls.appendElement(controller);
	}

	updateParams({
		speed,
		transitionType
	}: {
		speed: number;
		transitionType: TransitionTypes;
	}) {
		this.getRoot<RGBController>().setPattern(
			this.props.pattern!.name,
			speed,
			transitionType
		);
	}
}
