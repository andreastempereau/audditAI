import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
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

    const { threadId } = params;

    // Verify thread access (user is a participant in the thread)
    const { data: thread } = await supabase
      .from('chat_threads')
      .select('id, organization_id')
      .eq('id', threadId)
      .contains('participants', [session.user.id])
      .single();

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Get messages for this specific thread
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
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching thread messages:', error);
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
    console.error('Thread messages GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}