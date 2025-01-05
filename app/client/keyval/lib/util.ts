export function isValSame(a: unknown, b: unknown): boolean {
	if (typeof a !== typeof b) {
		return false;
	}
	if (typeof a === 'object') {
		if (!a) {
			if (b) {
				return false;
			}
		} else if (!b) {
			return false;
		} else {
			if (Array.isArray(a)) {
				if (!isArrSame(a, b as unknown[])) {
					return false;
				}
			} else {
				if (
					!isObjSame(
						a as Record<string, unknown>,
						b as Record<string, unknown>
					)
				) {
					return false;
				}
			}
		}
	} else if (
		typeof a === 'number' ||
		typeof a === 'string' ||
		typeof a === 'boolean'
	) {
		if (a !== b) {
			return false;
		}
	} else {
		return false;
	}
	return true;
}

function isArrSame(a: unknown[], b: unknown[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (!isValSame(a[i], b[i])) {
			return false;
		}
	}
	return true;
}

function isObjSame(
	a: Record<string, unknown>,
	b: Record<string, unknown>
): boolean {
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) {
		return false;
	}

	for (const keyA of aKeys) {
		if (bKeys.indexOf(keyA) === -1) {
			return false;
		}
	}
	for (const keyB of bKeys) {
		if (aKeys.indexOf(keyB) === -1) {
			return false;
		}
	}

	for (const key in a) {
		if (!isValSame(a[key], b[key])) {
			return false;
		}
	}
	return true;
}
