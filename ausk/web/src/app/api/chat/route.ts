import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

// Request validation schemas
const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  threadId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Read-only in GET requests
          },
        },
      }
    );
    
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
        profiles!user_id (name, email)
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
    const response = NextResponse.next();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set({ name, value, ...options });
            });
          },
        },
      }
    );
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const validatedData = sendMessageSchema.parse(body);

    // Get user's organization
    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', session.user.id)
      .limit(1)
      .single();

    if (!userOrg) {
      return NextResponse.json({ error: 'No organization found' }, { status: 403 });
    }

    let threadId = validatedData.threadId;

    // If no thread specified, create a default thread
    if (!threadId) {
      const { data: existingThread } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('organization_id', userOrg.organization_id)
        .eq('name', 'General')
        .limit(1)
        .single();

      if (existingThread) {
        threadId = existingThread.id;
      } else {
        // Create a default thread
        const { data: newThread, error: threadError } = await supabase
          .from('chat_threads')
          .insert({
            name: 'General',
            organization_id: userOrg.organization_id,
            created_by: session.user.id,
            participants: [session.user.id],
          })
          .select('id')
          .single();

        if (threadError) {
          console.error('Error creating default thread:', threadError);
          return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
        }

        threadId = newThread.id;
      }
    }

    // Verify user has access to the thread
    const { data: thread } = await supabase
      .from('chat_threads')
      .select('participants')
      .eq('id', threadId)
      .eq('organization_id', userOrg.organization_id)
      .single();

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Add user to participants if not already there
    if (!thread.participants.includes(session.user.id)) {
      await supabase
        .from('chat_threads')
        .update({ 
          participants: [...thread.participants, session.user.id],
          updated_at: new Date().toISOString(),
        })
        .eq('id', threadId);
    }

    // Insert the message
    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({
        content: validatedData.content,
        user_id: session.user.id,
        thread_id: threadId,
        organization_id: userOrg.organization_id,
      })
      .select(`
        id,
        content,
        user_id,
        thread_id,
        created_at,
        profiles!user_id (name, email)
      `)
      .single();

    if (error) {
      console.error('Error creating message:', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    // Update thread's updated_at
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);

    // Transform to match frontend interface
    const transformedMessage = {
      id: message.id,
      content: message.content,
      userId: message.user_id,
      userName: (message.profiles as any)?.name || (message.profiles as any)?.email || 'Unknown User',
      createdAt: message.created_at,
      threadId: message.thread_id,
    };

    return NextResponse.json(transformedMessage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    console.error('Chat POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}