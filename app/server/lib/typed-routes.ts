export type TypedJsonResponse<T> = Response & {
	__type?: T
}

export function jsonResponse<D>(data: D, init?: ResponseInit): TypedJsonResponse<D> {
	return Response.json(data, init);
}