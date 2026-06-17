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

    // Select all pools for this organization along with the count of leads currently in each pool
    const res = await query(
      `SELECT lp.*, COUNT(l.id)::int AS lead_count 
       FROM lead_pools lp
       LEFT JOIN leads l ON l.pool_id = lp.id
       WHERE lp.org_id = $1
       GROUP BY lp.id
       ORDER BY lp.created_at DESC`,
      [session.user.orgId]
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Fetch pools error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description, google_sheet_url } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Pool name is required' }, { status: 400 });
    }

    const res = await query(
      `INSERT INTO lead_pools (org_id, name, description, google_sheet_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [session.user.orgId, name, description || '', google_sheet_url || '']
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error) {
    console.error('Create pool error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
