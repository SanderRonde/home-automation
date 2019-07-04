import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { PatternButton } from './pattern-button.js';

export const PatternButtonCSS = [
	new TemplateFn<PatternButton>(function (html, props) {
		return html`<style>
			#pattern {
				transition: transform 200ms ease-in-out;
				transform: scale(0.9);
				background-image: linear-gradient(to bottom right, ${
					props.pattern.colors.map(({ red, green, blue }) => {
						return `rgb(${red}, ${green}, ${blue})`
					}).join(', ')});
				width: 100%;
				height: 100%;
			}

			#pattern[selected] {
				transform: scale(1.1);
			}
		</style>`
	}, CHANGE_TYPE.PROP, render),
	new TemplateFn<PatternButton>(function (html) {
		return html`<style>
			span[data-type="html"], #container {
				display: flex;
				flex-grow: 100;
			}
		</style>`
	}, CHANGE_TYPE.NEVER, render)
];
