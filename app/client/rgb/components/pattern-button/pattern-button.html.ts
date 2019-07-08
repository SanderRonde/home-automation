import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { PatternButton } from './pattern-button.js';

export const PatternButtonHTML = new TemplateFn<PatternButton>(function (html, props) {
	return html`
		<div id="container" @click="${this.onClick}">
			${props.pattern.colors.length === 0 ? html`
				<div id="cross">
					<div id="leftLine"></div>
					<div id="rightLine"></div>
				</div>
			` : html`
				<div ?selected="${props.selected}" id="pattern"></div>
			`}
		</div>
	`
}, CHANGE_TYPE.PROP, render);
