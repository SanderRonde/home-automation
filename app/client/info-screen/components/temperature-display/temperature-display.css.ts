import {
	TemplateFn,
	CHANGE_TYPE,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { TemperatureDisplay } from './temperature-display.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const TemperatureDisplayCSS = new TemplateFn<TemperatureDisplay>(
	function (html) {
		return html`
			<style>
				#centerer {
					display: flex;
					flex-direction: row;
					justify-content: center;
				}

				#container {
					display: flex;
					flex-direction: column;
					justify-content: flex-start;
				}

				#icon {
					width: auto;
					height: 10vh;
				}

				#temp {
					text-align: center;
					font-size: 200%;
					font-weight: bold;
				}
			</style>
		`;
	},
	CHANGE_TYPE.THEME,
	render
);
