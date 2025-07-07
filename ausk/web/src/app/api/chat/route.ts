import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

// Request validation schemas
const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  threadId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get messages for default thread or all messages
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        content,
        user_id,
        thread_id,
        created_at,
        profiles:user_id (name, email)
      `)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    // Transform to match frontend interface
    const transformedMessages = messages?.map(msg => ({
      id: msg.id,
      content: msg.content,
      userId: msg.user_id,
      userName: (msg.profiles as any)?.name || (msg.profiles as any)?.email || 'Unknown User',
      createdAt: msg.created_at,
      threadId: msg.thread_id,
    })) || [];

    return NextResponse.json(transformedMessages);
  } catch (error) {
    console.error('Chat GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const validationResult = sendMessageSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { content, threadId } = validationResult.data;

    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get user's organization (assume first organization for now)
    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', session.user.id)
      .limit(1)
      .single();

    if (!userOrg) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    // Get or create default thread if none specified
    let finalThreadId = threadId;
    if (!threadId) {
      // Create a default thread for the organization if it doesn't exist
      const { data: existingThread } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('organization_id', userOrg.organization_id)
        .eq('name', 'General')
        .single();

      if (existingThread) {
        finalThreadId = existingThread.id;
      } else {
        const { data: newThread, error: threadError } = await supabase
          .from('chat_threads')
          .insert({
            organization_id: userOrg.organization_id,
            name: 'General',
            created_by: session.user.id,
            participants: [session.user.id],
          })
          .select('id')
          .single();

        if (threadError) {
          console.error('Error creating thread:', threadError);
          return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
        }
        finalThreadId = newThread.id;
      }
    }

    // Insert the message
    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({
        content,
        user_id: session.user.id,
        thread_id: finalThreadId,
      })
      .select(`
        id,
        content,
        user_id,
        thread_id,
        created_at,
        profiles:user_id (name, email)
      `)
      .single();

    if (error) {
      console.error('Error inserting message:', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    // Transform response to match frontend interface
    const transformedMessage = {
      id: message.id,
      content: message.content,
      userId: message.user_id,
      userName: (message.profiles as any)?.name || (message.profiles as any)?.email || 'Unknown User',
      createdAt: message.created_at,
      threadId: message.thread_id,
    };

    // TODO: Implement WebSocket broadcast for real-time updates
    // broadcastToThread(finalThreadId, 'chat:message', transformedMessage);

    return NextResponse.json(transformedMessage);
  } catch (error) {
    console.error('Chat POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}