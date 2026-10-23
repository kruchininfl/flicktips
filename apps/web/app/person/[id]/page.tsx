import { PortTodo } from '@/components/PortTodo';

// /person/:id — PersonPage.
export default async function PersonPage({ params }: PageProps<'/person/[id]'>) {
  const { id } = await params;
  return <PortTodo legacy="PersonPage">{id}</PortTodo>;
}
