import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { PatternButton } from './pattern-button.js';

export const PatternButtonCSS = [
	new TemplateFn<PatternButton>(function (html, props) {
		return html`<style>
			#pattern {
				background-image: linear-gradient(to bottom right, ${
					props.pattern.colors.map((color) => {
						return `rgb(${color.red}, ${color.green}, ${color.blue})`
					}).join(', ')});
				width: 100%;
				height: 100%;
			}
		</style>`
	}, CHANGE_TYPE.PROP, render),
	new TemplateFn<PatternButton>(function (html) {
		return html`<style>
			span[data-type="html"], #container, #outline {
				display: flex;
				flex-grow: 100;
			}
		</style>`
	}, CHANGE_TYPE.NEVER, render)
];
