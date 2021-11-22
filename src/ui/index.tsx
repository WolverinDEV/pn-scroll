import {useAppSelector} from "../AppState";
import React, {useEffect, useMemo} from "react";
import {ActiveBlogs} from "../engine/Blogs";
import {View} from "react-native";
import {SideBar} from "./components/SideBar";
import {TopBar} from "./components/TopBar";
import {FeedView} from "./components/FeedView";
import {Route, Switch} from "react-router-native";
import {UnknownPage} from "./pages/Unknown";
import {PageSettings} from "./pages/Settings";
import {executeLoading} from "../AppLoader";
import {useRouteMatch} from "react-router";

const BlogView = () => {
    const parameter = useRouteMatch();
    const blogName = (parameter.params as any).id as string;
    const feed = useMemo(() => ActiveBlogs[blogName || ""]?.mainFeed(), [ blogName ]);

    return (
        <View style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxHeight: "100%",
            margin: 0,
            backgroundColor: "#111",

            flex: 1
        }}>
            {feed ? <FeedView provider={feed} key={blogName} /> : null}
        </View>
    );
};

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
                <SideBar>
                    <TopBar />
                    <Switch>
                        <Route path={"/feed/:id/"} render={() => <BlogView />} />
                        <Route path={"/settings"} render={() => <PageSettings />} />
                        <Route path={"*"} render={() => <UnknownPage />} />
                    </Switch>
                </SideBar>
            );

        case "loading":
        case "uninit":
            /* TODO: Loading screen? */
            return null;
    }
};