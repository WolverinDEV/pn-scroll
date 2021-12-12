import {AppSettings} from "./Settings";
import {createSlice} from "@reduxjs/toolkit";
import {AppStore} from "./AppState";
import {setupPlatformFunctions} from "./ui/SetupPlatform";
import {setupBlogs} from "./engine/Blogs";
import {registerServiceWorker} from "./engine/web/ServiceWorker";

type LoaderState = {
    status: "loading" | "uninit" | "load"
};

const initialLoaderState: LoaderState = {
    status: "uninit"
};

const loaderSlice = createSlice({
    initialState: initialLoaderState,
    reducers: {
        setLoading: _state => {
            return { status: "loading" };
        },
        setLoaded: _state => {
            return { status: "load" };
        }
    },
    name: "app-loader"
});
export const loaderReducer = loaderSlice.reducer;

let loadExecuted = false;
export async function executeLoading() {
    if(loadExecuted) {
        throw "app internals already loaded";
    }
    loadExecuted = true;

    AppStore.dispatch(loaderSlice.actions.setLoading());

    await AppSettings.initialize();
    await setupPlatformFunctions();
    await setupBlogs();

    AppStore.dispatch(loaderSlice.actions.setLoaded());
}
