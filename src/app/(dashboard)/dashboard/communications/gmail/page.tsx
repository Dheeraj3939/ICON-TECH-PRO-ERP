'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CommunicationsGmailRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/communication/gmail');
  }, [router]);

  return (
    <div className="p-8 text-center text-xs text-slate-500">
      Redirecting to Gmail Mailbox...
    </div>
  );
}
