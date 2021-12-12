import {
    CacheKey, createItemCache,
    ItemCacheResolver,
    kResolveResultMiss,
    ResolveOptions,
    ResolveResult,
    ResolverRole
} from "../../cache/Cache";
import {extractErrorMessage} from "../../../utils";
import {kvHeadersToObject, objectHeadersToKv} from "../../blog-provider/Helper";
import {getLogger} from "../../../Log";
import {ProxyRequestClient} from "./ProxyClient";

const logger = getLogger("web-image-cache");

type CacheLoadRequest = {
    url: string,
    headers: { [key: string]: string },
    proxyClient?: ProxyRequestClient
}

type CacheLoadResult = {
    status: "success",
    data: Blob,
    headers: { [key: string]: string },
} | {
    status: "failure",
    message: string
};

class WebCacheLoader implements ItemCacheResolver<CacheLoadRequest, CacheLoadResult> {
    private static generateRequest({ key }: CacheKey<CacheLoadRequest>) : Request {
        return new Request(key.url, {
            headers: key.headers,
        });
    }

    private readonly cache: Promise<Cache | null>;

    constructor() {
        this.cache = WebCacheLoader.initializeImageCache().catch(error => {
            logger.warn("Failed to open image cache.\nThis might impact network usage: %s", extractErrorMessage(error));
            return null;
        });
    }

    private static async initializeImageCache() : Promise<Cache> {
        if(!("caches" in self)) {
            throw new Error("image cache not supported");
        }

        return await caches.open("image-cache");
    }

    name(): string {
        return "WebCache loader";
    }

    role(): ResolverRole {
        return "cache";
    }

    cached(key: CacheKey<CacheLoadRequest>): boolean {
        /* TODO: May make the cached(...) method async? */
        return false;
    }

    delete(key: CacheKey<CacheLoadRequest>): void {
        const cacheKey = WebCacheLoader.generateRequest(key);
        this.cache.then(cache => cache?.delete(cacheKey));
    }

    async resolve(key: CacheKey<CacheLoadRequest>, options: ResolveOptions<CacheLoadResult>): Promise<ResolveResult<CacheLoadResult>> {
        const cache = await this.cache;
        if(!cache) {
            /* We don't support the image cache. */
            return { status: "cache-miss" };
        }

        const cacheKey = WebCacheLoader.generateRequest(key);
        const response = await cache.match(cacheKey);
        if(!response) {
            return kResolveResultMiss;
        }

        return {
            status: "cache-hit",
            value: {
                status: "success",
                data: await response.blob(),
                headers: objectHeadersToKv(response.headers),
            }
        };
    }

    save(key: CacheKey<CacheLoadRequest>, value: CacheLoadResult): void {
        if(value.status !== "success") {
            return;
        }

        const cacheKey = WebCacheLoader.generateRequest(key);
        this.cache.then(cache => cache?.put(cacheKey,
            new Response(value.data, {
                headers: kvHeadersToObject(value.headers),
            })
        ))
    }
}

async function executeImageDownload({ url, headers, proxyClient }: CacheLoadRequest) : Promise<CacheLoadResult> {
    if(!proxyClient) {
        return { status: "failure", message: "missing request client" };
    }

    const result = await proxyClient.execute({
        method: "GET",
        url: url,
        headers: headers,
        body: undefined
    });

    if(result.status === "failure-internal") {
        return { status: "failure", message: result.message };
    }

    if(result.headers["content-type"].indexOf("image") !== -1) {
        const data = new Blob([ result.payload ], { type: result.headers["content-type"] });
        return {
            status: "success",
            data,
            headers: result.headers
        };
    }

    logger.error("HTML Result: %o", result);
    return { status: "failure", message: "html result" };
}

export const imageCache = createItemCache<CacheLoadRequest, CacheLoadResult>(
    key => key.url,
    [
        new WebCacheLoader(),
        async request => ({
            status: "cache-hit",
            value: await executeImageDownload(request)
        }),
    ]
)
