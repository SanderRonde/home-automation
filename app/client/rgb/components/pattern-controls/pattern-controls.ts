import {
	ConfigurableWebComponent,
	Props,
	config,
	PROP_TYPE,
	ComplexType,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import type { PatternButton } from '../pattern-button/pattern-button.js';
import { PatternControlsHTML } from './pattern-controls.html.js';
import { PatternControlsCSS } from './pattern-controls.css.js';
import type { TransitionTypes } from 'magic-home';

@config({
	is: 'pattern-controls',
	css: PatternControlsCSS,
	html: PatternControlsHTML,
})
export class PatternControls extends ConfigurableWebComponent<{
	selectors: {
		IDS: {
			speedSlider: HTMLInputElement;
			transitionInput: HTMLSelectElement;
		};
		CLASSES: Record<string, never>;
	};
}> {
	public props = Props.define(this, {
		reflect: {
			defaultTransition: PROP_TYPE.STRING,
			defaultSpeed: PROP_TYPE.NUMBER,
			parent: ComplexType<PatternButton>(),
		},
	});

	private async _updateParams() {
		const speed = this.$.speedSlider.valueAsNumber;
		const transitionType = this.$.transitionInput.value as TransitionTypes;
		await this.props.parent!.updateParams({
			speed,
			transitionType,
		});
	}

	public async speedChange(): Promise<void> {
		await this._updateParams();
	}

	public async transitionChange(): Promise<void> {
		await this._updateParams();
	}

	public postRender(): void {
		this.$.speedSlider.value = String(this.props.defaultSpeed! - 1);
		this.$.speedSlider.value = String(this.props.defaultSpeed);
	}
}
