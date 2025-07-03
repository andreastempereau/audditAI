import React from 'react';
import { InviteContainer } from '@/components/auth/InviteContainer';

interface InvitePageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function InvitePage({ searchParams }: InvitePageProps) {
  const orgId = searchParams?.org as string;
  const email = searchParams?.email as string;

  return <InviteContainer orgId={orgId} email={email} />;
}