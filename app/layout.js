import { Outfit } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const outfit = Outfit({ subsets: ['latin'] });

export const metadata = {
  title: 'OutboundOS - Advanced Outbound Automation for IndiaMart Sellers',
  description:
    'Manage WhatsApp accounts, campaign queues, lead distribution, and automate follow-ups on multiple tenants.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${outfit.className} bg-slate-950 text-slate-100 min-h-screen antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
