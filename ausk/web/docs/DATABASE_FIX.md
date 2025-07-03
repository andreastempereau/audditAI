# Database Fix for OAuth Authentication Issues

## Problem
After Google OAuth authentication, users get stuck in a loading state on the onboarding page due to profile creation conflicts.

## Root Cause
- Multiple systems trying to create user profiles simultaneously:
  1. Database trigger (should be the primary method)  
  2. OAuth callback handler (redundant)
  3. Client-side auth provider (redundant)

## Solution Applied

### 1. Fixed Profile Creation Logic
- Removed redundant profile creation from OAuth callback
- Removed redundant profile creation from client auth provider  
- Added retry logic to wait for database trigger to complete
- Improved error handling and timeout management

### 2. Apply Fixed Database Schema
To fix the database trigger, run this SQL in your Supabase SQL Editor:

```sql
-- Fixed Database Schema for OAuth Users
-- Run this in your Supabase SQL editor to fix the OAuth issue

-- First, drop the existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create a more robust function to handle new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles with better error handling
  INSERT INTO public.profiles (id, name, email, picture_url, first_time, mfa_enabled)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name', 
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'picture',
      NEW.raw_user_meta_data->>'avatar_url'
    ),
    true,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'display_name',
      profiles.name
    ),
    email = COALESCE(NEW.email, profiles.email),
    picture_url = COALESCE(
      NEW.raw_user_meta_data->>'picture',
      NEW.raw_user_meta_data->>'avatar_url',
      profiles.picture_url
    );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 3. Files Modified
- `/src/app/auth/callback/route.ts` - Removed redundant profile creation
- `/src/lib/auth-supabase.tsx` - Added retry logic instead of profile creation
- `/src/app/onboarding/page.tsx` - Improved error handling and timeout management

## Testing
1. Try Google OAuth login
2. Should redirect to onboarding without loading issues
3. Complete onboarding should work properly
4. Subsequent logins should go directly to app

## If Issues Persist
1. Check Supabase logs for trigger errors
2. Verify the trigger was created successfully
3. Test with a fresh user account
4. Check browser console for detailed error messages