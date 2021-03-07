import axios, {AxiosRequestConfig} from 'axios';

interface IParams {
  baseUrl: string;
  timeout: number;
  enableProxy: boolean;
  headers?: AxiosRequestConfig["headers"];
  maxTry?: number;
}

export interface IFetchBaseResponseSuccess<T> {
  error: false;
  error_code?: undefined;
  payload: T;
}

export interface IFetchBaseResponseFail {
  error: true,
  error_code: string;
  payload?: undefined;
}

export type IFetchBaseResponse<T> = IFetchBaseResponseSuccess<T> | IFetchBaseResponseFail;

const PROXIES = [
  "45.94.37.49:8000:0wjYUH:z69CGD",
]

export default class FetchBase {
  protected baseUrl: IParams["baseUrl"];
  protected timeout: IParams["timeout"];
  protected enableProxy: IParams["enableProxy"];
  protected requestNum: number = 0;
  protected headers?: IParams["headers"];
  protected maxTry: IParams["maxTry"] = 0;

  constructor({
    baseUrl,
    timeout = 5000,
    enableProxy = false,
    headers,
    maxTry,
  }: IParams) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.enableProxy = enableProxy;
    this.headers = headers;
    this.maxTry = maxTry;
  }

  _ = async <T>(
    url: string,
    options?: AxiosRequestConfig,
    tryNum?: number,
  ): Promise<IFetchBaseResponseFail | IFetchBaseResponseSuccess<T>> => {
    const proxy = this.enableProxy && PROXIES[this.requestNum++%PROXIES.length].split(":");
    const cancelTokenSource = axios.CancelToken.source();
    console.log(proxy);
    const axiosConfig = {
      baseURL: this.baseUrl,
      url,
      cancelToken: cancelTokenSource.token,
      headers: this.headers,
      proxy: proxy && {
        protocol: 'http',
        host: proxy[0],
        port: Number(proxy[1]),
        auth: {
          username: proxy[2],
          password: proxy[3]
        },
      },
      ...options,
    };
    const uri = `${this.baseUrl + axios.getUri(axiosConfig)}`;

    console.log(`[FETCH START] ${uri}`);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cancelTokenSource.cancel("FETCH_TIMEOUT");
      }, this.timeout);

      axios(axiosConfig).then((resp) => {
        clearTimeout(timeout);

        if (resp.status >= 200 && resp.status < 300) {
          try {
            console.log(`[FETCH FINISH SUCCESS] ${uri}`);

            return resolve({
              error: false,
              payload: resp.data,
            } as IFetchBaseResponseSuccess<T>);
          } catch (e) {
            console.log(`[FETCH FINISH FAIL] ${uri}`);

            throw {
              error: true,
              error_code: "PARSE_ERROR",
            } as IFetchBaseResponseFail;
          }
        } else {
          console.log(`[FETCH FINISH FAIL] ${uri}`);

          throw {
            error: true,
            error_code: "REQUEST_ERROR",
          } as IFetchBaseResponseFail;
        }
      }).catch((e: any) => {
        console.log(e);
        clearTimeout(timeout);
        console.log(`[FETCH FINISH FAIL] ${uri}`);

        if (typeof this.maxTry !== 'undefined' && this.maxTry - 1 > (tryNum || 0)) {
          return this._(url, options, (tryNum || 0) + 1).then((resp) => {
            resolve(resp as IFetchBaseResponse<T>);
          });
        }

        resolve((
          e.error ? e : {
            error: true,
            error_code: "REQUEST_ERROR",
          }
        ) as IFetchBaseResponseFail);
      })
    });
  }
}