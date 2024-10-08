import {
	TemplateFn,
	CHANGE_TYPE,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import type { CurrentDate } from './current-date.js';

export const CurrentDateCSS = new TemplateFn<CurrentDate>(
	(html) => {
		return html`
			<style>
				#date-line {
					text-align: center;
					font-size: 170%;
					margin-top: 2.5vh;
				}

				#time-line {
					text-align: center;
					font-size: 700%;
				}

				#time-seconds {
					color: #5d5d5d;
				}
			</style>
		`;
	},
	CHANGE_TYPE.THEME,
	render
);
