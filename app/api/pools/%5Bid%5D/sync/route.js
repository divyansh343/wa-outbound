import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import axios from 'axios';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // 1. Fetch pool details
    const poolRes = await query('SELECT * FROM lead_pools WHERE id = $1 AND org_id = $2', [
      id,
      session.user.orgId,
    ]);

    if (poolRes.rows.length === 0) {
      return NextResponse.json({ error: 'Lead pool not found' }, { status: 404 });
    }

    const pool = poolRes.rows[0];
    const sheetUrl = pool.google_sheet_url;

    if (!sheetUrl) {
      return NextResponse.json(
        { error: 'No Google Sheet URL configured for this lead pool' },
        { status: 400 }
      );
    }

    // 2. Fetch and parse Google Sheet published as CSV
    let csvUrl = sheetUrl;
    if (
      sheetUrl.includes('docs.google.com/spreadsheets') &&
      !sheetUrl.endsWith('/export?format=csv')
    ) {
      const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
      }
    }

    const response = await axios.get(csvUrl, { timeout: 10000 });
    const csvData = response.data;

    const Papa = require('papaparse');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });

    let importedCount = 0;
    if (parsed.data && parsed.data.length > 0) {
      for (const row of parsed.data) {
        // Headers mapping
        const name = row.name || row.Name || row.SENDERNAME || 'Sheet Lead';
        const mobile = row.mobile || row.Mobile || row.phone || row.SENDERMOBILE;
        if (!mobile) continue;

        // Clean & deduplicate check
        const checkRes = await query('SELECT id FROM leads WHERE org_id = $1 AND mobile = $2', [
          session.user.orgId,
          mobile,
        ]);

        if (checkRes.rows.length === 0) {
          await query(
            `INSERT INTO leads (org_id, pool_id, name, company, mobile, email, country, product, quantity, strength, brand, source, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'google_sheet', 'new')`,
            [
              session.user.orgId,
              id,
              name,
              row.company || row.Company || '',
              mobile,
              row.email || row.Email || '',
              row.country || row.Country || 'India',
              row.product || row.Product || '',
              row.quantity || row.Quantity || '',
              row.strength || row.Strength || '',
              row.brand || row.Brand || '',
            ]
          );
          importedCount++;
        }
      }
    }

    // Update last synced time
    await query('UPDATE lead_pools SET last_synced_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    return NextResponse.json({
      message: `Google Sheet sync complete for pool "${pool.name}". Imported ${importedCount} leads.`,
      count: importedCount,
    });
  } catch (error) {
    console.error('Google Sheet sync error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
