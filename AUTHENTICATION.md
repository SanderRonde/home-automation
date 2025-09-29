# Authentication System

This project now includes a comprehensive username/password authentication system.

## Features

- **Username & Password Authentication**: Secure login with SHA-256 password hashing
- **Session Management**: 30-day session cookies with automatic cleanup
- **User Management**: Command-line script for managing users
- **Protected Endpoints**: All non-static API endpoints require authentication (except info-screen)
- **Login UI**: Modern, responsive login page using Material-UI
- **Backwards Compatible**: Old key-based authentication still works

## User Management

### Create a new user

```bash
bun scripts/manage-users.ts create <username>
```

You'll be prompted to enter and confirm the password.

### List all users

```bash
bun scripts/manage-users.ts list
```

### Delete a user

```bash
bun scripts/manage-users.ts delete <username>
```

### Change a user's password

```bash
bun scripts/manage-users.ts change-password <username>
```

## API Endpoints

### Login

```
POST /auth/login
Content-Type: application/json

{
  "username": "your-username",
  "password": "your-password"
}
```

Returns:
```json
{
  "success": true,
  "username": "your-username"
}
```

### Logout

```
POST /auth/logout
```

### Get current user info

```
GET /auth/me
```

Returns:
```json
{
  "username": "your-username",
  "id": 1
}
```

## Client-Side Authentication

Use the provided authentication utilities:

```typescript
import { checkAuth, logout } from '../lib/auth';

// Check if user is authenticated
const user = await checkAuth();
if (user) {
  console.log(`Logged in as ${user.username}`);
} else {
  // Not authenticated
}

// Logout
await logout();
```

## Protected Routes

All module endpoints are now protected by default, except:
- `/auth/*` - Authentication endpoints
- `/info-screen/*` - Info screen (runs on separate port)
- Static files

When an unauthenticated user tries to access a protected page, they'll be redirected to the login page. API requests will receive a 401 Unauthorized response.

## Database

User data is stored in `database/auth.db` (SQLite):
- `users` table: id, username, password_hash, created_at
- `sessions` table: id, user_id, created_at, expires_at

Sessions expire after 30 days and are automatically cleaned up when validated.

## Security Notes

- Passwords are hashed using SHA-256
- Session IDs are generated using `crypto.randomUUID()`
- Sessions are stored server-side with expiration
- Login page includes redirect parameter to return to original destination
- Old key-based authentication is still supported for backwards compatibility
