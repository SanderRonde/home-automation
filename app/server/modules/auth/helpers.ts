import { redact } from './secret';

export function externalRedact(text: string): string {
	return redact(text);
}
