import { apiPost, apiGet } from './fetch';

export interface UserInfo {
	username: string;
	id: number;
}

export async function checkAuth(): Promise<UserInfo | null> {
	try {
		const response = await apiGet('auth', '/me', {});
		if (response.ok) {
			return (await response.json()) as UserInfo;
		}
		return null;
	} catch {
		return null;
	}
}

export async function logout(): Promise<void> {
	try {
		await apiPost('auth', '/logout', {});
		window.location.href = '/auth/login-page';
	} catch (error) {
		console.error('Logout failed:', error);
	}
}
