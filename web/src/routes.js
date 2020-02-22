import React from 'react';
import {IndexRoute, Route}  from 'react-router';
import App from 'components/App';
import LastGradedPage from 'components/LastGradedPage';
import LayoutPage from 'components/LayoutPage';
import SignInPage from 'components/SignInPage';
import {ProfilePage, ProfileFriendsPage, ProfileBookmarksPage} from 'components/ProfilePage';
import MoviePage from 'components/MoviePage';
import PersonPage from 'components/PersonPage';
import AboutPage from 'components/AboutPage';

import {isUserSignedIn} from 'redux/models/user';

function requireAuth(nextState, transition, cb) {
  setTimeout(() => {
    if (!isUserSignedIn(store.getState())) {
      transition('/signin');
    }

    cb();
  }, 0);
}

let store;

export default function routes(storeRef) {
// export default function routes() {
  store = storeRef;

  return (
    <Route component={App} path="/">
      <IndexRoute component={LastGradedPage}/>
      <Route component={LayoutPage} path="layout"/>
      <Route component={AboutPage} path="about"/>
      <Route component={SignInPage} path="signin"/>
      <Route component={ProfilePage} path="user/:id"/>
      <Route component={MoviePage} path="movie/:id"/>
      <Route component={PersonPage} path="person/:id"/>
      <Route component={ProfileFriendsPage} path="profile/friends/" onEnter={requireAuth}/>
      <Route component={ProfileBookmarksPage} path="profile/bookmarks/" onEnter={requireAuth}/>
    </Route>
  );
}