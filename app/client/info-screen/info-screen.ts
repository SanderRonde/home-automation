import {
	TemplateResult,
	PropertyCommitter,
	EventPart,
	BooleanAttributePart,
	AttributeCommitter,
	NodePart,
	isDirective,
	noChange,
	directive,
} from 'lit-html';
import { InfoScreen } from './components/info-screen/info-screen.js';
import { WebComponent } from 'wc-lib';

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
		directive,
	});

	InfoScreen.define();
}

registerElements();
