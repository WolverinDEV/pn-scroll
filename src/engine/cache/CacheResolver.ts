import {CacheKey, ItemCacheResolver, kResolveResultMiss, ResolveOptions, ResolveResult, ResolverRole} from "./Cache";
import {extractErrorMessage} from "../../utils";

export class MemoryCacheResolver<K, V> implements ItemCacheResolver<K, V> {
    private cache: { [key: string]: V } = {};

    name(): string {
        return "memory";
    }

    role(): "cache" | "hybrid" | "resolver" {
        return "cache";
    }

    cached(key: CacheKey<K>): boolean {
        return key.cacheKey in this.cache;
    }

    delete(key: CacheKey<K>): void {
        delete this.cache[key.cacheKey];
    }

    resolve(key: CacheKey<K>, options: ResolveOptions<V>): Promise<ResolveResult<V>> | ResolveResult<V> {
        if(options.cacheMode === "no-cache") {
            return kResolveResultMiss;
        }

        if(key.cacheKey in this.cache) {
            return { status: "cache-hit", value: this.cache[key.cacheKey] };
        }

        return kResolveResultMiss;
    }

    save(key: CacheKey<K>, value: V): void {
        this.cache[key.cacheKey] = value;
    }
}

type SyncCacheCallback<V> = (result: ResolveResult<V>) => void;
export abstract class SyncCacheResolver<K, V> implements ItemCacheResolver<K, V> {
    private locks: {
        [key: string]: { callbacks: SyncCacheCallback<V>[] }
    } = {};

    abstract cached(key: CacheKey<K>): boolean;
    abstract delete(key: CacheKey<K>): void;
    abstract name(): string;
    abstract role(): ResolverRole;
    abstract save(key: CacheKey<K>, value: V): void;

    resolve(key: CacheKey<K>, options: ResolveOptions<V>): ResolveResult<V> | Promise<ResolveResult<V>> {
        if(key.cacheKey in this.locks) {
            return new Promise<ResolveResult<V>>(resolve => {
                this.locks[key.cacheKey].callbacks.push(resolve);
            });
        }

        let result = this.doResolve(key, options);
        if(!(result instanceof Promise)) {
            return result;
        }

        const { callbacks }: { callbacks: SyncCacheCallback<V>[] } = this.locks[key.cacheKey] = {
            callbacks: []
        };

        return result.catch(error => {
            return { status: "cache-error", message: extractErrorMessage(error) } as ResolveResult<V>;
        }).then(result => {
            callbacks.forEach(callback => callback(result));
            delete this.locks[key.cacheKey];
            return result;
        });
    }

    protected abstract doResolve(key: CacheKey<K>, options: ResolveOptions<V>): ResolveResult<V> | Promise<ResolveResult<V>>;
}

export class ResolverCacheResolver<K, V> implements ItemCacheResolver<K, V> {
    constructor(readonly resolver: (key: K) => ResolveResult<V> | Promise<ResolveResult<V>>) { }

    name(): string {
        return "resolver";
    }

    role(): ResolverRole {
        return "resolver";
    }

    resolve(key: CacheKey<K>, options: ResolveOptions<V>): ResolveResult<V> | Promise<ResolveResult<V>> {
        return this.resolver(key.key);
    }

    save(key: CacheKey<K>, value: V): void { }
    cached(key: CacheKey<K>): boolean { return false; }
    delete(key: CacheKey<K>): void { }
}
