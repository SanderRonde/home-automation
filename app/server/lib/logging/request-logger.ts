import { IP_LOG_VERSION } from '../constants';
import type { BunRequest } from 'bun';

export function getIP(req: BunRequest): string | undefined {
	const fwd = req.headers.get('x-forwarded-for');
	if (fwd?.includes(',')) {
		const [ipv4, ipv6] = fwd.split(',');
		return IP_LOG_VERSION === 'ipv4' ? ipv4 : ipv6;
	}
	return fwd ?? undefined;
}
