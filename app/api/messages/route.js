import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    const res = await query(
      `SELECT m.*, wa.name as wa_account_name 
       FROM messages m 
       LEFT JOIN wa_accounts wa ON wa.id = m.wa_account_id
       WHERE m.lead_id = $1 
       ORDER BY m.sent_at ASC`,
      [leadId]
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId, waAccountId, content } = await req.json();

    if (!leadId || !waAccountId || !content) {
      return NextResponse.json(
        { error: 'leadId, waAccountId and content are required' },
        { status: 400 }
      );
    }

    const baileysManager = require('@/lib/baileys-manager');
    const socket = await baileysManager.getOrInitSocket(waAccountId, global.io);

    if (!socket) {
      return NextResponse.json(
        { error: 'WhatsApp account is not active/connected' },
        { status: 400 }
      );
    }

    // Fetch lead details
    const leadRes = await query('SELECT mobile FROM leads WHERE id = $1', [leadId]);
    if (leadRes.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    const lead = leadRes.rows[0];

    // Format phone
    let phone = lead.mobile.replace(/\D/g, '');
    if (phone.length === 10) {
      phone = '91' + phone;
    }
    const targetJid = `${phone}@s.whatsapp.net`;

    // Send WhatsApp message
    await socket.sendMessage(targetJid, { text: content });

    // Store in DB
    const messageRes = await query(
      `INSERT INTO messages (lead_id, wa_account_id, content, direction, status)
       VALUES ($1, $2, $3, 'outbound', 'sent')
       RETURNING *`,
      [leadId, waAccountId, content]
    );

    return NextResponse.json(messageRes.rows[0], { status: 201 });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
