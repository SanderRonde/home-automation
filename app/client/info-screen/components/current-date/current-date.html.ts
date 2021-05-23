import {
	TemplateFn,
	CHANGE_TYPE,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { CurrentDate } from './current-date.js';

export const CurrentDateHTML = new TemplateFn<CurrentDate>(
	(html) => {
		return html`
			<div id="date-line">
				${new Intl.DateTimeFormat('nl-NL', {
					weekday: 'long',
					day: '2-digit',
					month: 'long',
					year: 'numeric',
				}).format(new Date())}
				(${new Intl.DateTimeFormat('nl-NL', {
					day: '2-digit',
					month: '2-digit',
					year: '2-digit',
				}).format(new Date())})
			</div>
			<div id="time-line">
				${new Intl.DateTimeFormat('nl-NL', {
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
				}).format(new Date())}
			</div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);
