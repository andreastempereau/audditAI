# Vercel Deployment Guide for www.ausk.ai

Since your Next.js app is in a subdirectory (`crossaudit/web`), you need to configure this in the Vercel dashboard.

## Steps to Fix the Deployment:

### 1. Configure Root Directory in Vercel Dashboard

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Click on your project (www.ausk.ai)
3. Go to **Settings** → **General**
4. Find the **Root Directory** setting
5. Change it from `/` to `crossaudit/web`
6. Click **Save**

### 2. Trigger a New Deployment

After saving the root directory:
1. Go to the **Deployments** tab
2. Click on the three dots next to your latest deployment
3. Select **Redeploy**
4. Choose **Use existing Build Cache** (unchecked)
5. Click **Redeploy**

### 3. Set Environment Variables

While in Settings, also go to **Environment Variables** and add:

```
NEXT_PUBLIC_SUPABASE_URL=https://xziqnrsppwqtxmxpswhi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6aXFucnNwcHdxdHhteHBzd2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMTAwODUsImV4cCI6MjA2NjU4NjA4NX0.1Z95sBRB9NtagTm5n8TbckqEDoYyEKeeoV_FrJHhgW4
RESEND_API_KEY=re_BR9ueCX3_8QJH6znpmdxKu3WMogRH1d6S
```

### 4. Apply Database Fix

Run the SQL in `FINAL_DATABASE_FIX.sql` in your Supabase SQL Editor:
https://app.supabase.com/project/xziqnrsppwqtxmxpswhi/sql

## Expected Build Output

After configuring the root directory, you should see:
- Dependencies installing from `crossaudit/web/package.json`
- Next.js build process running
- Pages being compiled
- Build completing successfully

## Alternative: Using vercel.json (if dashboard doesn't work)

If the dashboard approach doesn't work, we can try creating a minimal vercel.json in the web directory:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json"
}
```

And set the project root in Vercel CLI when linking.