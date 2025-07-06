# OAuth Authentication Flow Debug Guide

## Issues Fixed:

### 1. **Middleware Issues Fixed:**
- ✅ Added `/dashboard` to protected routes
- ✅ Fixed redirect from auth routes to `/dashboard` instead of non-existent `/app`
- ✅ Added bypass for `/auth/callback` to prevent redirect loops
- ✅ Added logic to redirect authenticated users from landing page

### 2. **Auth Callback Issues Fixed:**
- ✅ Simplified organization checking logic (commented out until `user_organizations` table exists)
- ✅ Now uses `first_time` flag to determine if user needs onboarding
- ✅ Fixed redirect URL validation

### 3. **Onboarding Page Issues Fixed:**
- ✅ Better handling of OAuth flows vs direct access
- ✅ More lenient authentication checking

## Expected Flow:

### First-Time OAuth Signup:
1. User clicks "Sign in with Google" → `/auth/callback?code=...`
2. Auth callback creates profile with `first_time: true`
3. Auth callback redirects to `/onboarding`
4. Middleware allows access to `/onboarding` for authenticated users
5. User completes onboarding, `first_time` set to `false`
6. User redirected to `/dashboard`

### Subsequent OAuth Login:
1. User clicks "Sign in with Google" → `/auth/callback?code=...`
2. Auth callback finds existing profile with `first_time: false`
3. Auth callback redirects to `/dashboard`
4. Middleware allows access to `/dashboard`

## Debugging Steps:

### 1. Check Browser Network Tab:
- Look for any 302 redirects in the OAuth flow
- Check if `/auth/callback` is being called
- Verify cookies are being set properly

### 2. Check Console Logs:
Look for these specific log messages:
```
"OAuth login successful for user: [user-id]"
"New user (first_time=true) - redirecting to onboarding"
"Existing user (first_time=false) - allowing dashboard access"
"OAuth callback complete - redirecting to: [url]"
```

### 3. Check Database:
```sql
-- Check if profile was created
SELECT * FROM profiles WHERE email = 'your-google-email@gmail.com';

-- Check first_time flag
SELECT id, email, first_time FROM profiles WHERE email = 'your-google-email@gmail.com';
```

### 4. Common Issues:
- **Profile not created**: Check Supabase RLS policies
- **Stuck in redirect loop**: Check middleware logs
- **Session not persisting**: Check cookie settings in production

## Manual Testing:

1. **Clear all browser data** (cookies, localStorage, etc.)
2. **Open incognito/private window**
3. **Go to the landing page**
4. **Click "Sign in with Google"**
5. **Watch network tab and console**

## If Still Having Issues:

1. Check if profile was created in Supabase dashboard
2. Check if `first_time` flag is set correctly
3. Verify middleware is not intercepting requests
4. Check if there are any errors in the auth callback