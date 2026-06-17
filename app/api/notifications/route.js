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
    const limit = parseInt(searchParams.get('limit') || '10');

    const res = await query(
      `SELECT * FROM activity_notifications 
       WHERE org_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [session.user.orgId, limit]
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await req.json();

    if (id) {
      await query(
        'UPDATE activity_notifications SET is_read = TRUE WHERE id = $1 AND org_id = $2',
        [id, session.user.orgId]
      );
    } else {
      await query('UPDATE activity_notifications SET is_read = TRUE WHERE org_id = $1', [
        session.user.orgId,
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
