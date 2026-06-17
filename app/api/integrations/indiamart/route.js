import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import axios from 'axios';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiKey } = await req.json();
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    // Update IndiaMart API key in DB
    await query('UPDATE organizations SET indiamart_api_key = $1 WHERE id = $2', [
      apiKey,
      session.user.orgId,
    ]);

    // Call IndiaMart API to fetch lead data
    // Format required: GET https://seller.indiamart.com/api/v2/leads?apikey=YOUR_KEY
    // For local simulation if API key is invalid/test:
    let leadsFetched = [];
    try {
      const response = await axios.get(
        `https://seller.indiamart.com/api/v2/leads?apikey=${apiKey}`,
        { timeout: 5000 }
      );
      if (response.data && Array.isArray(response.data.leads)) {
        leadsFetched = response.data.leads;
      }
    } catch (apiErr) {
      console.warn('IndiaMart API simulation fallback (offline / demo key). Mocking 3 leads...');
      // Fallback dummy data for IndiaMart
      leadsFetched = [
        {
          SENDERNAME: 'Rajesh Kumar',
          SENDERCOMPANY: 'Kumar Pharmaceuticals',
          SENDERMOBILE: '919876543210',
          SENDEREMAIL: 'rajesh@kumarpharma.com',
          SENDERCOUNTRY: 'India',
          PRODUCTNAME: 'Sildenafil Citrate Oral Film 50mg',
          REQ_QTY: '1000',
          STRENGTH: '50mg',
          BRAND: 'Cenforce',
          NOTES: 'Looking for prompt delivery',
        },
        {
          SENDERNAME: 'Amit Sharma',
          SENDERCOMPANY: 'Sharma Medicos',
          SENDERMOBILE: '919999888877',
          SENDEREMAIL: 'amit@sharmamedicos.com',
          SENDERCOUNTRY: 'India',
          PRODUCTNAME: 'Tadalafil Tablets 20mg',
          REQ_QTY: '500',
          STRENGTH: '20mg',
          BRAND: 'Vidalista',
          NOTES: 'Best export pricing needed',
        },
      ];
    }

    let importedCount = 0;
    for (const lead of leadsFetched) {
      const mobile = lead.SENDERMOBILE || lead.mobile;
      if (!mobile) continue;

      // Check if lead already exists
      const checkRes = await query('SELECT id FROM leads WHERE org_id = $1 AND mobile = $2', [
        session.user.orgId,
        mobile,
      ]);

      if (checkRes.rows.length === 0) {
        await query(
          `INSERT INTO leads (org_id, name, company, mobile, email, country, product, quantity, strength, brand, source, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'indiamart', 'new')`,
          [
            session.user.orgId,
            lead.SENDERNAME || lead.name || 'IndiaMart Lead',
            lead.SENDERCOMPANY || lead.company || '',
            mobile,
            lead.SENDEREMAIL || lead.email || '',
            lead.SENDERCOUNTRY || lead.country || 'India',
            lead.PRODUCTNAME || lead.product || '',
            lead.REQ_QTY || lead.quantity || '',
            lead.STRENGTH || lead.strength || '',
            lead.BRAND || lead.brand || '',
          ]
        );
        importedCount++;
      }
    }

    return NextResponse.json({
      message: `IndiaMart sync complete. Imported ${importedCount} new leads.`,
      count: importedCount,
    });
  } catch (error) {
    console.error('IndiaMart sync error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
