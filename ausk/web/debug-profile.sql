-- Debug: Check if profile exists and what's in the tables

-- 1. Check if the user exists in auth.users
SELECT id, email, created_at, raw_user_meta_data
FROM auth.users
WHERE id = '018df718-347f-4991-80c0-2f0121b3d717';

-- 2. Check if profile exists
SELECT * FROM public.profiles
WHERE id = '018df718-347f-4991-80c0-2f0121b3d717';

-- 3. Check all profiles (to see if any exist)
SELECT * FROM public.profiles;

-- 4. Check if trigger exists
SELECT tgname, tgtype, proname
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- 5. Check if function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 6. Manually create the profile if it doesn't exist
INSERT INTO public.profiles (id, name, email, picture_url, first_time, mfa_enabled)
VALUES (
  '018df718-347f-4991-80c0-2f0121b3d717',
  'Andreas',
  'andreastempereau@gmail.com',
  'https://lh3.googleusercontent.com/a/ACg8ocL5dXWck6tenZIyZ5_lkfQdMYv9tzJ-SFoLOy4UQviP92Ia13tf=s96-c',
  true,
  false
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  picture_url = EXCLUDED.picture_url
RETURNING *;

-- 7. Verify the profile was created
SELECT * FROM public.profiles
WHERE id = '018df718-347f-4991-80c0-2f0121b3d717';