import { ConfigurableWebComponent, Props, config } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { PatternControlsHTML } from './pattern-controls.html.js';
import { PatternControlsCSS } from './pattern-controls.css.js';

@config({
	is: 'pattern-controls',
	css: PatternControlsCSS,
	html: PatternControlsHTML
})
export class PatternControls extends ConfigurableWebComponent {
	props = Props.define(this, {
		// ...
	});

	mounted() {
		// ...
	}

	firstRender() {
		// ...
	}
}