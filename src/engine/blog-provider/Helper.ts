import { ItemCache } from "../cache/Cache";
import { SuggestionResult } from "../index";

export function promisifyIDBRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

export function asyncIDBIterator(request: IDBRequest<IDBCursorWithValue | null>): AsyncIterable<{ value: any, cursor: Omit<IDBCursor, "continue" | "continuePrimaryKey"> }> {
    let cursor: IDBCursorWithValue | null;
    return {
        [Symbol.asyncIterator]() {
            return {
                async next() {
                    cursor?.continue();
                    cursor = await promisifyIDBRequest(request);
                    if (!cursor) {
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
    for (const header of Object.keys(headers)) {
        result.append(header, headers[header]);
    }
    return result;
}

export function objectHeadersToKv(headers: Headers) {
    const result: { [key: string]: string } = {};
    for (const [ key, value ] of headers as any) {
        result[key] = value;
    }
    return result;
}

export type KnownTag = {
    /**
     * The original tag to work with.
     */
    tag: string,

    /**
     * Tag has been trimmed and is in all lowercase.
     */
    tagNormalized: string,

    /**
     * Which priority the tag has.
     * The higher the better.
     */
    priority: number
};

export class TagSuggest {
    private readonly knownTags: Promise<KnownTag[] | null>;

    constructor(
        knownTags: Promise<KnownTag[] | null>
    ) {
        this.knownTags = knownTags.then(tags => {
            tags?.sort((a, b) => b.priority - a.priority);
            return tags;
        });
    }

    async suggest(text: string, abortSignal: AbortSignal): Promise<SuggestionResult> {
        let tags = await this.knownTags;
        if (!tags?.length) {
            return { status: "error", message: "failed to load tags" };
        } else if (abortSignal.aborted) {
            return { status: "aborted" };
        }

        text = text.toLowerCase();

        const suggestions = [];
        for (const { tag, tagNormalized } of tags) {
            if (!tagNormalized.startsWith(text)) {
                continue;
            }

            suggestions.push(tag);
            if (suggestions.length > 100) {
                break;
            }
        }

        return {
            status: "success",
            suggestions: suggestions
        };
    }
}
