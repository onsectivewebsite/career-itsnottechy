import type { Metadata } from 'next';
import { Providers } from './Providers';
import './globals.css';

export const metadata: Metadata = {
  title: "It's Not Techy Careers",
  description:
    "Join It's Not Techy — a global digital marketing agency. Browse open roles and track your applications.",
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
