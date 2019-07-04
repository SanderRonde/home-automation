import { ConfigurableWebComponent, Props, config, ComplexType, PROP_TYPE, bindToClass } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { PatternConfig, RGBController, ColorOption } from '../rgb-controller/rgb-controller.js';
import { PatternControls } from '../pattern-controls/pattern-controls.js';
import { ColorControls } from '../color-controls/color-controls.js';
import { ColorDisplay } from '../color-display/color-display.js';
import { PatternButtonHTML } from './pattern-button.html.js';
import { PatternButtonCSS } from './pattern-button.css.js';

@config({
	is: 'pattern-button',
	css: PatternButtonCSS,
	html: PatternButtonHTML,
	dependencies: [
		PatternControls
	]
})
export class PatternButton extends ConfigurableWebComponent implements ColorOption {
	props = Props.define(this, {
		reflect: {
			pattern: ComplexType<PatternConfig>(),
			selected: PROP_TYPE.BOOL,
			parent: ComplexType<RGBController>()
		}
	});

	@bindToClass
	onClick() {
		this.props.parent.deselectAll();
		this.props.parent.setSelected(this);
		this.getRoot<RGBController>().setPattern(this.props.pattern.name,
			this.props.pattern.defaultSpeed, this.props.pattern.transitionType);
	}

	setDisplay(display: ColorDisplay) {
		const displayPattern = document.createElement('div');
		displayPattern.style.backgroundImage = `linear-gradient(to bottom right, ${
			this.props.pattern.colors.map(({ red, green, blue }) => {
				return `rgb(${red}, ${green}, ${blue})`
			}).join(', ')})`;
		display.appendElement(displayPattern);
	}

	setControls(controls: ColorControls) {
		const controller = document.createElement('pattern-controls');
		controls.appendElement(controller);
	}

	mounted() {
		// ...
	}

	firstRender() {
		// ...
	}
}