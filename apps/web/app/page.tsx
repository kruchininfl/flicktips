import { serverApi } from '@/api/server';
import { Feed } from '@/components/home/Feed';
import { getViewer } from '@/viewer/server';

// / — the feed of the latest votes (Figma «Лента»). Signed-in visitors start on their friends' votes, guests on
// all votes; "hide viewed" is applied by the API from the session. The title/description are the layout's.
export default async function HomePage() {
  const viewer = await getViewer();
  const onlyFriends = !!viewer;
  const { results } = await (onlyFriends ? serverApi.feed.friends(1) : serverApi.feed.lastGraded(1));

  return <Feed initial={results} initialOnlyFriends={onlyFriends} />;
}
