import {ItemCache} from "../cache/Cache";
import * as stream from "stream";

export async function ensurePageLoaderSuccess<K, V>(loader: ItemCache<K, V>, key: K): Promise<V> {
    const page = await loader.resolve(key);
    switch (page.status) {
        case "error":
            throw new Error("page load error: " + page.message);

        case "missing":
            throw new Error("page could not be loaded");

        case "resolved":
            return page.value;
    }
}

export function kvHeadersToObject(headers: { [key: string]: string }) {
    const result = new Headers();
    for(const header of Object.keys(headers)) {
        result.append(header, headers[header]);
    }
    return result;
}

export function objectHeadersToKv(headers: Headers) {
    const result: { [key: string]: string } = {};
    for(const [ key, value ] of headers) {
        result[key] = value;
    }
    return result;
}
