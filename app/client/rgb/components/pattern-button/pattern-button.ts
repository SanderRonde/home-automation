import { ConfigurableWebComponent, Props, config, ComplexType } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { PatternConfig } from '../rgb-controller/rgb-controller.js';
import { PatternButtonHTML } from './pattern-button.html.js';
import { PatternButtonCSS } from './pattern-button.css.js';

@config({
	is: 'pattern-button',
	css: PatternButtonCSS,
	html: PatternButtonHTML
})
export class PatternButton extends ConfigurableWebComponent {
	props = Props.define(this, {
		reflect: {
			pattern: ComplexType<PatternConfig>()
		}
	});

	mounted() {
		// ...
	}

	firstRender() {
		// ...
	}
}