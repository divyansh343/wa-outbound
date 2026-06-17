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

    // Fetch all leads in the organization along with their latest message log details
    const res = await query(
      `SELECT 
        l.*,
        m.content AS last_message_content,
        m.direction AS last_message_direction,
        m.sent_at AS last_message_sent_at,
        m.status AS last_message_status,
        wa.name AS assigned_wa_account_name,
        wa.phone_number AS assigned_wa_account_phone
      FROM leads l
      LEFT JOIN LATERAL (
        SELECT content, direction, sent_at, status 
        FROM messages 
        WHERE lead_id = l.id 
        ORDER BY sent_at DESC 
        LIMIT 1
      ) m ON true
      LEFT JOIN wa_accounts wa ON wa.id = l.assigned_wa_account_id
      WHERE l.org_id = $1
      ORDER BY COALESCE(m.sent_at, l.created_at) DESC`,
      [session.user.orgId]
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Fetch chats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
