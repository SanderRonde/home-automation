import { ConfigurableWebComponent, Props, config, PROP_TYPE, ComplexType } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { PatternButton } from '../pattern-button/pattern-button.js';
import { PatternControlsHTML } from './pattern-controls.html.js';
import { PatternControlsCSS } from './pattern-controls.css.js';
import { TransitionTypes } from 'magic-home.js';

@config({
	is: 'pattern-controls',
	css: PatternControlsCSS,
	html: PatternControlsHTML
})
export class PatternControls extends ConfigurableWebComponent<{
	IDS: {
		speedSlider: HTMLInputElement;
		transitionInput: HTMLSelectElement;
	};
	CLASSES: {};
}> {
	props = Props.define(this, {
		reflect: {
			defaultTransition: PROP_TYPE.STRING,
			defaultSpeed: PROP_TYPE.NUMBER,
			parent: ComplexType<PatternButton>()
		}
	});

	private _updateParams() {
		const speed = this.$.speedSlider.valueAsNumber;
		const transitionType = this.$.transitionInput.value as TransitionTypes;
		this.props.parent.updateParams({ speed, transitionType });
	}

	speedChange() {
		this._updateParams();
	}

	transitionChange() {
		this._updateParams();
	}

	postRender() {
		this.$.speedSlider.value = (this.props.defaultSpeed - 1) + '';
		this.$.speedSlider.value = this.props.defaultSpeed + '';
	}
}