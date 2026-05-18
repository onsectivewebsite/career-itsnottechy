import { PublicNav } from '@/components/PublicNav';
import { Card, CardTitle } from '@/components/ui/Card';
import { ConfirmForm } from './ConfirmForm';

export const metadata = { title: 'Choose a new password · ItsNotTechy Careers' };

export default function ResetConfirmPage({ params }: { params: { token: string } }) {
  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-md px-6 py-16">
        <Card>
          <CardTitle>Choose a new password</CardTitle>
          <div className="mt-4">
            <ConfirmForm token={params.token} />
          </div>
        </Card>
      </main>
    </>
  );
}
