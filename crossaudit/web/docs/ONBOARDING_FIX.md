# Onboarding Profile Creation Fix

## Problem Fixed
The onboarding flow was failing to create organizations due to a **critical schema mismatch**:

- **Database schema** used `owner_id` for organizations
- **TypeScript types** and **application code** used `created_by`
- This caused silent failures during organization creation

## Changes Made

### 1. Fixed OnboardingWizard Component
**File**: `/src/components/auth/OnboardingWizard.tsx`
- ✅ Changed `created_by: userId` → `owner_id: userId` 
- ✅ Added detailed error logging for each step
- ✅ Better error messages for users

### 2. Fixed TypeScript Types  
**File**: `/src/lib/supabase-client.ts`
- ✅ Updated organizations table types to use `owner_id` instead of `created_by`
- ✅ Added missing `updated_at` fields to match database schema

### 3. Enhanced Error Handling
- ✅ Added console logging for each onboarding step
- ✅ Specific error messages for organization creation failures
- ✅ Better user feedback with detailed error alerts

## Database Schema Required

Make sure your Supabase database has the correct schema. Run this SQL in your Supabase SQL Editor:

```sql
-- Ensure organizations table has correct structure
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure profiles table has correct structure
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  picture_url TEXT,
  first_time BOOLEAN DEFAULT true,
  mfa_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for organizations
CREATE POLICY "Authenticated users can create organizations" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Organization owners can update" ON public.organizations
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can view their organizations" ON public.organizations
  FOR SELECT USING (
    id IN (
      SELECT org_id FROM public.user_organizations 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for user_organizations
CREATE POLICY "Organization owners can manage memberships" ON public.user_organizations
  FOR ALL USING (
    org_id IN (
      SELECT id FROM public.organizations 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their org memberships" ON public.user_organizations
  FOR SELECT USING (user_id = auth.uid());
```

## Testing the Fix

1. **Try Google OAuth login**
2. **Complete onboarding wizard**:
   - Enter organization name
   - Select use cases  
   - Skip file upload (optional)
   - Skip team invites (optional)
   - Click "Complete Setup"
3. **Check console logs** for detailed progress
4. **Should redirect to /app** without errors

## Debugging

If onboarding still fails:

1. **Check browser console** for detailed error messages
2. **Check Supabase logs** in dashboard
3. **Verify RLS policies** are correctly applied
4. **Test database connection** with simple queries

The fix should resolve the "localhost failed to complete setup" error.