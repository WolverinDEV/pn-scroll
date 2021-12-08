import {
    BlogProvider,
    FeedEntry,
    FeedProvider,
    PostImage,
} from "../../engine";
import React, {useCallback, useContext, useEffect, useRef, useState} from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text, TouchableHighlight, TouchableWithoutFeedback,
    View,
    ViewabilityConfig,
    ViewToken,
} from "react-native";
import {useObjectReducer} from "../hooks/ObjectReducer";
import {AppSettings, Setting} from "../../Settings";
import {PostImageRenderer} from "./PostImage";
import {SearchBar} from "./SearchBar";
import {TopBarHeader} from "./TopBar";
import {useHistory, useParams} from "react-router-native";
import {BidirectionalFlatList} from "./flat-list";

type FeedInfo = {
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
            <ActivityIndicator animating size={40} />
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

const FeedPostImageRenderer = React.memo((props: { image: PostImage, itemId: number, visible: boolean, withPreview?: boolean }) => {
    const { blog } = useContext(FeedInfoContext);

    const previewImage = props.image.preview || props.image.detailed;
    if(!previewImage) {
        return (
            <Text>Invalid image!</Text>
        );
    }

    const hqImage = props.image.detailed;
    const [ hqImageLoaded, setHqImageLoaded ] = useState(false);

    let images = [];

    if(!hqImage || previewImage === hqImage) {
        images.push(
            <PostImageRenderer
                key={"single"}
                style={{ height: "100%", width: "100%" }}
                source={previewImage}
                resizeMode={"contain"}
                blog={blog}
            />
        );
    } else {
        images.push(
            <PostImageRenderer
                key={"preview"}
                style={[style.absoluteImage, { opacity: AppSettings.getValue(Setting.PreviewOpacity) }]}
                source={previewImage}
                resizeMode={"contain"}
                blog={blog}
            />
        );
    }

    if(props.visible) {
        images.push(
            <PostImageRenderer
                key={"hq"}
                style={[style.absoluteImage, { opacity: hqImageLoaded ? 1 : 0 }]}
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

    if(props.withPreview) {
        return (
            <TouchableWithoutFeedback
                key={"touch"}
                onPress={() => {
                    if(!props.withPreview) {
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

const FeedViewEntryRender = React.memo((props: { item: FeedEntry, visible: boolean, index: number, itemHeight: number }) => {
    const [ expanded, setExpanded ] = useState(false);
    if(props.item.type !== "image") {
        return null;
    }

    if(props.item.images.length === 0) {
        return null;
    } else if(props.item.images.length === 1) {
        return (
            <View style={{ marginTop: 5, marginBottom: 5, height: props.itemHeight, width: "100%" }} key={"image-default"}>
                <FeedPostImageRenderer image={props.item.images[0]} visible={props.visible} itemId={props.index} withPreview />
            </View>
        );
    }

    if(expanded) {
        return (
            <View key={"expanded"}>
                {props.item.images.map((image, index) => (
                    <View style={{ marginTop: 5, marginBottom: 5, height: props.itemHeight, width: "100%" }} key={"image-" + index}>
                        <FeedPostImageRenderer image={image} visible={props.visible} itemId={props.index} withPreview />
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
                    height: props.itemHeight,
                    width: "100%",
                    borderWidth: 2,
                    borderColor: "blue",
                    borderRadius: 2
                }}
                key={"image-not-expended"}
                onPress={() => {
                    setExpanded(!expanded);
                    console.error("XXX");
                }}
            >
                <View style={{
                    height: "100%",
                    width: "100%"
                }}>
                    <FeedPostImageRenderer image={props.item.images[0]} visible={props.visible} itemId={props.index} withPreview={false} />
                </View>
            </TouchableHighlight>
        );
    }
});

export const FeedView = React.memo((props: {
    feed: FeedInfo,
    initialQuery?: string
}) => {
    return (
        <FeedInfoContext.Provider value={props.feed}>
            <View style={{ height: "100%", width: "100%" }}>
                <TopBarHeader>
                    <SearchBar blog={props.feed.blog} blogName={props.feed.blogName} initialQuery={props.initialQuery} />
                </TopBarHeader>
                <FeedFlatList />
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
    currentView: [start: number, end: number],

    loading: {
        [K in LoadDirection]: LoadState
    },

    posts: { entry: FeedEntry, page: number }[],
    itemHeight: number,
}

type LoadState = {
    status: "loading" | "inactive" | "no-more-data",
} | {
    status: "error",
    message: string
};

const FeedFlatList = React.memo(() => {
    const { feed } = useContext(FeedInfoContext);

    const navigator = useHistory();
    const { page: initialPage } = useParams<{ page?: string }>();

    const [ state, dispatch ] = useObjectReducer<FeedViewState>({
        initialized: false,
        currentView: [1, 1],

        loading: {
            next: { status: "inactive", },
            previous: { status: "inactive", }
        },

        posts: [],
        itemHeight: 300
    }, { immer: true })({
        fetch: (prevState, { direction, force }: { direction: "previous" | "next", force?: boolean }) => {
            if(!force) {
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

            console.info("fetching for %s at %d-%d", direction, prevState.currentView[0], prevState.currentView[1]);
            let targetPage: number;
            if(direction === "previous") {
                targetPage = prevState.currentView[0] - 1;
                if(targetPage < 1) {
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
        handleLoadResult: (draft, { posts, page, direction }: { posts: FeedEntry[], page: number, direction: LoadDirection }) => {
            if(draft.loading[direction].status !== "loading") {
                return;
            }

            draft.loading[direction] = { status: "inactive" };
            const mappedPosts = posts.map(post => ({ entry: post, page: page }));
            if(direction === "previous") {
                draft.posts = [...mappedPosts, ...draft.posts];
            } else {
                draft.posts = [...draft.posts, ...mappedPosts];
            }

            if(posts.length === 0) {
                /*
                 * Seems like an empty page.
                 * This could happen due to some kind of filter.
                 * Just load the next page in that direction.
                 */
                dispatch("fetch", { direction, force: true });
            }
        },
        handleLoadError: (draft, { direction, error }: { page: number, direction: LoadDirection, error: unknown }) => {
            if(draft.loading[direction].status !== "loading") {
                return;
            }

            draft.loading[direction] = { status: "inactive" };
            /* TODO: Proper handling */
            console.warn("Failed to load %s: %o", direction, error);
        },
        initialize: prevState => {
            if(prevState.initialized) {
                return;
            }

            let initialPageNumber = parseInt(initialPage || "");
            if(!isNaN(initialPageNumber)) {
                prevState.currentView = [ initialPageNumber + 1, initialPageNumber ];
                console.error("Initial page: %o", initialPageNumber);
            } else {
                prevState.currentView = [ 2, 1 ];
            }

            dispatch("fetch", { direction: "previous", force: false });
            prevState.initialized = true;
        },
        setItemHeight: (draft, payload: number) => {
            draft.itemHeight = payload;
        }
    });

    if(!state.initialized) {
        dispatch("initialize");
    }

    //ListFooterComponent={state.loading ? FeedLoadingFooter : null}
    return (
        <BidirectionalFlatList
            data={state.posts}
            renderItem={({ item, index, visible }) => (
                <FeedViewEntryRender
                    item={item.entry}
                    index={index}
                    itemHeight={state.itemHeight}
                    visible={visible}
                />
            )}


            contentContainerStyle={{
                padding: 10
            }}

            onLayout={({ height, width }) => {
                dispatch("setItemHeight", Math.min(height * .8, width));
            }}

            keyExtractor={(item, index) => index.toString()}

            onEndReached={() => { dispatch("fetch", { direction: "next", force: false }); }}
            onEndReachedThreshold={0.1}

            onStartReached={() => { dispatch("fetch", { direction: "previous", force: false }); }}
            onStartReachedThreshold={0.1}

            onViewableItemsChanged={items => {
                if(items.length === 0) {
                    return;
                }

                const page = Math.round(items.map(item => item.item.page).reduce((previousValue, currentValue) => previousValue + currentValue, 0) / items.length);

                const path = navigator.location.pathname.split("/");
                if(path[path.length - 1].length === 0) {
                    path.pop();
                }

                if(parseInt(path[path.length - 1])) {
                    path.pop();
                }
                path.push(page.toString());
                navigator.replace(path.join("/"));
            }}
        />
    );
});
