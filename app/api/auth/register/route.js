import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth-helper';

export async function POST(req) {
  try {
    const { name, email, password, orgName } = await req.json();

    if (!name || !email || !password || !orgName) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check if user already exists
    const userCheck = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (userCheck.rows.length > 0) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    // 2. Create organization
    const orgRes = await query('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [
      orgName,
    ]);
    const orgId = orgRes.rows[0].id;

    // 3. Create user
    const passwordHash = hashPassword(password);
    const userRes = await query(
      `INSERT INTO users (name, email, password_hash, role, org_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, role, org_id`,
      [name, normalizedEmail, passwordHash, 'owner', orgId]
    );

    return NextResponse.json(
      { message: 'User and Organization registered successfully', user: userRes.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
