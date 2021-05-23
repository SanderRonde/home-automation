/**
 * TODO: rename this to types.ts after the
 * move of types.ts to color.ts is done
 */

export type PossiblePromise<V> = V | Promise<V>;

declare global {
	type EncodedString<T> = string & {
		__type: T;
	};

	interface JSON {
		/**
		 * Converts a JavaScript Object Notation (JSON) string into an object.
		 * @param text A valid JSON string.
		 * @param reviver A function that transforms the results. This function is called for each member of the object.
		 * If a member contains nested objects, the nested objects are transformed before the parent object is.
		 */
		parse<T>(
			text: EncodedString<T>,
			reviver?: (key: unknown, value: unknown) => unknown
		): T;
		/**
		 * Converts a JavaScript value to a JavaScript Object Notation (JSON) string.
		 * @param value A JavaScript value, usually an object or array, to be converted.
		 * @param replacer A function that transforms the results.
		 * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
		 */
		stringify<T>(
			value: T,
			replacer?: (key: string, value: unknown) => unknown,
			space?: string | number
		): EncodedString<T>;
		/**
		 * Converts a JavaScript value to a JavaScript Object Notation (JSON) string.
		 * @param value A JavaScript value, usually an object or array, to be converted.
		 * @param replacer An array of strings and numbers that acts as a approved list for selecting the object properties that will be stringified.
		 * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
		 */
		stringify<T>(
			value: T,
			replacer?: (number | string)[] | null,
			space?: string | number
		): EncodedString<T>;
	}
}
