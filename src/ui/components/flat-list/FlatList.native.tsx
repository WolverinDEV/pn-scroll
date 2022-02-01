import React, { useCallback, useEffect, useRef, useState } from "react";
import { getLogger, logComponentRendered } from "../../../Log";
import { BidirectionalFlatListProperties, ItemRenderer } from "./index";
import { FlatList } from "@stream-io/flat-list-mvcp";
import { ViewToken } from "react-native";

export type ViewabilityConfig = {
    /**
     * Minimum amount of time (in milliseconds) that an item must be physically viewable before the
     * viewability callback will be fired. A high number means that scrolling through content without
     * stopping will not mark the content as viewable.
     */
    minimumViewTime?: number,

    /**
     * Percent of viewport that must be covered for a partially occluded item to count as
     * "viewable", 0-100. Fully visible items are always considered viewable. A value of 0 means
     * that a single pixel in the viewport makes the item viewable, and a value of 100 means that
     * an item must be either entirely visible or cover the entire viewport to count as viewable.
     */
    viewAreaCoveragePercentThreshold?: number,

    /**
     * Similar to `viewAreaPercentThreshold`, but considers the percent of the item that is visible,
     * rather than the fraction of the viewable area it covers.
     */
    itemVisiblePercentThreshold?: number,

    /**
     * Nothing is considered viewable until the user scrolls or `recordInteraction` is called after
     * render.
     */
    waitForInteraction?: boolean,
};

const ItemRenderWrapper = React.memo((props: {
    renderer: ItemRenderer<any>,
    item: any,
    index: number,
    visible: boolean
}) => {
    return props.renderer({
        item: props.item,
        index: props.index,
        visible: props.visible
    });
}, (prevProps: any, nextProps: any) => {
    /* Only update if something really has changed. */
    for(const key of [
        "renderer",
        "item",
        "index",
        "visible"
    ]) {
        if(prevProps[key] !== nextProps[key]) {
            return false;
        }
    }

    return true;
});

const logger = getLogger("native-bidirectional-flat-list");
export const BidirectionalFlatList = React.memo((props: BidirectionalFlatListProperties<any>) => {
    logComponentRendered("BidirectionalFlatListAny");

    const scrollTopTriggered = useRef<boolean>(true);
    const scrollBottomTriggered = useRef<boolean>(true);
    const [ visibleItems, setVisibleItems ] = useState<number[]>([]);

    useEffect(() => {
        scrollBottomTriggered.current = false;
        scrollTopTriggered.current = false;
    }, [ props.data ]);

    const visibleUpdateTimeout = useRef<any>(undefined);
    const updateVisibleItems = useCallback((info: { viewableItems: Array<ViewToken>; changed: Array<ViewToken> }) => {
        clearTimeout(visibleUpdateTimeout.current);
        visibleUpdateTimeout.current = setTimeout(() => {
            setVisibleItems(info.viewableItems.map(item => item.index!));
        }, 25);
    }, [ ]);

    useEffect(() => {
        return () => clearTimeout(visibleUpdateTimeout.current);
    }, [ ]);

    return (
        <FlatList
            data={props.data}
            renderItem={item => {
                return (
                    <ItemRenderWrapper
                        renderer={props.renderItem}
                        item={item.item}
                        index={item.index}
                        visible={visibleItems.indexOf(item.index) !== -1}
                    />
                )
            }}
            keyExtractor={props.keyExtractor}
            maintainVisibleContentPosition={{
                minIndexForVisible: 0,
            }}

            scrollsToTop={true}

            scrollToOverflowEnabled={true}
            overScrollMode={"always"}

            onEndReached={props.onEndReached}
            onEndReachedThreshold={props.onEndReachedThreshold}

            onRefresh={props.onStartReached}
            refreshing={!props.onStartReached}

            onScroll={event => {
                /* TODO: Implement threshold! */
                const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                if(contentOffset.y < layoutMeasurement.height) {
                    if(!scrollTopTriggered.current && props.onStartReached) {
                        scrollTopTriggered.current = true;
                        props.onStartReached();
                        logger.debug("Trigger start reached");
                    }
                }

                if(contentOffset.y > contentSize.height - layoutMeasurement.height * 2) {
                    if(!scrollBottomTriggered.current && props.onEndReached) {
                        scrollBottomTriggered.current = true;
                        props.onEndReached();
                        logger.debug("Trigger end reached");
                    }
                }

                //logger.info("Scroll: %o", event.nativeEvent);
            }}
            scrollEventThrottle={25}

            onViewableItemsChanged={updateVisibleItems}

            viewabilityConfig={{
                itemVisiblePercentThreshold: 0,
                minimumViewTime: 20,
            } as ViewabilityConfig}

        />
    );
});
