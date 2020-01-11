import {
	TemplateFn,
	CHANGE_TYPE
} from '../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../node_modules/lit-html/lit-html.js';
import { AnnotatorMain } from './annotator-main.js';

export const AnnotatorMainHTML = new TemplateFn<AnnotatorMain>(
	function(html, props) {
		return html`
			<div id="selecter">
				<button @click=${this.prevSong} id="prev">Previous</button>
				<select @change=${this.onSelect} id="select">
					${props.fileNames.map(fileName => {
						return html`
							<option value="${fileName}">${fileName}</option>
						`;
					})}
				</select>
				<button @click=${this.nextSong} id="next">Next</button>

				<annotator-instance
					filename=${this.props.fileNames[this.props.selected] ||
						null}
				></annotator-instance>
			</div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);
