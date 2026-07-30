import { NextRequest, NextResponse } from 'next/server';
import { db_get, db_run, db_all } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Send to Allen's Telegram DM for immediate attention
const ALLEN_TELEGRAM_ID = '7954801708';

// Send Telegram notification for new feedback using Bot API
async function sendFeedbackNotification(clientName: string, message: string, feedbackId: string) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('Telegram bot token not found in environment');
      return;
    }

    const text = `🐛 *New Bug Report*\n\n*Client:* ${clientName}\n*Problem:* ${message}\n\nFeedback ID: \`${feedbackId}\`\n\n@Zoe`;
    
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ALLEN_TELEGRAM_ID,
        text: text,
        parse_mode: 'Markdown'
      })
    });
    
    const result = await response.json();
    console.log('Telegram API response:', result);
  } catch (e) {
    console.error('Failed to send Telegram notification:', e);
  }
}

// POST - Submit feedback/bug report
export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get('x-client-id');
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 401 });
    }

    const body = await request.json();
    const { message } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const feedbackId = uuidv4();
    const now = new Date().toISOString();

    // Get client's trainer_id and name
    const client = await db_get('SELECT trainer_id, name FROM clients WHERE id = ?', clientId) as any;

    await db_run(
      `INSERT INTO feedback (id, client_id, trainer_id, message, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      feedbackId, clientId, client?.trainer_id || null, message.trim(), now
    );

    // Send Telegram notification to Nutrition App group
    const clientName = client?.name || 'Unknown Client';
    sendFeedbackNotification(clientName, message.trim(), feedbackId).catch(console.error);

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
