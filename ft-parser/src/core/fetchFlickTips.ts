import FetchBase from './FetchBase';

const {_} = new FetchBase({
  baseUrl: "https://flicktips.ru/api",
  timeout: 5000,
  enableProxy: false,
});

export default async function fetchFlickTips<T>(url: string) {
  return _<T>(url);
};