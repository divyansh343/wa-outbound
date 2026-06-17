import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = params;

    const campaignRes = await query(
      `SELECT c.*, 
        (SELECT json_agg(wa.*) 
         FROM wa_accounts wa 
         JOIN campaign_wa_accounts cwa ON cwa.wa_account_id = wa.id 
         WHERE cwa.campaign_id = c.id) as accounts
       FROM campaigns c 
       WHERE c.id = $1 AND c.org_id = $2`,
      [id, session.user.orgId]
    );

    if (campaignRes.rows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json(campaignRes.rows[0]);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = params;
    const body = await req.json();
    const {
      name,
      messageTemplate,
      followupTemplates,
      waAccountIds,
      scheduleTime,
      status,
      delayMin,
      delayMax,
      autoResponses,
    } = body;

    // 1. Verify ownership
    const campCheck = await query('SELECT * FROM campaigns WHERE id = $1 AND org_id = $2', [
      id,
      session.user.orgId,
    ]);
    if (campCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // 2. Build dynamic update query fields
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (messageTemplate !== undefined) {
      updates.push(`message_template = $${paramIndex++}`);
      values.push(messageTemplate);
    }
    if (followupTemplates !== undefined) {
      updates.push(`followup_templates = $${paramIndex++}`);
      values.push(JSON.stringify(followupTemplates));
    }
    if (scheduleTime !== undefined) {
      updates.push(`schedule_time = $${paramIndex++}`);
      values.push(scheduleTime ? new Date(scheduleTime) : null);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (delayMin !== undefined) {
      updates.push(`delay_min = $${paramIndex++}`);
      values.push(parseInt(delayMin, 10));
    }
    if (delayMax !== undefined) {
      updates.push(`delay_max = $${paramIndex++}`);
      values.push(parseInt(delayMax, 10));
    }
    if (autoResponses !== undefined) {
      updates.push(`auto_responses = $${paramIndex++}`);
      values.push(JSON.stringify(autoResponses));
    }

    if (updates.length > 0) {
      values.push(id);
      values.push(session.user.orgId);
      const updateQuery = `
        UPDATE campaigns 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex++} AND org_id = $${paramIndex++}
        RETURNING *`;
      await query(updateQuery, values);
    }

    // 3. Update campaign WA accounts mapping if provided
    if (waAccountIds !== undefined && Array.isArray(waAccountIds)) {
      // Clear old mappings
      await query('DELETE FROM campaign_wa_accounts WHERE campaign_id = $1', [id]);
      // Insert new mappings
      for (const waId of waAccountIds) {
        await query(
          'INSERT INTO campaign_wa_accounts (campaign_id, wa_account_id) VALUES ($1, $2)',
          [id, waId]
        );
      }
    }

    const campaignRes = await query(
      `SELECT c.*, 
        (SELECT json_agg(wa.*) 
         FROM wa_accounts wa 
         JOIN campaign_wa_accounts cwa ON cwa.wa_account_id = wa.id 
         WHERE cwa.campaign_id = c.id) as accounts
       FROM campaigns c 
       WHERE c.id = $1 AND c.org_id = $2`,
      [id, session.user.orgId]
    );

    return NextResponse.json(campaignRes.rows[0]);
  } catch (error) {
    console.error('Update campaign error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = params;

    const res = await query('DELETE FROM campaigns WHERE id = $1 AND org_id = $2 RETURNING *', [
      id,
      session.user.orgId,
    ]);
    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: 'Campaign not found or not owned by this org' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Campaign deleted successfully',
      deletedCampaign: res.rows[0],
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
