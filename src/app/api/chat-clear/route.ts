import { NextRequest, NextResponse } from 'next/server';
import { setChatClearedAt, getChatClearedAt } from '@/lib/db';

// GET - Get chat_cleared_at flag for a client
export async function GET(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const clearedAt = await getChatClearedAt(clientId);

    return NextResponse.json({ clearedAt });
  } catch (error) {
    console.error('Get chat cleared error:', error);
    return NextResponse.json({ error: 'Failed to get chat cleared flag' }, { status: 500 });
  }
}

// POST - Mark chat as cleared for a client (sets chat_cleared_at flag in DB)
export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    await setChatClearedAt(clientId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Set chat cleared error:', error);
    return NextResponse.json({ error: 'Failed to mark chat as cleared' }, { status: 500 });
  }
}
