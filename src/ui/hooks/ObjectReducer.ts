import { DependencyList, useEffect, useMemo, useState } from "react";
import { produce } from "immer";

type ChangeList = { head?: ChangeItem, tail?: ChangeItem };
type ChangeItem = { next?: ChangeItem, action: string, payload: any };
type ObjectReducerOptions = {
    /* FIXME: Implement again? */
    immer?: boolean
};

type ObjectReducerFunctions<S> = {
    [ key: string ]: (draft: S, payload: any) => S | void
};

type ObjectReducerDispatch<S, R extends ObjectReducerFunctions<S>> = <A extends keyof R>(action: A, ...payload: Parameters<R[A]> extends [ S, infer P ] ? [ P ] : [ ] ) => void;

type ObjectReducerHook<S, R extends ObjectReducerFunctions<S>> = [
    S,
    ObjectReducerDispatch<S, R>
];

/**
 * Wrapper containing the object reducer for later use with
 * `useDefinedReducer`.
 */
class DefinedObjectReducer<S, R extends ObjectReducerFunctions<S>> {
    protected readonly reducer: R;

    constructor(reducer: R) {
        this.reducer = reducer;
    }

    createInstance(initialState: S | (() => S)) : ObjectReducer<S, R> {
        console.info("Created reducer");
        return new ObjectReducer(this.reducer, initialState);
    }
}

/**
 * Wrapper containing the object reducer for later use with
 * `useDefinedReducer` providing a default initial state.
 */
class DefaultedDefinedObjectReducer<S, R extends ObjectReducerFunctions<S>> extends DefinedObjectReducer<S, R> {
    protected readonly initialState: S | (() => S);

    constructor(reducer: R, initialState: S | (() => S)) {
        super(reducer);

        this.initialState = initialState;
    }

    createInstance(initialState?: S | (() => S)) : ObjectReducer<S, R> {
        console.info("Created reducer");
        const initialStateProvided = arguments.length >= 1;
        return new ObjectReducer(this.reducer, initialStateProvided ? initialState! : this.initialState);
    }
}

export function defineObjectReducer<S>() :
    <R extends ObjectReducerFunctions<S>>(reducer: R) => DefinedObjectReducer<S, R>;

export function defineObjectReducer<S>(initialState: S | (() => S)) :
    <R extends ObjectReducerFunctions<S>>(reducer: R) => DefaultedDefinedObjectReducer<S, R>;

export function defineObjectReducer(initialState?: any) : any {
    const initialStateProvided = arguments.length >= 1;
    return (reducer: any) => {
        return initialStateProvided ?
            new DefaultedDefinedObjectReducer(reducer, initialState) :
            new DefinedObjectReducer(reducer);

    };
}

/**
 * Defines a reducer with the following properties:
 * 1. All dispatch calls are executed in order
 * 2. All dispatches are executed regardless if the component has been unmounted
 * @param reducer Available actions
 * @param initialState Initial reducer state
 * @param dependencies A set of dependencies when to recreate the reducer
 */
export function useDefinedReducer<
    S,
    R extends ObjectReducerFunctions<S>
>(
    reducer: DefaultedDefinedObjectReducer<S, R>,
    initialState?: S | (() => S),
    dependencies?: DependencyList
) : ObjectReducerHook<S, R>;

export function useDefinedReducer<
    S,
    R extends ObjectReducerFunctions<S>
>(
    reducer: DefinedObjectReducer<S, R>,
    initialState: S | (() => S),
    dependencies?: DependencyList
) : ObjectReducerHook<S, R>;

export function useDefinedReducer<
    S,
    R extends ObjectReducerFunctions<S>
>(
    reducer: DefinedObjectReducer<S, R>,
    initialState?: any,
    dependencies?: DependencyList
) : ObjectReducerHook<S, R> {
    const initialStateProvided = arguments.length >= 2;

    const instance = useMemo<ObjectReducer<S, R>>(() => {
        if(initialStateProvided) {
            return reducer.createInstance(initialState);
        } else if(reducer instanceof DefaultedDefinedObjectReducer) {
            return reducer.createInstance();
        } else {
            throw new Error("invalid defined reducer parameters");
        }
    }, [ reducer, ...(dependencies || []) ]);

    const [ renderState, setRenderedState ] = useState(instance.currentState());

    useEffect(() => {
        /* Note: Changes process before the component has been mounted will not be reflected in renderState. */
        const unregisterListener = instance.listen(newState => setRenderedState(newState));

        return () => {
            unregisterListener();
            instance.destroy();
        };
    }, [ instance ]);

    return [
        renderState,
        (instance.dispatch as any).bind(instance)
    ];
}

class ObjectReducer<S, R extends ObjectReducerFunctions<S>> {
    private readonly reducer: R;
    private readonly listener: ((newState: S) => void)[];

    private state: S;
    private dispatchQueue: ChangeList;
    private updateTask: any;

    constructor(reducer: R, initialState: S | (() => S)) {
        this.reducer = reducer;

        //console.error("Initial state: %o", initialState);
        this.state = typeof initialState === "function" ? (initialState as any)() : initialState;
        this.dispatchQueue = {
            head: undefined,
            tail: undefined
        };
        this.listener = [];
    }

    destroy() {
        /* cancel all still pending changes */
        clearTimeout(this.updateTask);
        this.updateTask= undefined;

        /* flush all changes */
        this.executeQueue();
    }

    listen(listener: (newState: S) => void) : () => void {
        const registeredListener = this.listener;
        registeredListener.push(listener);

        return () => {
            const index = registeredListener.indexOf(listener);
            if(index !== -1) {
                registeredListener.splice(index, 1);
            }
        };
    }

    dispatch <A extends keyof R>(action: A, ...payload: Parameters<R[A]> extends [ S, infer P ] ? [ P ] : [ ] ) {
        const item: ChangeItem = { action: action as string, next: undefined, payload: payload[0] };
        if(this.dispatchQueue.tail === undefined) {
            this.dispatchQueue.head = item;
            this.dispatchQueue.tail = item;
        } else {
            this.dispatchQueue.tail.next = item;
            this.dispatchQueue.tail = item;
        }

        if(!this.updateTask) {
            this.updateTask = setTimeout(() => this.dispatchChanges());
        }
    }

    currentState() : S {
        return this.state;
    }

    private executeQueue() : boolean {
        const savedState = this.state;

        while(this.dispatchQueue.head) {
            const item = this.dispatchQueue.head;

            try {
                const reducer: any = produce(this.reducer[item.action]);
                this.state = reducer(this.state, item.payload);
            } catch (error) {
                /* TODO: Better handling? */
                console.error(error);
            }

            this.dispatchQueue.head = item.next;
        }

        this.dispatchQueue.tail = undefined;
        return !Object.is(savedState, this.state);
    };

    private dispatchChanges() {
        this.updateTask = undefined;
        if(!this.executeQueue()) {
            return;
        }

        for(const listener of this.listener) {
            listener(this.state);
        }
    }
}

/* Special reducer return type since immer is false. By default we're using immer */
export function useObjectReducer<S extends object>(initialState: S | (() => S), options?: { immer: false }):
    <R extends { [ key: string ]: (draft: S, payload: any) => S }>(reducer: R) => [
        S,
        <A extends keyof R>(action: A, ...payload: Parameters<R[A]> extends [ S, infer P ] ? [ P ] : [ ] ) => void
    ];

/* Default signature */
export function useObjectReducer<S extends object>(initialState: S | (() => S), options?: ObjectReducerOptions):
    <R extends { [ key: string ]: (draft: S, payload: any) => void | S }>(reducer: R) => [
        S,
        <A extends keyof R>(action: A, ...payload: Parameters<R[A]> extends [ S, infer P ] ? [ P ] : [ ] ) => void
    ];

/**
 * Creates a reducer with the following properties:
 * 1. All dispatch calls are executed in order
 * 2. All dispatches are executed regardless if the component has been unmounted
 * @param initialState Initial reducer state.
 * @param _options
 */
export function useObjectReducer<S extends object>(initialState: S | (() => S), _options?: ObjectReducerOptions):
    <R extends ObjectReducerFunctions<S>>(reducer: R) => [
        S,
        <A extends keyof R>(action: A, ...payload: Parameters<R[A]> extends [ S, infer P ] ? [ P ] : [ ] ) => void
    ]
{
    return <R extends ObjectReducerFunctions<S>>(reducer: R) => {
        /* Note: reducer might change with each call. Creating a new reducer isn't intended behaviour. */
        const definedReducer = useMemo(() => defineObjectReducer<S>(initialState)(reducer), [ /* reducer */ ]);
        return useDefinedReducer(definedReducer);
    };
}
