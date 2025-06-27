# Supabase Authentication Setup

## 🚀 Quick Start

Your CrossAudit authentication system is now fully integrated with Supabase! Follow these steps to get it running:

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create account
2. Create new project (choose a region close to your users)
3. Save your project URL and anon key from Settings > API

## 2. Configure OAuth Providers

### Google OAuth Setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
6. Copy Client ID and Client Secret

### Microsoft OAuth Setup:
1. Go to [Azure Portal](https://portal.azure.com)
2. Register new application in Azure AD
3. Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Create client secret
5. Copy Application ID and secret

## 3. Configure Supabase

In your Supabase dashboard:

1. Go to Authentication > Settings
2. Enable Google provider:
   - Client ID: `your-google-client-id`
   - Client Secret: `your-google-client-secret`
3. Enable Microsoft provider:
   - Client ID: `your-microsoft-client-id`
   - Client Secret: `your-microsoft-client-secret`

## 4. Environment Variables

Update `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_from_supabase_dashboard
```

## 5. Database Schema

Run the provided SQL schema to set up your database:

```sql
-- Custom user profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text,
  picture_url text,
  first_time boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Organizations table
create table public.organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  tier text default 'free',
  owner_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User-Organization relationships
create table public.user_organizations (
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  role text default 'member',
  primary key (user_id, org_id)
);

-- Row Level Security
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table user_organizations enable row level security;

-- Policies
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);
```

## 6. Run the Database Schema

1. Copy the SQL from `supabase/schema.sql`
2. Go to your Supabase dashboard > SQL Editor
3. Paste and run the schema to create tables and security policies

## 7. Start Your Application

```bash
npm run dev
```

Your authentication system is now fully functional with:

✅ **Email/Password authentication**  
✅ **Google & Microsoft OAuth**  
✅ **Email verification**  
✅ **Password reset**  
✅ **User onboarding flow**  
✅ **Organization management**  
✅ **Route protection**  
✅ **Session management**  

## 🎯 What's Included

- **Complete auth UI**: Login, register, forgot password, verification pages
- **Onboarding wizard**: Multi-step setup for new users
- **Organization system**: Users can create and manage organizations
- **Security**: Row Level Security, audit logging, CSRF protection
- **Production ready**: Error handling, loading states, TypeScript support

## 🔧 Need Help?

If you encounter issues:
1. Check your environment variables in `.env.local`
2. Verify your Supabase project is active
3. Ensure OAuth providers are configured correctly
4. Check the browser console for detailed error messages