import { PortTodo } from '@/components/PortTodo';

// /user/:id — ProfilePage: a user's votes, follow button, TelegramBlock on one's own page.
export default async function UserPage({ params }: PageProps<'/user/[id]'>) {
  const { id } = await params;
  return <PortTodo legacy="ProfilePage/ProfilePage">{id}</PortTodo>;
}
