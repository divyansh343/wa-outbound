import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { disconnectWhatsApp } from '@/lib/baileys-manager';

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = params;

    // 1. Verify ownership and existence
    const accountCheck = await query('SELECT id FROM wa_accounts WHERE id = $1 AND org_id = $2', [
      id,
      session.user.orgId,
    ]);

    if (accountCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'WhatsApp account not found or unauthorized' },
        { status: 404 }
      );
    }

    // 2. Disconnect active socket session
    await disconnectWhatsApp(id);

    // 3. Delete from DB (ON DELETE CASCADE handles session and campaign mappings)
    const deleteRes = await query(
      'DELETE FROM wa_accounts WHERE id = $1 AND org_id = $2 RETURNING *',
      [id, session.user.orgId]
    );

    return NextResponse.json({
      success: true,
      message: 'WhatsApp account deleted successfully',
      deletedAccount: deleteRes.rows[0],
    });
  } catch (error) {
    console.error('Delete WA Account error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
