import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { outreachQueue } from '@/lib/queue';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { leadCount, poolId } = await req.json();

    if (!leadCount || parseInt(leadCount, 10) <= 0) {
      return NextResponse.json({ error: 'Valid lead count is required' }, { status: 400 });
    }

    const count = parseInt(leadCount, 10);

    // 1. Verify campaign ownership
    const campaignRes = await query('SELECT * FROM campaigns WHERE id = $1 AND org_id = $2', [
      id,
      session.user.orgId,
    ]);

    if (campaignRes.rows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaignRes.rows[0];

    // 2. Fetch mapped WhatsApp accounts that are connected
    const waAccountsRes = await query(
      `SELECT wa.id FROM wa_accounts wa
       JOIN campaign_wa_accounts cwa ON cwa.wa_account_id = wa.id
       WHERE cwa.campaign_id = $1 AND wa.status = 'connected'`,
      [id]
    );

    if (waAccountsRes.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            'No connected WhatsApp accounts are assigned to this campaign. Please connect a WhatsApp node first.',
        },
        { status: 400 }
      );
    }

    const waAccountIds = waAccountsRes.rows.map((row) => row.id);

    // 3. Select up to X leads in the pool of the org that are status = 'new'
    let leadsRes;
    if (poolId) {
      leadsRes = await query(
        `SELECT * FROM leads 
         WHERE org_id = $1 AND pool_id = $2 AND status = 'new' 
         ORDER BY created_at ASC 
         LIMIT $3`,
        [session.user.orgId, poolId, count]
      );
    } else {
      leadsRes = await query(
        `SELECT * FROM leads 
         WHERE org_id = $1 AND status = 'new' 
         ORDER BY created_at ASC 
         LIMIT $2`,
        [session.user.orgId, count]
      );
    }
    const leads = leadsRes.rows;

    if (leads.length === 0) {
      return NextResponse.json(
        { error: 'No available leads with status "new" found in the pool' },
        { status: 400 }
      );
    }

    // 4. Distribute leads across the mapped WhatsApp accounts round-robin and queue in Bull
    let accountIndex = 0;
    for (const lead of leads) {
      const waAccountId = waAccountIds[accountIndex];

      // Update lead status to queued and link campaign/account
      await query(
        'UPDATE leads SET campaign_id = $1, assigned_wa_account_id = $2, status = $3 WHERE id = $4',
        [campaign.id, waAccountId, 'queued', lead.id]
      );

      // Calculate delay if campaign scheduled in the future
      let delayMs = 0;
      if (campaign.schedule_time) {
        const scheduleDiff = new Date(campaign.schedule_time).getTime() - Date.now();
        delayMs = Math.max(0, scheduleDiff);
      }

      // Prepare template message replacing placeholders
      const message = campaign.message_template
        .replace(/{{name}}/gi, lead.name || '')
        .replace(/{{company}}/gi, lead.company || '')
        .replace(/{{product}}/gi, lead.product || '')
        .replace(/{{quantity}}/gi, lead.quantity || '')
        .replace(/{{strength}}/gi, lead.strength || '')
        .replace(/{{brand}}/gi, lead.brand || '');

      // Add to outreach queue
      await outreachQueue.add(
        {
          leadId: lead.id,
          campaignId: campaign.id,
          waAccountId,
          message,
          isFollowup: false,
        },
        {
          delay: delayMs,
          attempts: 10,
          backoff: 30000,
        }
      );

      accountIndex = (accountIndex + 1) % waAccountIds.length;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully triggered outreach for ${leads.length} leads`,
    });
  } catch (error) {
    console.error('Trigger campaign outreach error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
