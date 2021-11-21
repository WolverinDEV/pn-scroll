import {useLazyRef} from "./LazyRef";

export function useAnimation<K, Args extends any[]>(klass: new (...args: Args) => K, ...args: Args) : K {
    return useLazyRef(() => new klass(...args)).current;
}
