import { NextRequest, NextResponse } from 'next/server';
import { getCoachMessages, deleteCoachMessages } from '@/lib/db';

// GET - Fetch coach messages for a client
export async function GET(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since') || undefined;

    const messages = await getCoachMessages(clientId, since);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Get coach messages error:', error);
    return NextResponse.json({ error: 'Failed to fetch coach messages' }, { status: 500 });
  }
}

// DELETE - Clear all coach messages for a client (when user clears chat)
export async function DELETE(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const result = await deleteCoachMessages(clientId);

    if (!result.success) {
      console.error('Delete coach messages error:', result.error);
      return NextResponse.json({ error: 'Failed to delete coach messages' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete coach messages error:', error);
    return NextResponse.json({ error: 'Failed to delete coach messages' }, { status: 500 });
  }
}
