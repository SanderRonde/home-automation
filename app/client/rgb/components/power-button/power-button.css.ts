import {
	TemplateFn,
	CHANGE_TYPE
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { PowerButton } from './power-button.js';

export const PowerButtonCSS = new TemplateFn<PowerButton>(
	function(html) {
		return html`
			<style>
				span[data-type='html'],
				#container {
					display: flex;
					flex-grow: 100;
				}

				#container {
					background-image: url('/rgb/static/images/power-button.png');
					background-repeat: round;
					background-size: cover;
					transform: scale(0.9);
					cursor: pointer;
				}

				#container.on {
					background-image: url('/rgb/static/images/power-button-on.png');
				}
			</style>
		`;
	},
	CHANGE_TYPE.THEME,
	render
);
