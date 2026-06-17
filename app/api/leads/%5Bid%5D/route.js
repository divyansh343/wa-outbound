import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const updates = await req.json();

    // Whitelist editable fields
    const allowedFields = ['status', 'notes', 'tags', 'assigned_wa_account_id', 'lead_tier'];
    const fieldsToSet = [];
    const values = [];
    let queryIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fieldsToSet.push(`${field} = $${queryIndex}`);
        values.push(updates[field]);
        queryIndex++;
      }
    }

    if (fieldsToSet.length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 });
    }

    // Add ID constraint
    values.push(id);
    const idParamIndex = queryIndex;
    queryIndex++;

    // Add Organization ID constraint (security isolation)
    values.push(session.user.orgId);
    const orgParamIndex = queryIndex;

    const sql = `
      UPDATE leads 
      SET ${fieldsToSet.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${idParamIndex} AND org_id = $${orgParamIndex}
      RETURNING *
    `;

    const res = await query(sql, values);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (error) {
    console.error('Update lead error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
