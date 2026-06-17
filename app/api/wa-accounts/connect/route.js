import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { connectWhatsApp } from '@/lib/baileys-manager';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { waAccountId } = await req.json();
    if (!waAccountId) {
      return NextResponse.json({ error: 'WA Account ID is required' }, { status: 400 });
    }

    console.log('POST /api/wa-accounts/connect - ID:', waAccountId);
    console.log('global.io exists:', !!global.io);

    // Verify account ownership
    const accountCheck = await query('SELECT id FROM wa_accounts WHERE id = $1 AND org_id = $2', [
      waAccountId,
      session.user.orgId,
    ]);

    if (accountCheck.rows.length === 0) {
      console.log('WA Account not found or unauthorized:', waAccountId);
      return NextResponse.json({ error: 'WhatsApp account not found' }, { status: 404 });
    }

    console.log('Purging existing session data to force clean pairing QR code for:', waAccountId);
    await query('DELETE FROM wa_sessions WHERE wa_account_id = $1', [waAccountId]);

    console.log('Triggering connectWhatsApp for:', waAccountId);
    // Trigger Connection using custom server IO
    await connectWhatsApp(waAccountId, global.io);

    console.log('connectWhatsApp execution triggered successfully for:', waAccountId);
    return NextResponse.json({ success: true, message: 'Connection initialization triggered' });
  } catch (error) {
    console.error('Trigger WA Connect error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
