import CredentialsProvider from 'next-auth/providers/credentials';
import { query } from '@/lib/db';
import { verifyPassword } from '@/lib/auth-helper';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        console.log('[NextAuth Authorize] started for email:', email);
        if (!email || !credentials?.password) {
          console.log('[NextAuth Authorize] missing credentials');
          throw new Error('Please enter both email and password');
        }

        try {
          // Fetch user directly using native SQL
          const res = await query('SELECT * FROM users WHERE email = $1', [email]);
          const user = res.rows[0];

          if (!user) {
            console.log('[NextAuth Authorize] user not found for:', email);
            throw new Error('No user found with this email');
          }

          console.log('[NextAuth Authorize] user found, checking password...');
          const isValid = verifyPassword(credentials.password, user.password_hash);
          console.log('[NextAuth Authorize] password validation result:', isValid);
          if (!isValid) {
            throw new Error('Incorrect password');
          }

          // Return user structure for session storage
          const sessionUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            orgId: user.org_id,
          };
          console.log('[NextAuth Authorize] success, returning user:', sessionUser);
          return sessionUser;
        } catch (err) {
          console.error('[NextAuth Authorize] Error:', err);
          throw err;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.orgId = user.orgId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.orgId = token.orgId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
