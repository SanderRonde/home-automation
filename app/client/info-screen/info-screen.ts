import {
	TemplateResult,
	PropertyCommitter,
	EventPart,
	BooleanAttributePart,
	AttributeCommitter,
	NodePart,
	isDirective,
	noChange,
} from '../../../node_modules/lit-html/lit-html.js';
import { WebComponent } from '../../../node_modules/wc-lib/build/es/wc-lib.js';
import { InfoScreen } from './components/info-screen/info-screen.js';

function registerElements() {
	WebComponent.initComplexTemplateProvider({
		TemplateResult,
		PropertyCommitter,
		EventPart,
		BooleanAttributePart,
		AttributeCommitter,
		NodePart,
		isDirective,
		noChange,
	});

	InfoScreen.define();
}

registerElements();
