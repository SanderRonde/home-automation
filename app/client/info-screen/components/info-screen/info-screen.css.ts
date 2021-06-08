import {
	CHANGE_TYPE,
	TemplateFn,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { InfoScreen } from './info-screen.js';

export const InfoScreenCSS = new TemplateFn<InfoScreen>(
	(html) => {
		return html`
			<style>
				@font-face {
					font-family: 'Roboto';
					src: url('/fonts/Roboto-Regular.ttf');
				}

				#background {
					width: 100vw;
					height: 100vh;
					background-color: rgb(0, 0, 0);
					color: white;
					font-size: 120%;
					font-family: 'Roboto', Arial, Helvetica, sans-serif;
					cursor: none;
				}

				#background.blank > * {
					display: none;
				}

				#grid {
					width: 100vw;
					height: 100vh;
					display: grid;
					grid-template-columns: 25% 25% 25% 25%;
					grid-template-rows: 8.3% 8.3% 8.3% 8.3% 8.3% 8.3% 8.3% 8.3% 8.3% 8.3% 8.3% 8.3% auto;
					height: 100vh;
					width: 100vw;
				}

				#top-date {
					grid-column-start: 2;
					grid-column-end: 4;
					grid-row-start: 1;
					grid-row-end: 4;
				}

				#daily-temp {
					grid-column-start: 1;
					grid-column-end: 2;
					grid-row-start: 1;
					grid-row-end: 3;
				}

				#daily-temp {
					grid-column-start: 1;
					grid-column-end: 2;
					grid-row-start: 3;
					grid-row-end: 5;
				}

				#right-temp {
					grid-column-start: 4;
					grid-column-end: 5;
					grid-row-start: 1;
					grid-row-end: 3;
				}

				#server-temp {
					grid-column-start: 4;
					grid-column-end: 5;
					grid-row-start: 3;
					grid-row-end: 5;
				}

				#calendar {
					bottom: 3vh;
					position: absolute;
				}

				#offline {
					grid-column-start: 1;
					grid-column-end: 2;
					grid-row-start: 3;
					grid-row-end: 4;
					width: 10vw;
					margin-left: 8vw;
				}
			</style>
		`;
	},
	CHANGE_TYPE.NEVER,
	render
);
