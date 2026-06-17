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
    const { name, description, google_sheet_url } = await req.json();

    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx}`);
      values.push(name);
      idx++;
    }
    if (description !== undefined) {
      fields.push(`description = $${idx}`);
      values.push(description);
      idx++;
    }
    if (google_sheet_url !== undefined) {
      fields.push(`google_sheet_url = $${idx}`);
      values.push(google_sheet_url);
      idx++;
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    const idIdx = idx;
    idx++;

    values.push(session.user.orgId);
    const orgIdx = idx;

    const res = await query(
      `UPDATE lead_pools 
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${idIdx} AND org_id = $${orgIdx}
       RETURNING *`,
      values
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (error) {
    console.error('Update pool error:', error);
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

    const res = await query('DELETE FROM lead_pools WHERE id = $1 AND org_id = $2 RETURNING *', [
      id,
      session.user.orgId,
    ]);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Pool deleted successfully' });
  } catch (error) {
    console.error('Delete pool error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
