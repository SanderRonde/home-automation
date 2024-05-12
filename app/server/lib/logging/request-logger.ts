import { IP_LOG_VERSION } from '../constants';
import * as express from 'express';
import * as http from 'http';

// TODO:(sander) move?
export function getIP(
	req: express.Request | http.ClientRequest
): string | undefined {
	const headers =
		'headers' in req
			? req.headers
			: 'getHeaders' in req
				? req.getHeaders()
				: {};
	const fwd = headers?.['x-forwarded-for'];
	if (Array.isArray(fwd)) {
		return fwd[0];
	}
	if (typeof fwd === 'string' && fwd.includes(',')) {
		const [ipv4, ipv6] = fwd.split(',');
		return IP_LOG_VERSION === 'ipv4' ? ipv4 : ipv6;
	}
	return (fwd as string | undefined) || ('ip' in req ? req.ip : undefined);
}
