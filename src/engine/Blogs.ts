import {KonachenBlogProvider} from "./blog-provider/Konachan";
import {BlogProvider} from "./index";
import {ThatPervertBlogProvider} from "./blog-provider/ThatPervert";
import {createSlice} from "@reduxjs/toolkit";
import {AppStore} from "../AppState";
import {PornhubBlogProvider} from "./blog-provider/Pornhub";

type BlogRegistryState = {
    knownBlogs: string[],
    activeBlogs: string[],
};

const initialState: BlogRegistryState = {
    knownBlogs: [],
    activeBlogs: [],
};

const blogRegistrySlice = createSlice({
    name: "BlogRegistry",
    initialState: initialState,
    reducers: {
        updateBlogs: state => {
            state.knownBlogs = Object.keys(BlogRegistry);
            state.activeBlogs = Object.keys(ActiveBlogs);
        },
    }
});

export const blogRegistryReducer = blogRegistrySlice.reducer;

export const BlogRegistry = {
    "that-pervert": () => new ThatPervertBlogProvider(),
    "konachen": () => new KonachenBlogProvider(false),
    "konachen-sfw": () => new KonachenBlogProvider(true),
    "pornhub": () => new PornhubBlogProvider()
};

export const ActiveBlogs: {
    [key: string]: BlogProvider
} = {};

function activateBlog(blog: keyof typeof BlogRegistry) {
    if(ActiveBlogs[blog]) {
        return;
    }

    ActiveBlogs[blog] = BlogRegistry[blog]();
    AppStore.dispatch(blogRegistrySlice.actions.updateBlogs());
}

export async function setupBlogs() {
    activateBlog("konachen");
    activateBlog("konachen-sfw");
    activateBlog("that-pervert");
    activateBlog("pornhub");
}
