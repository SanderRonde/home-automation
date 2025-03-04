import type {
	KeyvalInputShape,
	KeyvalOutputShape,
} from '../../server/modules/keyval/api';
import type { KeyvalKeys } from '../../server/config/keyval-types';

export default function transform(
	config: KeyvalInputShape,
	path: string[] = []
): KeyvalOutputShape {
	const result: KeyvalOutputShape = {} as KeyvalOutputShape;

	for (const key in config) {
		const value = config[key];
		if (typeof value === 'string') {
			const fullPath = [...path, key].join('.') as KeyvalKeys;
			result[key] = {
				type: 'leaf',
				fullKey: fullPath,
				value,
				emoji: undefined
			};
		} else {
			result[key] = {
				type: 'group',
				values: transform(value, [...path, key]),
			};
		}
	}

	return result;
}
