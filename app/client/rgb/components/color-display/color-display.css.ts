import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { ColorDisplay } from './color-display.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const ColorDisplayCSS = new TemplateFn<ColorDisplay>(function (html, props) {
	return html`<style>
		#display {
			background: ${props.bgStyle};
			width: 100vw;
			max-width: 1000px;
			height: 100vw;
			max-height: 1000px;
		}
	</style>`
}, CHANGE_TYPE.PROP, render);
