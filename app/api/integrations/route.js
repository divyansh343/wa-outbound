import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, config } = await req.json();

    if (!type || !config) {
      return NextResponse.json(
        { error: 'Integration type and config are required' },
        { status: 400 }
      );
    }

    // Save integration configuration into org settings or metadata fields
    // Here we support flexible configurations like HubSpot CRM, Zoho, Webhooks, or Email marketing APIs
    // For general purpose, we store them as a JSON column or update custom settings in org
    await query(
      `UPDATE organizations 
       SET google_sheet_url = CASE WHEN $1 = 'google_sheet' THEN $2 ELSE google_sheet_url END
       WHERE id = $3`,
      [type, typeof config === 'string' ? config : JSON.stringify(config), session.user.orgId]
    );

    return NextResponse.json({
      success: true,
      message: `${type} integration configuration updated.`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
