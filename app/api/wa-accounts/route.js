import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { connectWhatsApp } from '@/lib/baileys-manager';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await query(
      'SELECT * FROM wa_accounts WHERE org_id = $1 ORDER BY created_at DESC',
      [session.user.orgId]
    );

    return NextResponse.json(res.rows);
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

    const { name, dailyLimit, delayMin, delayMax } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const res = await query(
      `INSERT INTO wa_accounts (org_id, name, daily_limit, delay_min, delay_max)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [session.user.orgId, name, dailyLimit || 100, delayMin || 15, delayMax || 45]
    );

    const waAccount = res.rows[0];

    // Connect asynchronously or trigger state connection setup
    // Grab the global IO server from global if running custom server
    if (global.io) {
      connectWhatsApp(waAccount.id, global.io).catch((err) => {
        console.error('Failed to trigger async WA connect:', err);
      });
    }

    return NextResponse.json(waAccount, { status: 201 });
  } catch (error) {
    console.error('Create WA Account error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
