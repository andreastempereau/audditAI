# Vercel Environment Variables Setup

You need to configure these environment variables in your Vercel project for the app to work properly.

## Steps to Configure:

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project (www.ausk.ai)
3. Go to "Settings" → "Environment Variables"
4. Add these variables:

## Required Environment Variables:

```bash
# Supabase (from your .env.local)
NEXT_PUBLIC_SUPABASE_URL=https://xziqnrsppwqtxmxpswhi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6aXFucnNwcHdxdHhteHBzd2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMTAwODUsImV4cCI6MjA2NjU4NjA4NX0.1Z95sBRB9NtagTm5n8TbckqEDoYyEKeeoV_FrJHhgW4

# Email Service (Optional - for invitations)
RESEND_API_KEY=re_BR9ueCX3_8QJH6znpmdxKu3WMogRH1d6S
```

## Additional Optional Variables:

```bash
# For production monitoring (optional)
NEXT_PUBLIC_VERCEL_URL=$VERCEL_URL

# Node environment
NODE_ENV=production
```

## After Adding Variables:

1. Click "Save" for each variable
2. Go to "Deployments" tab
3. Click on the three dots next to your latest deployment
4. Select "Redeploy"
5. Wait for deployment to complete

## Database Setup:

Don't forget to run the SQL fix in your Supabase dashboard:
1. Go to https://app.supabase.com/project/xziqnrsppwqtxmxpswhi/sql
2. Run the contents of `FINAL_DATABASE_FIX.sql`

Your app should now be live at https://www.ausk.ai!