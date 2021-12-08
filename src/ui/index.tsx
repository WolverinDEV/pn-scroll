import {useAppSelector} from "../AppState";
import React, {useEffect, useMemo} from "react";
import {ActiveBlogs} from "../engine/Blogs";
import {View, Text} from "react-native";
import {SideBar} from "./components/SideBar";
import {TopBar} from "./components/TopBar";
import {FeedView} from "./components/FeedView";
import {Redirect, Route, Switch, useParams, useRouteMatch} from "react-router-native";
import {UnknownPage} from "./pages/Unknown";
import {PageSettings} from "./pages/Settings";
import {executeLoading} from "../AppLoader";
import { SafeAreaView } from "react-native-safe-area-context";
import {MainPage} from "./pages/Main";
import {BlogProvider, FeedProvider} from "../engine";
import {parseSearchText} from "../engine/Search";

type BlogContextInfo = {
    status: "set",
    blog: BlogProvider,
    feed: FeedProvider,
} | {
    status: "unset"
};
export const BlogContext = React.createContext<BlogContextInfo>({ status: "unset" });

const BlogView = React.memo(() => {
    const { id: blogName, query } = useParams<{ id: string, query: string | undefined }>();

    /* FIXME: Apply known tags? */
    const parsedQuery = query ? parseSearchText(query, [ ]) : undefined;

    const feed = useMemo(() => {
        if(parsedQuery) {
            return ActiveBlogs[blogName]?.filteredFeed({ includeCategories: parsedQuery.includeTags.map(category => category.value) })
        } else {
            return ActiveBlogs[blogName]?.mainFeed();
        }
    }, [ blogName, parsedQuery ]);

    return (
        <View style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxHeight: "100%",
            margin: 0,
            backgroundColor: "#111",

            flex: 1
        }}>
            {feed ? (
                <FeedView
                    key={blogName + "-" + query}
                    initialQuery={query}
                    feed={{
                        blog: ActiveBlogs[blogName]!,
                        blogName: blogName,
                        feed: feed
                    }}
                />
            ) : null}
        </View>
    );
});

const FeedRoute = () => {
    let { path, url } = useRouteMatch();
    return (
        <Switch>
            <Route path={`${path}/query/:query/:page`} render={() => <BlogView />} />
            <Route path={`${path}/query/:query`} render={() => <BlogView />} />
            <Route path={`${path}/main/:page`} render={() => <BlogView />} />
            <Redirect from={`${url}/main/`} to={`${url}/main/1`} />
            <Redirect to={`${url}/main/`} />
        </Switch>
    )
}

export const AppView = () => {
    const loaderState = useAppSelector(state => state.loader.status);
    useEffect(() => {
        if(loaderState === "uninit") {
            /* TODO: Error handling! */
            executeLoading().then(undefined);
        }
    }, [ loaderState ]);

    switch(loaderState) {
        case "load":
            return (
                <SafeAreaView style={{ height: "100%", width: "100%" }}>
                    <SideBar>
                        <TopBar />
                        <Switch>
                            <Route path={"/feed/:id"} render={() => <FeedRoute />} />
                            <Route path={"/settings"} render={() => <PageSettings />} />
                            <Route path={"/"} render={() => <MainPage />} />
                            <Route path={"*"} render={() => <UnknownPage />} />
                        </Switch>
                    </SideBar>
                </SafeAreaView>
            );

        case "loading":
        case "uninit":
            /* TODO: Loading screen? */
            return (
                <Text>Loading..</Text>
            );
    }
};
