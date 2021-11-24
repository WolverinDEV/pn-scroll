import {
    FeedPost,
    FeedProvider, ImageLoadResult,
    PostImage,
    PostImageInfo,
} from "../../engine";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text, TouchableHighlight, TouchableWithoutFeedback,
    View,
    ViewabilityConfig,
    ViewToken,
} from "react-native";
import {useObjectReducer} from "../hooks/ObjectReducer";
import {AppSettings, Setting} from "../../Settings";
import {PlatformImage, PlatformImageProps} from "./platform-image";
import {createItemCache} from "../../engine/cache/Cache";
import {MemoryCacheResolver} from "../../engine/cache/CacheResolver";
import {PostImageRenderer} from "./PostImage";
import {setImagePreview} from "./ImageDetailedView";

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

const FeedPostImageRenderer = React.memo((props: { image: PostImage, viewObserver: ViewObserver, itemId: number }) => {
    const [ visible, setVisible ] = useState(false);
    useEffect(() => {
        const callback = () => setVisible(props.viewObserver.viewableItems.indexOf(props.itemId) !== -1);
        props.viewObserver.callbackChanged.push(callback);
        return () => {
            const index = props.viewObserver.callbackChanged.indexOf(callback);
            if(index !== -1) {
                props.viewObserver.callbackChanged.splice(index, 1);
            }
        }
    }, [ setVisible ]);

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
            />
        );
    } else {
        images.push(
            <PostImageRenderer
                key={"preview"}
                style={[style.absoluteImage, { opacity: AppSettings.getValue(Setting.PreviewOpacity) }]}
                source={previewImage}
                resizeMode={"contain"}
            />
        );
    }

    if(visible) {
        images.push(
            <PostImageRenderer
                key={"hq"}
                style={[style.absoluteImage, { opacity: hqImageLoaded ? 1 : 0 }]}
                source={hqImage}
                resizeMode={"contain"}

                onLoad={() => setHqImageLoaded(true)}
            />
        );
    }

    return (
        <TouchableWithoutFeedback
            onPress={() => {
                setImagePreview(hqImage || previewImage);
            }}
        >
            <View
                style={{ position: "absolute", height: "100%", width: "100%" }}
            >
                {images}
            </View>
        </TouchableWithoutFeedback>
    )
});

type FeedViewState = {
    page: number,
    loading: boolean,
    initialized: boolean,
    posts: FeedPost[],
    itemHeight: number,
}

type ViewObserver = {
    timeoutId: any | undefined,
    viewableItems: number[],
    callbackChanged: (() => void)[],
}

const FeedViewEntryRender = React.memo((props: { item: FeedPost, index: number, itemHeight: number, viewObserver: ViewObserver }) => {
    const [ expanded, setExpanded ] = useState(false);
    if(props.item.type !== "image") {
        return null;
    }

    if(props.item.images.length === 0) {
        return null;
    } else if(props.item.images.length === 1) {
        return (
            <View style={{ marginTop: 5, marginBottom: 5, height: props.itemHeight, width: "100%" }} key={"image-default"}>
                <FeedPostImageRenderer image={props.item.images[0]} viewObserver={props.viewObserver} itemId={props.index} />
            </View>
        );
    }

    if(expanded) {
        return (
            <View key={"expanded"}>
                {props.item.images.map((image, index) => (
                    <View style={{ marginTop: 5, marginBottom: 5, height: props.itemHeight, width: "100%" }} key={"image-" + index}>
                        <FeedPostImageRenderer image={image} viewObserver={props.viewObserver} itemId={props.index} />
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
                onPress={() => setExpanded(!expanded)}
            >
                <FeedPostImageRenderer image={props.item.images[0]} viewObserver={props.viewObserver} itemId={props.index} />
            </TouchableHighlight>
        );
    }
});

export const FeedView = React.memo((props: {
    provider: FeedProvider
}) => {
    const viewObserver = useRef<ViewObserver>({ callbackChanged: [], viewableItems: [], timeoutId: undefined }).current;

    const [ state, dispatch ] = useObjectReducer<FeedViewState>({
        page: 0,
        loading: false,
        initialized: false,
        posts: [],
        itemHeight: 300
    }, { immer: true })({
        fetchNext: prevState => {
            if(prevState.loading) {
                return;
            }

            prevState.loading = true;
            prevState.page += 1;

            /* TODO: Cancel or don't call the callbacks when element unmounted */
            props.provider.loadPage(prevState.page).then(result => {
                dispatch("handleFetchPosts", result);
            }).catch(error => {

            })
        },
        handleFetchPosts: (prevState, posts: FeedPost[]) => {
            prevState.posts.push(...posts);
            prevState.loading = false;
        },
        handleFetchError: (draft, error: string) => {
            draft.loading = false;
            /* TODO? */
        },
        initialize: prevState => {
            if(prevState.initialized) {
                return;
            }

            prevState.initialized = true;
            dispatch("fetchNext");
        },
        setItemHeight: (draft, payload: number) => {
            draft.itemHeight = payload;
        }
    });

    if(!state.initialized) {
        dispatch("initialize");
    }

    const viewabilityConfig: ViewabilityConfig = {
        minimumViewTime: 0,
        itemVisiblePercentThreshold: 0
    };

    const onViewableItemsChanged = useCallback((info: { viewableItems: Array<ViewToken>; changed: Array<ViewToken> }) => {
        clearTimeout(viewObserver.timeoutId);
        viewObserver.timeoutId = setTimeout(() => {
            viewObserver.viewableItems = info.viewableItems.map(item => item.index!);
            [...viewObserver.callbackChanged].forEach(callback => callback());
        }, 100);
    }, []);

    return (
        <FlatList
            contentContainerStyle={{
                padding: 10
            }}
            onLayout={event => {
                const { height, width } = event.nativeEvent.layout;
                dispatch("setItemHeight", Math.min(height * .8, width));
            }}
            data={state.posts}
            renderItem={({ item, index }) => (<FeedViewEntryRender item={item} index={index} itemHeight={state.itemHeight} viewObserver={viewObserver} />)}
            keyExtractor={(item, index) => index.toString()}
            onEndReached={() => dispatch("fetchNext")}
            onEndReachedThreshold={0.1}
            ListFooterComponent={state.loading ? FeedLoadingFooter : null}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}

            focusable={true}
        />
    );
});
