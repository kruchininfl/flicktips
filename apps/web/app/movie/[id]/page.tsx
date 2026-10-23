import { PortTodo } from '@/components/PortTodo';

// /movie/:id — MoviePage (+ MovieTrailer, MovieVotes popup).
export default async function MoviePage({ params }: PageProps<'/movie/[id]'>) {
  const { id } = await params;
  return <PortTodo legacy="MoviePage">{id}</PortTodo>;
}
