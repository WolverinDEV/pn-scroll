import React, {useEffect, useRef, useState} from "react";
import { produce } from "immer";

type ChangeList = { head: ChangeItem | undefined, tail: ChangeItem | undefined };
type ChangeItem = { next?: ChangeItem, action: string, payload: any };
type ObjectReducerOptions = { immer?: boolean };

const processChanges = (stateRef: React.MutableRefObject<any>, reducerObject: any, changes: ChangeList, options: ObjectReducerOptions) : boolean => {
    const savedState = stateRef.current;

    let item = changes.head;
    while(item !== undefined) {
        try {
            const reducer = options.immer ? produce(reducerObject[item.action]) : reducerObject[item.action];
            stateRef.current = reducer(stateRef.current, item.payload);
        } catch (error) {
            /* TODO: Better handling? */
            console.error(error);
        }
        item = item.next;
    }

    changes.head = undefined;
    changes.tail = undefined;
    return !Object.is(savedState, stateRef.current);
};

/* Special reducer return type since immer is false. By default we're using immer */
export function useObjectReducer<S>(initialState: S | (() => S), options?: { immer: false }):
    <R extends { [ key: string ]: (draft: S, payload: any) => S }>(reducer: R) => [
        S,
        <A extends keyof R>(action: A, ...payload: Parameters<R[A]> extends [ S, infer P ] ? [ P ] : [ ] ) => void
    ];

/* Default signature */
export function useObjectReducer<S>(initialState: S | (() => S), options?: ObjectReducerOptions):
    <R extends { [ key: string ]: (draft: S, payload: any) => void | S }>(reducer: R) => [
        S,
        <A extends keyof R>(action: A, ...payload: Parameters<R[A]> extends [ S, infer P ] ? [ P ] : [ ] ) => void
    ];

/**
 * Creates a reducer with the following properties:
 * 1. All dispatch calls are executed in order
 * 2. All dispatches are executed regardless if the component has been unmounted
 * @param initialState Initial reducer state.
 * @param options
 */
export function useObjectReducer<S>(initialState: S | (() => S), options?: ObjectReducerOptions):
    <R extends { [ key: string ]: (prevState: S, payload: any) => void | S }>(reducer: R) => [
        S,
        <A extends keyof R>(action: A, ...payload: Parameters<R[A]> extends [ S, infer P ] ? [ P ] : [ ] ) => void
    ]
{
    options = options || { immer: true };
    return reducer => {
        const stateRef = useRef<S>();
        const pendingChanges = useRef<ChangeList & { updateTask: any }>({
            head: undefined,
            tail: undefined,
            updateTask: undefined
        });
        useEffect(() => () => {
            /* cancel all still pending changes */
            clearTimeout(pendingChanges.current.updateTask);
            pendingChanges.current.updateTask = undefined;

            /* flush all changes */
            processChanges(stateRef, reducer, pendingChanges.current, options!);
        }, [ ]);

        if(typeof stateRef.current === "undefined") {
            if(typeof initialState === "function") {
                // @ts-ignore
                stateRef.current = initialState();
            } else {
                stateRef.current = initialState;
            }
        }

        const [ renderState, setRenderState ] = useState(stateRef.current!);

        return [
            renderState,
            (action: any, ...payload: any) => {
                const changeList = pendingChanges.current;
                const item: ChangeItem = { action: action as string, next: undefined, payload: payload[0] };
                if(changeList.tail === undefined) {
                    changeList.head = item;
                    changeList.tail = item;
                } else {
                    changeList.tail.next = item;
                    changeList.tail = item;
                }

                if(!changeList.updateTask) {
                    changeList.updateTask = setTimeout(() => {
                        changeList.updateTask = undefined;
                        if(processChanges(stateRef, reducer, changeList, options!)) {
                            setRenderState(stateRef.current!);
                        }
                    });
                }
            }
        ];
    };
}