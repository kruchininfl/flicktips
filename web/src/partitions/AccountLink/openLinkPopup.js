import config from 'config';
import openPopup from 'partitions/redux-oauth/utils/popup';
import {getAllParams} from 'partitions/redux-oauth/utils/getRedirectInfo';

// Runs VK/Yandex sign-in in a popup in "link" mode: instead of signing in, the API sends the popup back to
// this page with ?link_proof=..., which the page passes to /api/user/accounts/link/.
// Resolves with the proof, or null if the popup was closed first.
export default function openLinkPopup(provider) {
  const origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
  const url = config.oAuth.backend.authProviderPaths[provider]
    + '?link=1&auth_origin_url=' + encodeURIComponent(origin + window.location.pathname);
  const popup = openPopup(provider, url, provider + '_link');

  return new Promise((resolve) => {
    function check() {
      let params = {};

      try {
        params = getAllParams(popup.location);
      } catch (err) {
        // cross-origin while the provider's page is open
      }

      if (params.link_proof) {
        popup.close();
        return resolve(params.link_proof);
      }

      if (!popup || popup.closed) {
        return resolve(null);
      }

      return setTimeout(check, 50);
    }

    check();
  });
}