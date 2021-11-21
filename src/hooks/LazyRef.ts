import {MutableRefObject, useRef} from "react";

const useLazyRefSymbol = { __type: "___useLazyRefSymbol___" };
export function useLazyRef<T>(init: () => T): MutableRefObject<T> {
    const ref = useRef<T | typeof useLazyRefSymbol>(useLazyRefSymbol);
    if(ref.current === useLazyRefSymbol) {
        ref.current = init();
    }
    return ref as MutableRefObject<T>;
}
