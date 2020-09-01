import {
	TemplateFn,
	CHANGE_TYPE
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { PatternControls } from './pattern-controls.js';

export const PatternControlsHTML = new TemplateFn<PatternControls>(
	function(html, { props }) {
		return html`
			<div id="container">
				<div id="sliderContainer">
					<input
						@input="${this.speedChange}"
						min="0"
						max="100"
						value="${props.defaultSpeed}"
						id="speedSlider"
						type="range"
					/>
				</div>
				<select @change="${this.transitionChange}" id="transitionInput">
					<option
						?selected="${props.defaultTransition === 'jump'}"
						value="jump"
						>Jump</option
					>
					<option
						?selected="${props.defaultTransition === 'fade'}"
						value="fade"
						>Fade</option
					>
					<option
						?selected="${props.defaultTransition === 'strobe'}"
						value="strobe"
						>Strobe</option
					>
				</select>
			</div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);
