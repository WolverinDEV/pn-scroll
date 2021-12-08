import {ItemCache} from "../cache/Cache";

export function promisifyIDBRequest<T>(request: IDBRequest<T>) : Promise<T> {
    return new Promise<T>((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

export function asyncIDBIterator(request: IDBRequest<IDBCursorWithValue | null>) : AsyncIterable<{ value: any, cursor: Omit<IDBCursor, "continue" | "continuePrimaryKey"> }> {
    let cursor: IDBCursorWithValue | null;
    return {
        [Symbol.asyncIterator]() {
            return {
                async next() {
                    cursor?.continue();
                    cursor = await promisifyIDBRequest(request);
                    if(!cursor) {
                        return { done: true, value: null };
                    }

                    return { value: { value: cursor.value, cursor }, done: false };
                }
            }
        }
    }
}

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
