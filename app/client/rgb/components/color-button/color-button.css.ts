import {
	TemplateFn,
	CHANGE_TYPE,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { ColorButton } from './color-button.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const ColorButtonCSS = [
	new TemplateFn<ColorButton>(
		(html) => {
			return html`
				<style>
					#image {
						transition: transform 200ms ease-in-out;
						transform: scale(0.9);
						background-image: conic-gradient(
							rgb(255, 0, 0),
							rgb(255, 165, 0),
							rgb(255, 255, 0),
							rgb(0, 128, 0),
							rgb(173, 216, 230),
							rgb(0, 0, 255),
							rgb(128, 0, 128),
							rgb(255, 0, 0)
						);
						width: 100%;
						height: 100%;
					}

					#image[selected] {
						transform: scale(1.1);
					}
				</style>
			`;
		},
		CHANGE_TYPE.THEME,
		render
	),
	new TemplateFn<ColorButton>(
		(html) => {
			return html`
				<style>
					span[data-type='html'],
					#container {
						display: flex;
						flex-grow: 100;
					}
				</style>
			`;
		},
		CHANGE_TYPE.NEVER,
		render
	),
];
