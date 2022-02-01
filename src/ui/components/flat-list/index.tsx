import React from "react";
import { LayoutRectangle, StyleProp, ViewStyle } from "react-native";
import { BidirectionalFlatList as Implementation } from "./FlatList";

export type ItemRenderer<ItemT> = (props: { item: ItemT, index: number, visible: boolean }) => React.ReactElement;
export type BidirectionalFlatListProperties<ItemT> = {
    data: ReadonlyArray<ItemT>;
    renderItem: ItemRenderer<ItemT>;
    contentContainerStyle?: StyleProp<ViewStyle> | undefined;


    onLayout?: ((newLayout: LayoutRectangle) => void) | undefined;
    keyExtractor?: ((item: ItemT, index: number) => string) | undefined;

    onStartReached?: (() => void) | null | undefined;
    onStartReachedThreshold?: number | null | undefined;

    onEndReached?: (() => void) | null | undefined;
    onEndReachedThreshold?: number | null | undefined;

    onViewableItemsChanged?: ((viewableItems: Array<{ index: number, item: ItemT }>) => void) | null | undefined;
    /* Only available for the Web */
    onScrollToggle?: (isScrolling: boolean) => void;

    viewabilityConfig?: any;
    focusable?: boolean | undefined;

    prependedItemCount?: number,
};

export const BidirectionalFlatList = <ItemT extends unknown>(props: BidirectionalFlatListProperties<ItemT>) => {
    return (
        <Implementation {...props} />
    );
}
