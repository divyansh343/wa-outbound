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
    const campaignId = searchParams.get('campaignId');

    let metrics;
    if (campaignId) {
      metrics = await query(
        `SELECT 
          wa.name as wa_account_name,
          wa.phone_number,
          COUNT(l.id) as total_leads,
          COUNT(CASE WHEN l.status = 'contacted' THEN 1 END) as contacted,
          COUNT(CASE WHEN l.status = 'replied' THEN 1 END) as replied,
          COUNT(CASE WHEN l.status = 'failed' THEN 1 END) as failed
         FROM wa_accounts wa
         LEFT JOIN leads l ON l.assigned_wa_account_id = wa.id AND l.campaign_id = $1
         WHERE wa.org_id = $2
         GROUP BY wa.id`,
        [campaignId, session.user.orgId]
      );
    } else {
      metrics = await query(
        `SELECT 
          wa.name as wa_account_name,
          wa.phone_number,
          COUNT(l.id) as total_leads,
          COUNT(CASE WHEN l.status = 'contacted' THEN 1 END) as contacted,
          COUNT(CASE WHEN l.status = 'replied' THEN 1 END) as replied,
          COUNT(CASE WHEN l.status = 'failed' THEN 1 END) as failed
         FROM wa_accounts wa
         LEFT JOIN leads l ON l.assigned_wa_account_id = wa.id
         WHERE wa.org_id = $1
         GROUP BY wa.id`,
        [session.user.orgId]
      );
    }

    return NextResponse.json(metrics.rows);
  } catch (error) {
    console.error('Analytics performance endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
