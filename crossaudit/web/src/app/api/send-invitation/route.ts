import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend only if API key is provided
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, organizationName, inviterName, inviteLink } = body;

    if (!email || !organizationName || !inviterName || !inviteLink) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if email service is configured
    if (!resend) {
      return NextResponse.json(
        { error: 'Email service not configured. Please add RESEND_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'CrossAudit <noreply@crossaudit.com>', // Replace with your domain
      to: [email],
      subject: `${inviterName} invited you to join ${organizationName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Organization Invitation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <p style="font-size: 18px; margin-bottom: 20px;">
              <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on CrossAudit.
            </p>
            
            <p style="margin-bottom: 30px;">
              CrossAudit is a next-generation platform that helps organizations maintain compliance, 
              perform security reviews, and streamline their audit processes with AI-powered insights.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" 
                 style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; 
                        border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${inviteLink}" style="color: #667eea; word-break: break-all;">${inviteLink}</a>
            </p>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              This invitation will expire in 7 days. If you don't want to join ${organizationName}, 
              you can safely ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              © 2024 CrossAudit. All rights reserved.<br>
              This email was sent because ${inviterName} invited you to join their organization.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
${inviterName} has invited you to join ${organizationName} on CrossAudit.

CrossAudit is a next-generation audit platform that helps organizations maintain compliance, perform security reviews, and streamline their audit processes with AI-powered insights.

To accept this invitation, visit: ${inviteLink}

This invitation will expire in 7 days. If you don't want to join ${organizationName}, you can safely ignore this email.

---
© 2024 CrossAudit. All rights reserved.
      `.trim(),
    });

    if (error) {
      console.error('Error sending email:', error);
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, messageId: data?.id });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}