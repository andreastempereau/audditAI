import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Get threads for the organization where user is a participant
    const { data: threads, error } = await supabase
      .from('chat_threads')
      .select(`
        id,
        name,
        updated_at,
        chat_messages (
          id,
          content,
          created_at,
          profiles:user_id (name, email)
        )
      `)
      .eq('organization_id', userOrg.organization_id)
      .contains('participants', [session.user.id])
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching threads:', error);
      return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 });
    }

    // Transform to match frontend interface
    const transformedThreads = threads?.map(thread => {
      // Get the latest message
      const messages = thread.chat_messages || [];
      const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;

      return {
        id: thread.id,
        name: thread.name,
        updatedAt: thread.updated_at,
        lastMessage: latestMessage ? {
          id: latestMessage.id,
          content: latestMessage.content,
          userId: '',
          userName: (latestMessage.profiles as any)?.name || (latestMessage.profiles as any)?.email || 'Unknown User',
          createdAt: latestMessage.created_at,
        } : undefined,
      };
    }) || [];

    return NextResponse.json(transformedThreads);
  } catch (error) {
    console.error('Threads GET error:', error);
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

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Thread name is required' }, { status: 400 });
    }

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

    // Create new thread
    const { data: thread, error } = await supabase
      .from('chat_threads')
      .insert({
        name,
        organization_id: userOrg.organization_id,
        created_by: session.user.id,
        participants: [session.user.id],
      })
      .select('id, name, updated_at')
      .single();

    if (error) {
      console.error('Error creating thread:', error);
      return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
    }

    return NextResponse.json({
      id: thread.id,
      name: thread.name,
      updatedAt: thread.updated_at,
    });
  } catch (error) {
    console.error('Threads POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}