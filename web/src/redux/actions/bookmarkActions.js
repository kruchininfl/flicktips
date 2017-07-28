export const BOOKMARK_REQUEST_STARTED = 'BOOKMARK_REQUEST_STARTED';
export const BOOKMARK_REQUEST_FINISHED = 'BOOKMARK_REQUEST_FINISHED';
export const BOOKMARK_REQUEST_ERROR = 'BOOKMARK_REQUEST_ERROR';

export const BOOKMARKS_GET_STARTED = 'BOOKMARKS_GET_STARTED';
export const BOOKMARKS_GET_FINISHED = 'BOOKMARKS_GET_FINISHED';
export const BOOKMARKS_GET_ERROR = 'BOOKMARKS_GET_ERROR';

export const BOOKMARKS_ADD_STARTED = 'BOOKMARKS_ADD_STARTED';
export const BOOKMARKS_ADD_FINISHED = 'BOOKMARKS_ADD_FINISHED';
export const BOOKMARKS_ADD_ERROR = 'BOOKMARKS_ADD_ERROR';

import api from 'api';
import isFunction from 'lodash/isFunction';

let request;

function bookmarkRequestStarted() {
  return {type: BOOKMARK_REQUEST_STARTED};
}

function bookmarkRequestFinished(response) {
  return {type: BOOKMARK_REQUEST_FINISHED, response};
}

function bookmarkRequestError(errors) {
  return {type: BOOKMARK_REQUEST_ERROR, errors};
}

export function toggleBookmark(entityId) {
  return (dispatch) => {
    dispatch(bookmarkRequestStarted());

    if (request && isFunction(request.abort)) {
      request.abort();
    }

    request = api.toggleBookmark(entityId);

    return dispatch(request)
      .then((response) => dispatch(bookmarkRequestFinished(response.body)))
      .catch((err) => dispatch(bookmarkRequestError(err)));
  };
}

function getBookmarksRequestStarted() {
  return {type: BOOKMARKS_GET_STARTED};
}

function getBookmarksRequestFinished(response) {
  return {type: BOOKMARKS_GET_FINISHED, response};
}

function getBookmarksRequestError(errors) {
  return {type: BOOKMARKS_GET_ERROR, errors};
}

function addBookmarksRequestStarted() {
  return {type: BOOKMARKS_ADD_STARTED};
}

function addBookmarksRequestFinished(response) {
  return {type: BOOKMARKS_ADD_FINISHED, response};
}

export function getBookmarks() {
  return (dispatch) => {
    dispatch(getBookmarksRequestStarted());

    return dispatch(api.getUserBookmarks())
      .then((response) => dispatch(getBookmarksRequestFinished(response.body)))
      .catch((err) => dispatch(getBookmarksRequestError(err)));
  };
}

export function loadBookmarks(page) {
  return (dispatch) => {
    dispatch(addBookmarksRequestStarted());

    dispatch(api.getUserBookmarks(page))
      .then((response) => dispatch(addBookmarksRequestFinished(response.body)));
  };
}