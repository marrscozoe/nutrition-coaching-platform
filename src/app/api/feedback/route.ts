import { NextRequest, NextResponse } from 'next/server';
import { db_all, db_get, db_run } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Nutrition App Telegram group chat ID
const NUTRITION_APP_GROUP_ID = '-5427254371';

// Build the bug report message text
function buildBugReportText(clientName: string, message: string, feedbackId: string, userType: 'client' | 'trainer'): string {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' });
  const title = userType === 'client' ? '🐛 *Bug Report (Client)*' : '🐛 *Bug Report (Trainer)*';
  return `${title}

*From:* ${clientName}
*Time:* ${timestamp}

*Problem:*
${message}

---
Feedback ID: \`${feedbackId}\``;
}

// Try sending via OpenClaw gateway first (for local dev / same-machine deployments)
async function sendViaGateway(messageText: string): Promise<boolean> {
  const gatewayToken = process.env.OPENCLAW_TOKEN;
  if (!gatewayToken) return false;

  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${gatewayUrl}/api/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        channel: 'telegram',
        target: NUTRITION_APP_GROUP_ID,
        message: messageText,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      console.log('[Feedback] Gateway send OK');
      return true;
    } else {
      const body = await res.text();
      console.error(`[Feedback] Gateway error ${res.status}: ${body}`);
      return false;
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.error('[Feedback] Gateway timeout (unreachable)');
    } else {
      console.error('[Feedback] Gateway error:', e.message);
    }
    return false;
  }
}

// Fall back to Telegram Bot API
async function sendViaBotApi(messageText: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  console.log('[Feedback] Bot API - token present:', !!botToken, 'length:', botToken ? botToken.length : 0);
  if (!botToken) {
    console.error('[Feedback] TELEGRAM_BOT_TOKEN not set — cannot send via Bot API');
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: NUTRITION_APP_GROUP_ID,
      text: messageText,
      parse_mode: 'Markdown',
    }),
  });

  const result = await res.json();
  if (!result.ok) {
    console.error('[Feedback] Telegram Bot API error:', result.description);
  } else {
    console.log('[Feedback] Bot API send OK, msg_id:', result.result?.message_id);
  }
}

// Main send function: gateway first, then Bot API
async function sendFeedbackNotification(clientName: string, message: string, feedbackId: string, userType: 'client' | 'trainer') {
  const messageText = buildBugReportText(clientName, message, feedbackId, userType);

  const ok = await sendViaGateway(messageText);
  if (!ok) {
    await sendViaBotApi(messageText);
  }
}

// POST - Submit feedback/bug report
export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    const trainerId = request.headers.get('x-trainer-id');

    if (!clientId && !trainerId) {
      return NextResponse.json({ error: 'Client ID or Trainer ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { message } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const feedbackId = uuidv4();
    const now = new Date().toISOString();
    let senderName = 'Unknown';

    const userType: 'client' | 'trainer' = clientId ? 'client' : 'trainer';

    if (clientId) {
      // Client submitting feedback
      const client = await db_get('SELECT trainer_id, name FROM clients WHERE id = ?', clientId) as any;
      senderName = client?.name || 'Unknown Client';

      await db_run(
        `INSERT INTO feedback (id, client_id, trainer_id, message, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
        feedbackId, clientId, client?.trainer_id || null, message.trim(), now
      );
    } else {
      // Trainer submitting feedback
      const trainer = await db_get('SELECT name FROM trainers WHERE id = ?', trainerId) as any;
      senderName = trainer?.name || 'Unknown Trainer';

      await db_run(
        `INSERT INTO feedback (id, client_id, trainer_id, message, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
        feedbackId, null, trainerId, message.trim(), now
      );
    }

    // Send Telegram notification to Nutrition App group
    try {
      await sendFeedbackNotification(senderName, message.trim(), feedbackId, userType);
    } catch (e) {
      console.error('[Feedback] Notification error:', e);
    }

    return NextResponse.json({
      success: true,
      feedbackId,
      message: 'Feedback submitted. Thank you!',
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}

// GET - Get feedback for a trainer
export async function GET(request: NextRequest) {
  try {
    const trainerId = request.headers.get('x-trainer-id');
    if (!trainerId) {
      return NextResponse.json({ error: 'Trainer ID required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    // Fetch bug reports from feedback table
    const feedback = await db_all(
      `SELECT f.*, c.name as client_name
       FROM feedback f
       JOIN clients c ON f.client_id = c.id
       WHERE f.trainer_id = ? AND f.status = ?
       ORDER BY f.created_at DESC`,
      trainerId, status
    );

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('Get feedback error:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}
