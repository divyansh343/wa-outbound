import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { outreachQueue } from '@/lib/queue';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignsRes = await query(
      `SELECT c.*, 
        (SELECT json_agg(wa.*) 
         FROM wa_accounts wa 
         JOIN campaign_wa_accounts cwa ON cwa.wa_account_id = wa.id 
         WHERE cwa.campaign_id = c.id) as accounts,
        (SELECT count(*)::int FROM leads WHERE campaign_id = c.id) as total_leads,
        (SELECT count(*)::int FROM leads WHERE campaign_id = c.id AND status = 'queued') as queued_leads,
        (SELECT count(*)::int FROM leads WHERE campaign_id = c.id AND status = 'contacted') as contacted_leads,
        (SELECT count(*)::int FROM leads WHERE campaign_id = c.id AND status = 'replied') as replied_leads,
        (SELECT count(*)::int FROM leads WHERE campaign_id = c.id AND status = 'failed') as failed_leads
      FROM campaigns c 
      WHERE c.org_id = $1 
      ORDER BY c.created_at DESC`,
      [session.user.orgId]
    );

    return NextResponse.json(campaignsRes.rows);
  } catch (error) {
    console.error('Fetch campaigns error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      name,
      messageTemplate,
      followupTemplates,
      waAccountIds,
      scheduleTime,
      delayMin,
      delayMax,
      autoResponses,
      triggerLeadCount,
    } = await req.json();

    if (!name || !messageTemplate || !waAccountIds || waAccountIds.length === 0) {
      return NextResponse.json(
        { error: 'Name, template, and at least one WA Account are required' },
        { status: 400 }
      );
    }

    const dMin = delayMin !== undefined ? parseInt(delayMin, 10) : 15;
    const dMax = delayMax !== undefined ? parseInt(delayMax, 10) : 45;

    // 1. Insert campaign
    const campaignRes = await query(
      `INSERT INTO campaigns (org_id, name, status, schedule_time, message_template, followup_templates, delay_min, delay_max, auto_responses)
       VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        session.user.orgId,
        name,
        scheduleTime ? new Date(scheduleTime) : null,
        messageTemplate,
        JSON.stringify(followupTemplates || []),
        dMin,
        dMax,
        JSON.stringify(autoResponses || []),
      ]
    );
    const campaign = campaignRes.rows[0];

    // 2. Map WhatsApp accounts to the campaign
    for (const waId of waAccountIds) {
      await query('INSERT INTO campaign_wa_accounts (campaign_id, wa_account_id) VALUES ($1, $2)', [
        campaign.id,
        waId,
      ]);
    }

    // 3. Select leads in the pool of the org that are status = 'new'
    let leadsRes;
    if (triggerLeadCount !== undefined && triggerLeadCount !== 'all') {
      const limit = parseInt(triggerLeadCount, 10);
      if (limit > 0) {
        leadsRes = await query(
          "SELECT * FROM leads WHERE org_id = $1 AND status = 'new' ORDER BY created_at ASC LIMIT $2",
          [session.user.orgId, limit]
        );
      } else {
        leadsRes = { rows: [] };
      }
    } else {
      leadsRes = await query(
        "SELECT * FROM leads WHERE org_id = $1 AND status = 'new' ORDER BY created_at ASC",
        [session.user.orgId]
      );
    }
    const leads = leadsRes.rows;

    // Filter only connected accounts among the selected ones
    const connectedAccountsRes = await query(
      `SELECT id FROM wa_accounts WHERE id = ANY($1) AND status = 'connected'`,
      [waAccountIds]
    );
    const connectedWaAccountIds = connectedAccountsRes.rows.map((r) => r.id);

    if (leads.length > 0 && connectedWaAccountIds.length > 0) {
      // 4. Distribute leads across the mapped connected WhatsApp accounts round-robin
      let accountIndex = 0;
      for (const lead of leads) {
        const waAccountId = connectedWaAccountIds[accountIndex];

        // Update lead with assigned WA Account and Campaign ID
        await query(
          'UPDATE leads SET campaign_id = $1, assigned_wa_account_id = $2, status = $3 WHERE id = $4',
          [campaign.id, waAccountId, 'queued', lead.id]
        );

        // Calculate dynamic timing
        let delayMs = 0;
        if (scheduleTime) {
          const scheduleDiff = new Date(scheduleTime).getTime() - Date.now();
          delayMs = Math.max(0, scheduleDiff);
        }

        // Prepare message template replacing placeholders
        const message = messageTemplate
          .replace(/{{name}}/gi, lead.name || '')
          .replace(/{{company}}/gi, lead.company || '')
          .replace(/{{product}}/gi, lead.product || '')
          .replace(/{{quantity}}/gi, lead.quantity || '')
          .replace(/{{strength}}/gi, lead.strength || '')
          .replace(/{{brand}}/gi, lead.brand || '');

        // Queue lead outreach job in Bull
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

        accountIndex = (accountIndex + 1) % connectedWaAccountIds.length;
      }
    }

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error('Create campaign error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
