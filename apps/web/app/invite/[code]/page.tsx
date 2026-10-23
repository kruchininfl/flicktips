import { PortTodo } from '@/components/PortTodo';

// /invite/:code — InvitePage: who invites, sign-in buttons; remembers the code for guests (lib/remembered).
export default async function InvitePage({ params }: PageProps<'/invite/[code]'>) {
  const { code } = await params;
  return <PortTodo legacy="InvitePage">{code}</PortTodo>;
}
