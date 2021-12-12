import {CacheKey, ItemCacheResolver, kResolveResultMiss, ResolveOptions, ResolveResult, ResolverRole} from "./Cache";
import {extractErrorMessage} from "../../utils";

export class MemoryCacheResolver<K, V> implements ItemCacheResolver<K, V> {
    private readonly timeout?: number;
    private timeoutInterval?: any;
    private cacheTimestamps: { [key: string]: number } = {};
    private cache: { [key: string]: V } = {};

    constructor(timeout?: number) {
        this.timeout = timeout;
        if(this.timeout) {
            this.timeoutInterval = setInterval(() => {
                const timeoutTimestamp = Date.now() - this.timeout!;
                for(const key of Object.keys(this.cacheTimestamps)) {
                    if(this.cacheTimestamps[key] < timeoutTimestamp) {
                        delete this.cacheTimestamps[key];
                        delete this.cache[key];
                    }
                }
            }, timeout);
        }
    }

    destroy() {
        clearInterval(this.timeoutInterval);
        this.timeoutInterval = undefined;
    }

    name(): string {
        return "memory";
    }

    role(): "cache" | "hybrid" | "resolver" {
        return "cache";
    }

    async cached(key: CacheKey<K>): Promise<boolean> {
        return key.cacheKey in this.cache;
    }

    delete(key: CacheKey<K>): void {
        delete this.cacheTimestamps[key.cacheKey];
        delete this.cache[key.cacheKey];
    }

    resolve(key: CacheKey<K>, options: ResolveOptions<V>): Promise<ResolveResult<V>> | ResolveResult<V> {
        if(options.cacheMode === "no-cache") {
            return kResolveResultMiss;
        }

        if(key.cacheKey in this.cache) {
            this.cacheTimestamps[key.cacheKey] = Date.now();
            return { status: "cache-hit", value: this.cache[key.cacheKey] };
        }

        return kResolveResultMiss;
    }

    save(key: CacheKey<K>, value: V): void {
        this.cacheTimestamps[key.cacheKey] = Date.now();
        this.cache[key.cacheKey] = value;
    }
}

type SyncCacheCallback<V> = (result: ResolveResult<V>) => void;
export abstract class SyncCacheResolver<K, V> implements ItemCacheResolver<K, V> {
    private locks: {
        [key: string]: { callbacks: SyncCacheCallback<V>[] }
    } = {};

    abstract cached(key: CacheKey<K>): Promise<boolean>;
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
    async cached(key: CacheKey<K>): Promise<boolean> { return false; }
    delete(key: CacheKey<K>): void { }
}
