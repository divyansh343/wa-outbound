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

    const orgId = session.user.orgId;

    // Fetch stats
    const statsRes = await query(
      `SELECT 
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_leads,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted_leads,
        COUNT(CASE WHEN status = 'replied' THEN 1 END) as replied_leads,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_leads,
        COUNT(*) as total_leads
       FROM leads 
       WHERE org_id = $1`,
      [orgId]
    );

    const waAccountsRes = await query(
      'SELECT id, name, phone_number, status, daily_limit FROM wa_accounts WHERE org_id = $1',
      [orgId]
    );

    const campaignsRes = await query(
      'SELECT id, name, status, schedule_time FROM campaigns WHERE org_id = $1',
      [orgId]
    );

    const poolsRes = await query(
      `SELECT lp.id, lp.name, COUNT(CASE WHEN l.status = 'new' THEN 1 END)::int as new_leads 
       FROM lead_pools lp
       LEFT JOIN leads l ON l.pool_id = lp.id
       WHERE lp.org_id = $1
       GROUP BY lp.id`,
      [orgId]
    );

    const recentNotifications = await query(
      `SELECT id, type, message, created_at 
       FROM activity_notifications 
       WHERE org_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [orgId]
    );

    return NextResponse.json({
      stats: statsRes.rows[0],
      waAccounts: waAccountsRes.rows,
      campaigns: campaignsRes.rows,
      pools: poolsRes.rows,
      notifications: recentNotifications.rows,
    });
  } catch (error) {
    console.error('Dashboard fetching error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
