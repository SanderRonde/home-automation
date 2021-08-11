import {
	AuthorizationCode,
	AuthorizationCodeModel,
	Client,
	Falsey,
	RefreshToken,
	RefreshTokenModel,
	Token,
	User,
} from 'oauth2-server';
import { Database } from '../../lib/db';
import oAuthClients from '../../config/oauth-clients';
import { logTag } from '../../lib/logger';
import { SettablePromise } from '../../lib/util';
import OAuthServer from 'express-oauth-server';

/**
 * When true, access tokens never expire. This
 * is useful if only trusted clients have tokens
 * and the refresh flow isn't fully set up yet.
 */
const ENABLE_NEVER_EXPIRING_TOKENS = true;

interface DBToken {
	scope?: string | string[];
	client: Client;
	user: User;
	accessToken: string;
	accessTokenExpiresAt: number;
	refreshToken?: string;
	refreshTokenExpiresAt?: number;
}

type DBAuthorizationCode = Pick<
	AuthorizationCode,
	'authorizationCode' | 'expiresAt' | 'redirectUri'
> & {
	client: Client;
	user: User;
};

class OAuthModel implements AuthorizationCodeModel, RefreshTokenModel {
	constructor(public db: Database) {}

	getClient(
		clientID: string,
		clientSecret: string | null
	): Promise<typeof oAuthClients[number] | undefined> {
		logTag('oauth', 'cyan', `Finding client "${clientID}"`);
		const foundClient = oAuthClients.find((client) => {
			if (client.id !== clientID) {
				return false;
			}
			return (
				clientSecret === null || client.clientSecret === clientSecret
			);
		});
		logTag('oauth', 'cyan', `Found client with ID "${clientID}"`);

		return Promise.resolve(foundClient);
	}

	saveToken(token: Token, client: Client, user: User) {
		const dbToken: DBToken = {
			accessToken: token.accessToken,
			accessTokenExpiresAt: (
				token.accessTokenExpiresAt as Date
			)?.getTime(),
			refreshToken: token.refreshToken,
			refreshTokenExpiresAt: token.refreshTokenExpiresAt?.getTime(),
			client,
			user,
		};
		this.db.pushVal('tokens', dbToken);

		logTag(
			'oauth',
			'cyan',
			`Saving token for client "${client.id}" and user`,
			user
		);

		return Promise.resolve({
			...dbToken,
			accessTokenExpiresAt: token.accessTokenExpiresAt,
			refreshTokenExpiresAt: token.refreshTokenExpiresAt,
		});
	}

	async getAccessToken(accessToken: string) {
		logTag(
			'oauth',
			'cyan',
			`Getting token for access token "${accessToken}"`
		);
		const tokens = this.db.get<DBToken[]>('tokens', []);
		const match = tokens.find((token) => token.accessToken === accessToken);
		if (!match) {
			return undefined;
		}

		return Promise.resolve({
			...match,
			accessTokenExpiresAt: match.accessTokenExpiresAt
				? new Date(
						match.accessTokenExpiresAt +
							(ENABLE_NEVER_EXPIRING_TOKENS
								? 1000 * 60 * 60 * 24 * 365 * 20
								: 0)
				  )
				: undefined,
			refreshTokenExpiresAt: match.refreshTokenExpiresAt
				? new Date(match.refreshTokenExpiresAt)
				: undefined,
		});
	}

	revokeToken(toRevokeToken: Token | RefreshToken) {
		logTag(
			'oauth',
			'cyan',
			`Revoking token for client "${toRevokeToken.client.id}" and user`,
			toRevokeToken.user
		);
		this.db.deleteArrayVal<DBToken>('tokens', (token) => {
			if (toRevokeToken.accessToken) {
				return token.accessToken === toRevokeToken.accessToken;
			} else {
				return token.refreshToken === toRevokeToken.refreshToken;
			}
		});
		return Promise.resolve(true);
	}

	async saveAuthorizationCode(
		code: Pick<
			AuthorizationCode,
			'authorizationCode' | 'expiresAt' | 'redirectUri' | 'scope'
		>,
		client: Client,
		user: User
	) {
		const dbAuthorizationCode: DBAuthorizationCode = {
			authorizationCode: code.authorizationCode,
			expiresAt: code.expiresAt,
			redirectUri: code.redirectUri,
			client,
			user,
		};
		logTag(
			'oauth',
			'cyan',
			`Saving authorization code for client "${client.id}" and user`,
			user
		);
		this.db.pushVal('authorizationCodes', dbAuthorizationCode);
		return Promise.resolve(dbAuthorizationCode);
	}

	async getAuthorizationCode(code: string) {
		const authorizationCodes = this.db.get<DBAuthorizationCode[]>(
			'authorizationCodes',
			[]
		);
		logTag('oauth', 'cyan', `Getting authorization code "${code}"`);
		return Promise.resolve(
			authorizationCodes.find(
				(authCode) => authCode.authorizationCode === code
			)
		);
	}

	async revokeAuthorizationCode(toRevoke: AuthorizationCode) {
		logTag(
			'oauth',
			'cyan',
			`Revoking authorization code for client "${toRevoke.client.id}" and user`,
			toRevoke.user
		);
		this.db.deleteArrayVal<DBAuthorizationCode>(
			'authorizationCodes',
			(authCode) =>
				authCode.authorizationCode === toRevoke.authorizationCode
		);
		return Promise.resolve(true);
	}

	verifyScope(token: Token, scope: string | string[]) {
		logTag(
			'oauth',
			'cyan',
			`Verifying scope for client "${token.client.id}" and user`,
			token.user
		);
		const requestedScopes = Array.isArray(scope) ? scope : [scope];
		const givenScopes = token.scope
			? Array.isArray(token.scope)
				? token.scope
				: [token.scope]
			: [];
		for (const requestedScope of requestedScopes) {
			if (!givenScopes.includes(requestedScope)) {
				return Promise.resolve(false);
			}
		}
		return Promise.resolve(true);
	}

	getRefreshToken(refreshToken: string): Promise<RefreshToken | Falsey> {
		const refreshTokens = this.db.get<DBToken[]>('tokens', []);
		const match = refreshTokens.find(
			(token) => token.refreshToken === refreshToken
		);
		if (!match) {
			return Promise.resolve(undefined);
		}
		return Promise.resolve({
			...match,
			refreshToken: match.refreshToken!,
			refreshTokenExpiresAt: new Date(match.refreshTokenExpiresAt!),
		});
	}
}

const db = new SettablePromise<Database>();
export const authorizationServer = new SettablePromise<OAuthServer>();

export function initAuthorization(_db: Database): void {
	db.set(_db);
	authorizationServer.set(
		new OAuthServer({
			model: new OAuthModel(_db),
			useErrorHandler: true,
		})
	);
}
