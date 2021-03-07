import FetchBase from './FetchBase';

const {_} = new FetchBase({
  baseUrl: "https://flick.tips/api",
  timeout: 5000,
  enableProxy: false,
});

export default async function fetchFlickTips<T>(url: string) {
  return _<T>(url);
};