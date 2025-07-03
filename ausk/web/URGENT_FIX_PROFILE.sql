-- URGENT: Run this immediately to stop the onboarding redirect
-- This sets your profile to completed onboarding

UPDATE public.profiles 
SET first_time = false 
WHERE id = '018df718-347f-4991-80c0-2f0121b3d717';

-- Verify the fix
SELECT 
  'Profile updated successfully! Onboarding redirect should stop.' as message,
  id,
  name,
  email,
  first_time,
  created_at
FROM public.profiles 
WHERE id = '018df718-347f-4991-80c0-2f0121b3d717';