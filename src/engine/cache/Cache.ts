import {ResolverCacheResolver} from "./CacheResolver";
import {extractErrorMessage} from "../../utils";

export type ResolveOptions<V> = {
    doNotCache?: boolean,
    cacheMode?: "cache-only" | "no-cache" | "normal",
    defaultValue?: V
}

type ItemCacheResolveResultError = {
    status: "error",
    message: string,
    resolverId: string | null
};

export type ItemCacheResolveResult<V> = {
    status: "resolved",
    value: V
} | {
    status: "missing"
} | ItemCacheResolveResultError;

export interface ItemCache<K, V> {
    resolve(key: K, options?: ResolveOptions<V> & { defaultValue: never }) : Promise<ItemCacheResolveResult<V>>;
    resolve(key: K, options?: ResolveOptions<V> & { defaultValue: V }) : Promise<V>;

    cached(key: K) : boolean;
    delete(key: K) : void;
}

type ResolveResultHit<V> = {
    status: "cache-hit",
    value: V,

    /* Number of milliseconds after this invalidates */
    invalidatesAfter?: number,
};

type ResolveResultMiss = {
    status: "cache-miss",
};

type ResolveResultError = {
    status: "cache-error",
    message: string,
};

export type ResolveResult<V> = ResolveResultHit<V> | ResolveResultMiss | ResolveResultError;
export const kResolveResultMiss: ResolveResultMiss = { status: "cache-miss" };

export type CacheKeyGenerator<K> = (key: K) => string;
export type CacheKey<K> = {
    key: K,
    cacheKey: string
}
export type ResolverRole = "cache" | "hybrid" | "resolver";

export interface ItemCacheResolver<K, V> {
    name() : string;
    role() : ResolverRole;

    resolve(key: CacheKey<K>, options: ResolveOptions<V>) : ResolveResult<V> | Promise<ResolveResult<V>>;

    cached(key: CacheKey<K>) : boolean;

    /**
     * Called when a value has been successfully resolved and this cache has returned "cache-miss".
     * @param key
     * @param value
     */
    save(key: CacheKey<K>, value: V) : void;

    delete(key: CacheKey<K>): void;
}

type SyncCacheCallback<V> = (result: ItemCacheResolveResult<V>) => void;
class SyncItemCache<K, V> implements ItemCache<K, V> {
    private locks: {
        [key: string]: { callbacks: SyncCacheCallback<V>[] }
    } = {};

    constructor(readonly keyGenerator: CacheKeyGenerator<K>, readonly resolver: ItemCacheResolver<K, V>[]) { }

    cached(key: K): boolean {
        const cacheKey = this.generateCacheKey(key);
        for(const resolver of this.resolver) {
            if(resolver.cached(cacheKey)) {
                return true;
            }
        }

        return false;
    }

    delete(key: K): void {
        const cacheKey = this.generateCacheKey(key);
        for(const resolver of this.resolver) {
            resolver.delete(cacheKey);
        }
    }

    async resolve(key: K, options?: any): Promise<any> {
        /* FIXME: The sync option conflicts currently with the cacheMode option! */

        const resolveOptions: ResolveOptions<V> = Object.assign({
            cacheMode: "normal",
        }, options);
        const cacheKey = this.generateCacheKey(key);

        let result: ItemCacheResolveResult<V>;
        if(cacheKey.cacheKey in this.locks) {
            result = await new Promise<ItemCacheResolveResult<V>>(resolve => {
                this.locks[cacheKey.cacheKey].callbacks.push(resolve);
            });
        } else {
            const { callbacks }: { callbacks: SyncCacheCallback<V>[] } = this.locks[cacheKey.cacheKey] = {
                callbacks: []
            };

            try {
                result = await this.doResolve(cacheKey, resolveOptions);
            } catch (error) {
                console.error("Cache resolve error: %o", error);
                result = { status: "error", message: extractErrorMessage(error), resolverId: null };
            }

            delete this.locks[cacheKey.cacheKey];
            callbacks.forEach(callback => callback(result));
        }

        if('defaultValue' in resolveOptions) {
            return result.status === "resolved" ? result.value : resolveOptions.defaultValue as any;
        } else {
            return result;
        }
    }


    private async doResolve(cacheKey: CacheKey<K>, options: ResolveOptions<V>) : Promise<ItemCacheResolveResult<V>> {
        let availableResolver;
        switch(options.cacheMode) {
            case "cache-only":
                availableResolver = this.resolver.filter(resolver => resolver.role() !== "resolver");
                break;

            case "no-cache":
                availableResolver = this.resolver.filter(resolver => resolver.role() !== "cache");
                break;

            case "normal":
            default:
                availableResolver = this.resolver;
                break;
        }

        const updateResolver = [];

        let lastError: ItemCacheResolveResultError | undefined;
        for(const resolver of availableResolver) {
            let result = resolver.resolve(cacheKey, options);
            if("then" in result) {
                result = await result;
            }

            switch(result.status) {
                case "cache-error":
                    console.warn("Cache resolver %s reported an error while loading key %s: %s", resolver.name(), cacheKey.cacheKey, result.message);
                    lastError = { status: "error", message: result.message, resolverId: resolver.name() };
                    updateResolver.push(resolver);
                    continue;

                case "cache-miss":
                    updateResolver.push(resolver);
                    continue;

                case "cache-hit":
                    for(const resolver of updateResolver) {
                        resolver.save(cacheKey, result.value);
                    }

                    return {
                        status: "resolved",
                        value: result.value
                    };

                default:
                    throw new Error("invalid result status");
            }
        }

        return lastError || { status: "missing", };
    }

    private generateCacheKey(key: K) : CacheKey<K> {
        return {
            key,
            cacheKey: this.keyGenerator(key)
        };
    }
}

type CreateItemCacheResolverEntry<K, V> =
    ItemCacheResolver<K, V> |
    ((key: K) => ResolveResult<V> | Promise<ResolveResult<V>>);

export function createItemCache<K, V>(cacheKeyGenerator: CacheKeyGenerator<K>, resolvers: CreateItemCacheResolverEntry<K, V>[]) : ItemCache<K, V> {
    const cacheResolver: ItemCacheResolver<K, V>[] = [];
    for(const resolver of resolvers) {
        if(typeof resolver === "function") {
            cacheResolver.push(new ResolverCacheResolver(resolver));
        } else {
            cacheResolver.push(resolver);
        }
    }

    return new SyncItemCache(
        cacheKeyGenerator,
        cacheResolver
    );
}
