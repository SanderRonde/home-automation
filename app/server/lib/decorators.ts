/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/prefer-optional-chain */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import type * as express from 'express';
import { KeyError } from './errors';

export function requireParams(...keys: string[]) {
	return function <
		T,
		F extends (
			this: T,
			res: express.Response,
			params: any,
			...args: unknown[]
		) => unknown,
	>(target: F, _context: ClassMethodDecoratorContext<T, F>) {
		return function (res: express.Response, params: any, ...args: any[]) {
			for (const key of keys) {
				if (!params || !params[key]) {
					throw new KeyError(`Missing key "${key}"`);
				}
			}

			return target.bind(this)(res, params, ...args);
		} as F;
	};
}
