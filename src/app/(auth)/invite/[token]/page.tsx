import { PublicNav } from '@/components/PublicNav';
import { Card, CardTitle } from '@/components/ui/Card';
import { AcceptForm } from './AcceptForm';

export const metadata = { title: 'Accept your invite · ItsNotTechy Careers' };

export default function InvitePage({ params }: { params: { token: string } }) {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-md px-6 py-16">
        <Card>
          <CardTitle>Set your password</CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            Welcome to ItsNotTechy Careers. Choose a password to activate your account.
          </p>
          <div className="mt-4">
            <AcceptForm token={params.token} />
          </div>
        </Card>
      </main>
    </>
  );
}
