import { serverApi } from '@/api/server';
import { LastGradedFeed } from '@/components/home/LastGradedFeed';
import { getViewer } from '@/viewer/server';

// / — LastGradedPage: the feed of the latest votes. Signed-in visitors start on their friends' votes, guests on
// all votes; "hide viewed" is applied by the API from the session. The title/description are the layout's.
export default async function HomePage() {
  const viewer = await getViewer();
  const onlyFriends = !!viewer;
  const { results } = await (onlyFriends ? serverApi.feed.friends(1) : serverApi.feed.lastGraded(1));

  return <LastGradedFeed initial={results} initialOnlyFriends={onlyFriends} />;
}
