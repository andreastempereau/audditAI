# Email Service Setup for Team Invitations

## 🚀 **Quick Setup with Resend**

Your CrossAudit app now sends beautiful invitation emails automatically! Here's how to set it up:

### **Step 1: Create Resend Account**

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

### **Step 2: Get API Key**

1. Go to your Resend dashboard
2. Click **"API Keys"** in the sidebar
3. Click **"Create API Key"**
4. Name it: `CrossAudit Invitations`
5. Copy the API key (starts with `re_`)

### **Step 3: Add to Environment Variables**

Update your `.env.local` file:

```env
RESEND_API_KEY=re_your_actual_api_key_here
```

### **Step 4: Configure Domain (Optional)**

For production, you'll want to use your own domain:

1. In Resend dashboard, go to **"Domains"**
2. Add your domain (e.g., `crossaudit.com`)
3. Follow DNS setup instructions
4. Update the `from` field in `/src/app/api/send-invitation/route.ts`:

```typescript
from: 'CrossAudit <noreply@yourdomain.com>'
```

## 📧 **What Happens When You Invite Team Members:**

1. **User adds emails** in onboarding step 4
2. **System creates invitation records** in database
3. **Beautiful HTML emails are sent** to each team member with:
   - Personal invitation from the user
   - Organization name and details
   - Branded email template
   - Direct link to accept invitation
   - 7-day expiration notice

4. **Team members receive email** like this:

```
Subject: John Doe invited you to join Acme Corp

Hey there!

John Doe has invited you to join Acme Corp on CrossAudit.

CrossAudit is a next-generation audit platform that helps 
organizations maintain compliance and perform security reviews.

[Accept Invitation Button]

This invitation expires in 7 days.
```

## 🎯 **Free Tier Limits**

Resend free tier includes:
- **3,000 emails/month**
- **100 emails/day**
- Perfect for team invitations!

## 🔧 **Alternative Email Services**

If you prefer other services, you can easily swap out Resend for:

- **SendGrid**
- **Nodemailer + SMTP**
- **Amazon SES**
- **Postmark**

Just update `/src/app/api/send-invitation/route.ts` with your preferred service.

## ✅ **Test Your Setup**

1. Complete the onboarding flow
2. Add your own email as a team member
3. Check if you receive the invitation email
4. Click the link to test the acceptance flow

Your team invitation system is now production-ready! 🎉