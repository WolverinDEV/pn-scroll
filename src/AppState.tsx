import {configureStore} from "@reduxjs/toolkit";
import {useDispatch as originalUseDispatch, useSelector as originalUseSelector} from "react-redux";
import {sidebarReducer} from "./components/SideBar";



export const AppStore = configureStore({
    reducer: {
        sidebar: sidebarReducer
    }
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof AppStore.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof AppStore.dispatch

export function useAppDispatch() : AppDispatch {
    return originalUseDispatch();
}

export function useAppSelector<TSelected>(selector: (state: RootState) => TSelected) : TSelected {
    return originalUseSelector(selector);
}
