import { Data } from '../../../server/lib/data';
import React from 'react';

export function useCreateData<T>(initialValue: T): Data<T> {
	const dataRef = React.useRef(initialValue);
	return React.useMemo(() => new Data<T>(dataRef.current), []);
}

export function useData<T, R = T>(data: Data<T>, callback?: (value: T) => R): R {
	const [value, setValue] = React.useState<R>(() =>
		callback ? callback(data.current()) : (data.current() as unknown as R)
	);
	const valueRef = React.useRef(value);
	valueRef.current = value;
	React.useEffect(() => {
		return data.subscribe((dataValue) => {
			if (dataValue !== undefined) {
				const newValue = callback ? callback(dataValue) : (dataValue as unknown as R);
				if (newValue !== valueRef.current) {
					setValue(newValue);
					valueRef.current = newValue;
				}
			}
		});
	}, [data, callback]);

	return value;
}
