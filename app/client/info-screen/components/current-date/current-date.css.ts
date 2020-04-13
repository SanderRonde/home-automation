import {
	TemplateFn,
	CHANGE_TYPE
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { CurrentDate } from './current-date.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const CurrentDateCSS = new TemplateFn<CurrentDate>(
	function(html) {
		return html`
			<style>
				#date-line {
					text-align: center;
					font-size: 180%;
					margin-top: 2.5vh;
				}

				#time-line {
					text-align: center;
					font-size: 700%;
				}
			</style>
		`;
	},
	CHANGE_TYPE.THEME,
	render
);
