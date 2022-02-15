import { BlogProvider, FeedEntry, FeedProvider, } from "../../engine";
import React, { useContext, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TouchableHighlight,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { useObjectReducer } from "../hooks/ObjectReducer";
import { AppSettings, Setting } from "../../Settings";
import { ImageRenderer } from "./PostImage";
import { SearchBar } from "./SearchBar";
import { TopBarHeader } from "./TopBar";
import { useHistory } from "react-router-native";
import { BidirectionalFlatList } from "./flat-list";
import { getLogger, logComponentRendered } from "../../Log";
import { PostImage } from "../../engine/types/PostImage";
import { WebView } from 'react-native-webview';

const FeedEntryContext = React.createContext<{
    item: FeedEntry,
    visible: boolean,
    index: number,
    itemHeight: number
}>(undefined as any);

const logger = getLogger("feed-view");

export type FeedInfo = {
    feed: FeedProvider,
    blog: BlogProvider,
    blogName: string
};

const FeedInfoContext = React.createContext<FeedInfo>(undefined as any);

const FeedLoadingFooter = () => {
    return (
        <View
            style={{
                position: 'relative',
                width: "100%",
                height: 100,
                paddingVertical: 20,
                marginTop: 10,
                marginBottom: 10,

                justifyContent: "center",
            }}
        >
            <ActivityIndicator animating size={40}/>
        </View>
    );
};

const style = StyleSheet.create({
    absoluteImage: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
    }
});

const PostImageRenderer = React.memo((props: { image: PostImage, withPreview?: boolean }) => {
    const { visible } = useContext(FeedEntryContext);
    const { blog } = useContext(FeedInfoContext);

    const previewImage = props.image.preview || props.image.detailed;
    if (!previewImage) {
        return (
            <Text>Invalid image!</Text>
        );
    }

    const hqImage = props.image.detailed;
    const [ hqImageLoaded, setHqImageLoaded ] = useState(false);

    let images = [];

    if (!hqImage || previewImage === hqImage) {
        images.push(
            <ImageRenderer
                key={"single"}
                style={{ height: "100%", width: "100%" }}
                source={previewImage}
                resizeMode={"contain"}
                blog={blog}
            />
        );
    } else {
        images.push(
            <ImageRenderer
                key={"preview"}
                style={[ style.absoluteImage, { opacity: AppSettings.getValue(Setting.PreviewOpacity) } ]}
                source={previewImage}
                resizeMode={"contain"}
                blog={blog}
            />
        );
    }

    if (visible) {
        images.push(
            <ImageRenderer
                key={"hq"}
                style={[ style.absoluteImage, { opacity: hqImageLoaded ? 1 : 0 } ]}
                source={hqImage}
                resizeMode={"contain"}

                onLoad={() => setHqImageLoaded(true)}
                blog={blog}
            />
        );
    }

    let body = (
        <View
            key={"body"}
            style={{ position: "absolute", height: "100%", width: "100%" }}
        >
            {images}
        </View>
    );

    if (props.withPreview) {
        return (
            <TouchableWithoutFeedback
                key={"touch"}
                onPress={() => {
                    if (!props.withPreview) {
                        return;
                    }

                    /* TODO: Render a <ImagePreview /> ! */
                    //setImagePreview(hqImage || previewImage);
                }}
            >
                {body}
            </TouchableWithoutFeedback>
        );
    } else {
        return body;
    }
});

const FeedEntryImageRenderer = React.memo(() => {
    const { item, itemHeight } = useContext(FeedEntryContext);
    if (item.type !== "image") {
        throw "item type must be an image";
    }

    const [ expanded, setExpanded ] = useState(false);

    if (item.images.length === 0) {
        return null;
    } else if (item.images.length === 1) {
        return (
            <View style={{ marginTop: 5, marginBottom: 5, height: itemHeight, width: "100%" }} key={"image-default"}>
                <PostImageRenderer image={item.images[0]} withPreview/>
            </View>
        );
    }

    if (expanded) {
        return (
            <View key={"expanded"}>
                {item.images.map((image, index) => (
                    <View style={{ marginTop: 5, marginBottom: 5, height: itemHeight, width: "100%" }}
                          key={"image-" + index}>
                        <PostImageRenderer image={image} withPreview/>
                    </View>
                ))}
            </View>
        );
    } else {
        return (
            <TouchableHighlight
                style={{
                    marginTop: 5,
                    marginBottom: 5,
                    height: itemHeight,
                    width: "100%",
                    borderWidth: 2,
                    borderColor: "blue",
                    borderRadius: 2
                }}
                key={"image-not-expended"}
                onPress={() => {
                    setExpanded(!expanded);
                    logger.debug("Expending post.");
                }}
            >
                <View style={{
                    height: "100%",
                    width: "100%"
                }}>
                    <PostImageRenderer image={item.images[0]} withPreview={false}/>
                </View>
            </TouchableHighlight>
        );
    }
});

const FeedEntryPHVideoRenderer = React.memo(() => {
    const { item, itemHeight } = useContext(FeedEntryContext);
    if (item.type !== "ph-video") {
        throw "item type must be a ph-video";
    }

    /*
     * FIXME: 1. React native fixup!
     *        2. Play preview video on touch/hover
     */
    const refContainer = useRef<HTMLDivElement>(null);
    return (
        <View style={{ marginTop: 5, marginBottom: 5, height: itemHeight, width: "100%" }} key={"image-default"}>
            <iframe src={`https://www.pornhub.com/embed/${item.viewKey}`} height={"100%"} width={"100%"} frameBorder={0}
                    scrolling={"no"} allowFullScreen={true}/>
        </View>
    );
    // return (
    //     <View style={{ marginTop: 5, marginBottom: 5, height: itemHeight, width: "100%" }} key={"image-default"}>
    //         <WebView
    //             scalesPageToFit={false}
    //             source={{
    //                 uri: `https://www.pornhub.com/embed/${item.viewKey}`
    //             }}
    //         />
    //     </View>
    // );
})

const FeedEntryRenderer = React.memo(() => {
    const { item } = useContext(FeedEntryContext);
    switch (item.type) {
        case "image":
            return (
                <FeedEntryImageRenderer key={item.type}/>
            );

        case "ph-video":
            return (
                <FeedEntryPHVideoRenderer key={item.type}/>
            );

        default:
            return null;
    }
});

export const FeedView = React.memo((props: {
    feed: FeedInfo,
    initialQuery?: string,
    initialPage?: number
}) => {
    logComponentRendered("FeedView");
    return (
        <FeedInfoContext.Provider value={props.feed}>
            <View style={{ height: "100%", width: "100%" }}>
                <TopBarHeader>
                    <SearchBar blog={props.feed.blog} blogName={props.feed.blogName} initialQuery={props.initialQuery}/>
                </TopBarHeader>
                <FeedFlatList initialPage={props.initialPage}/>
            </View>
        </FeedInfoContext.Provider>
    );
});

type LoadDirection = "previous" | "next";

type FeedViewState = {
    initialized: boolean,

    /**
     * Current pages we're viewing.
     * Start and end inclusive.
     */
    currentView: [ start: number, end: number ],

    loading: {
        [K in LoadDirection]: LoadState
    },

    prependedPostCount: number,
    posts: { entry: FeedEntry, page: number }[],

    itemHeight: number,
}

type LoadState = {
    status: "loading" | "inactive" | "no-more-data",
} | {
    status: "error",
    message: string
};

type ViewState = {
    items: { page: number, index: number }[],
    currentPage: number,
    scrolling: boolean,
    updateTimeout: any
};

const FeedFlatList = React.memo((props: { initialPage?: number }) => {
    logComponentRendered("FeedFlatList");
    const { feed } = useContext(FeedInfoContext);
    const navigator = useHistory();

    const [ state, dispatch ] = useObjectReducer<FeedViewState>({
        initialized: false,
        currentView: [ 1, 1 ],

        loading: {
            next: { status: "inactive", },
            previous: { status: "inactive", }
        },

        posts: [],
        prependedPostCount: 0,

        itemHeight: 300
    }, { immer: true })({
        fetch: (prevState, { direction, force }: { direction: "previous" | "next", force?: boolean }) => {
            if (!force) {
                switch (prevState.loading[direction].status) {
                    case "error":
                        /* todo: check if we should load it again */
                        return;

                    case "inactive":
                        /* We can load the previous/next page */
                        break;

                    case "no-more-data":
                    case "loading":
                    default:
                        return;
                }
            }

            logger.info("fetching for %s at %d-%d", direction, prevState.currentView[0], prevState.currentView[1]);
            let targetPage: number;
            if (direction === "previous") {
                targetPage = prevState.currentView[0] - 1;
                if (targetPage < 1) {
                    /* We already reached the start. */
                    /* We have to set the state to inactive since forced might be passed and the state might be loading. */
                    prevState.loading[direction] = { status: "inactive" };
                    return;
                }

                prevState.currentView[0] -= 1;
            } else {
                targetPage = prevState.currentView[1] + 1;
                prevState.currentView[1] += 1;
            }

            prevState.loading[direction] = { status: "loading" };

            /* TODO: Cancel or don't call the callbacks when element unmounted */
            feed.loadPage(targetPage).then(result => {
                dispatch("handleLoadResult", { direction: direction, posts: result, page: targetPage });
            }).catch(error => {
                dispatch("handleLoadError", { direction, error, page: targetPage });
            })
        },
        handleLoadResult: (draft, {
            posts,
            page,
            direction
        }: { posts: FeedEntry[], page: number, direction: LoadDirection }) => {
            if (draft.loading[direction].status !== "loading") {
                return;
            }

            draft.loading[direction] = { status: "inactive" };
            const mappedPosts = posts.map(post => ({ entry: post, page: page }));
            if (direction === "previous") {
                logger.debug("--- Prepending %d items.", mappedPosts.length);
                draft.prependedPostCount += mappedPosts.length;
                draft.posts = [ ...mappedPosts, ...draft.posts ];
            } else {
                logger.debug("--- Appending %d items.", mappedPosts.length);
                draft.posts = [ ...draft.posts, ...mappedPosts ];
            }

            if (posts.length === 0) {
                /*
                 * Seems like an empty page.
                 * This could happen due to some kind of filter.
                 * Just load the next page in that direction.
                 */
                dispatch("fetch", { direction, force: true });
            }
        },
        handleLoadError: (draft, { direction, error }: { page: number, direction: LoadDirection, error: unknown }) => {
            if (draft.loading[direction].status !== "loading") {
                return;
            }

            draft.loading[direction] = { status: "inactive" };
            /* TODO: Proper handling */
            logger.warn("Failed to load %s: %o", direction, error);
        },
        initialize: prevState => {
            if (prevState.initialized) {
                return;
            }

            if (typeof props.initialPage === "number") {
                prevState.currentView = [ props.initialPage, props.initialPage - 1 ];
                logger.info("Initial page: %o", props.initialPage);
            } else {
                prevState.currentView = [ 1, 0 ];
            }

            dispatch("fetch", { direction: "next", force: false });
            prevState.initialized = true;
        },
        setItemHeight: (draft, payload: number) => {
            draft.itemHeight = payload;
        }
    });

    if (!state.initialized) {
        dispatch("initialize");
    }

    const refView = useRef<ViewState>({
        currentPage: 0,
        items: [],
        scrolling: false,
        updateTimeout: 0
    }).current;

    useEffect(() => () => clearTimeout(refView.updateTimeout), []);

    const scheduleHistoryUpdate = () => {
        if (refView.scrolling) {
            /*
             * We don't want to update the page paths since this will lag the page and
             * gives the user an odd feeling when scrolling in that moment.
             */
            return;
        }

        clearTimeout(refView.updateTimeout);
        refView.updateTimeout = setTimeout(() => {
            const currentPath = navigator.location.pathname.split("/");
            if (!currentPath.last?.length) {
                /* in case the path currently ends with a "/" */
                currentPath.pop();
            }

            const currentPage = parseInt(currentPath.last!);
            if (!isNaN(currentPage)) {
                if (currentPage === refView.currentPage) {
                    return;
                }

                /* pop the current page number */
                currentPath.pop();
            }
            currentPath.push(refView.currentPage.toString());
            navigator.replace(currentPath.join("/"));
        }, 250);
    }

    const updateUrlPage = () => {
        if (refView.items.length === 0) {
            return;
        }

        const targetPage = Math.round(
            refView.items.map(item => item.page).reduce((a, b) => a + b, 0) / refView.items.length
        );

        if (refView.currentPage === targetPage) {
            return;
        }

        refView.currentPage = targetPage;
        scheduleHistoryUpdate();
    }
    //ListFooterComponent={state.loading ? FeedLoadingFooter : null}
    return (
        <BidirectionalFlatList
            prependedItemCount={state.prependedPostCount}
            data={state.posts}

            renderItem={({ item, index, visible }) => {
                if(Platform.OS === "web") {
                    /* Update the site URL, so we can start of were we left. */
                    useEffect(() => {
                        if (!visible) {
                            return;
                        }

                        const entry = { index, page: item.page };
                        refView.items.push(entry);
                        updateUrlPage();
                        return () => {
                            const index = refView.items.indexOf(entry);
                            refView.items.splice(index, 1);
                            updateUrlPage();
                        }
                    }, [ item, visible ]);
                }

                return (
                    <FeedEntryContext.Provider
                        value={{
                            item: item.entry,
                            itemHeight: state.itemHeight,
                            index,
                            visible
                        }}
                    >
                        <FeedEntryRenderer/>
                    </FeedEntryContext.Provider>
                );
            }}

            contentContainerStyle={{
                padding: 10
            }}

            onLayout={({ height, width }) => {
                dispatch("setItemHeight", Math.min(height * .8, width));
            }}

            keyExtractor={(item, index) => index.toString()}

            onEndReached={() => {
                dispatch("fetch", { direction: "next", force: false });
            }}
            onEndReachedThreshold={0.1}

            onStartReached={() => {
                dispatch("fetch", { direction: "previous", force: false });
            }}
            onStartReachedThreshold={0.1}

            onScrollToggle={status => {
                refView.scrolling = status;
                if (refView.scrolling) {
                    clearTimeout(refView.updateTimeout);
                } else {
                    scheduleHistoryUpdate();
                }
            }}
        />
    );
});
