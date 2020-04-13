import {
	ConfigurableWebComponent,
	Props,
	config
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { CurrentDateHTML } from './current-date.html.js';
import { CurrentDateCSS } from './current-date.css.js';

@config({
	is: 'current-date',
	css: CurrentDateCSS,
	html: CurrentDateHTML
})
export class CurrentDate extends ConfigurableWebComponent {
	props = Props.define(this, {
		// ...
	});

	mounted() {
		setInterval(() => {
			this.renderToDOM();
		}, 250);
	}

	firstRender() {
		// ...
	}
}
