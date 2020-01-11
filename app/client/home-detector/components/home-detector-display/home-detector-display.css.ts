import {
	CHANGE_TYPE,
	TemplateFn
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { HomeDetectorDisplay } from './home-detector-display.js';

export const HomeDetectorDisplayCSS = new TemplateFn<HomeDetectorDisplay>(
	html => {
		return html`
			<style>
				#background {
					width: 100vw;
					height: 100vh;
					background-color: rgb(40, 40, 40);
					color: rgb(230, 230, 230);
					font-size: 120%;
					font-weight: bold;
				}

				#horizontal-center {
					width: 100vw;
					display: flex;
					flex-direction: row;
					justify-content: center;
				}

				#vertical-center {
					height: 100vh;
					display: flex;
					flex-direction: column;
					justify-content: center;
				}

				.row {
					display: flex;
					flex-direction: row;
					justify-content: space-between;
					width: 400px;
					min-width: 20vw;
					margin-top: 10px;
				}
			</style>
		`;
	},
	CHANGE_TYPE.NEVER,
	render
);
