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
    const poolId = searchParams.get('poolId');

    let leadsRes;
    if (campaignId) {
      leadsRes = await query(
        `SELECT l.*, lp.name AS pool_name 
         FROM leads l 
         LEFT JOIN lead_pools lp ON lp.id = l.pool_id
         WHERE l.org_id = $1 AND l.campaign_id = $2 
         ORDER BY l.created_at DESC`,
        [session.user.orgId, campaignId]
      );
    } else if (poolId) {
      leadsRes = await query(
        `SELECT l.*, lp.name AS pool_name 
         FROM leads l 
         LEFT JOIN lead_pools lp ON lp.id = l.pool_id
         WHERE l.org_id = $1 AND l.pool_id = $2 
         ORDER BY l.created_at DESC 
         LIMIT 100`,
        [session.user.orgId, poolId]
      );
    } else {
      leadsRes = await query(
        `SELECT l.*, lp.name AS pool_name 
         FROM leads l 
         LEFT JOIN lead_pools lp ON lp.id = l.pool_id
         WHERE l.org_id = $1 
         ORDER BY l.created_at DESC 
         LIMIT 100`,
        [session.user.orgId]
      );
    }

    return NextResponse.json(leadsRes.rows);
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

    const { leads, poolId } = await req.json(); // Array of lead objects & optional poolId
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'Leads array is required' }, { status: 400 });
    }

    const insertedLeads = [];
    for (const lead of leads) {
      const {
        name,
        company,
        mobile,
        email,
        country,
        product,
        quantity,
        strength,
        brand,
        source,
        notes,
        tags,
      } = lead;
      if (!name || !mobile) continue;

      const res = await query(
        `INSERT INTO leads (org_id, pool_id, name, company, mobile, email, country, product, quantity, strength, brand, source, status, notes, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'new', $13, $14)
         RETURNING *`,
        [
          session.user.orgId,
          poolId || null,
          name,
          company || null,
          mobile,
          email || null,
          country || null,
          product || null,
          quantity || null,
          strength || null,
          brand || null,
          source || 'csv',
          notes || null,
          tags || null,
        ]
      );
      insertedLeads.push(res.rows[0]);
    }

    return NextResponse.json(
      {
        message: `Successfully imported ${insertedLeads.length} leads`,
        count: insertedLeads.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Import leads error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
