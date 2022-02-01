import React, { useEffect, useRef, useState } from "react";
import { v4 as guuid } from "uuid";
import { getLogger, logComponentRendered } from "../../../Log";
import { Virtuoso } from "react-virtuoso";
import { BidirectionalFlatListProperties, ItemRenderer } from "./index";

const useItemId = () => {
    const itemId = useRef<string | null>(null);
    if (itemId.current === null) {
        itemId.current = guuid();
    }
    return itemId.current;
}

type IntersectionObserverCallbacks = { [key: string]: (inView: boolean) => void };
const IntersectionObserverInstances: Map<HTMLElement, {
    observer: IntersectionObserver,
    refCount: number,
    callbacks: IntersectionObserverCallbacks,
}> = new Map();
const ItemRenderWrapper = React.memo((props: { renderer: ItemRenderer<any>, item: any, index: number }) => {
    const itemId = useItemId();
    const ref = useRef<HTMLDivElement>(null);
    const [ visible, setVisible ] = useState(false);

    useEffect(() => {
        if (!ref.current) {
            return;
        }

        let rootElement: HTMLElement | null = ref.current;
        while (rootElement) {
            if (rootElement.style.height === "100%" && rootElement.style.position === "relative") {
                break;
            }

            rootElement = rootElement.parentElement;
        }

        if (!rootElement) {
            return;
        }

        let instance = IntersectionObserverInstances.get(rootElement);
        if (!instance) {
            const callbacks: IntersectionObserverCallbacks = {};
            instance = {
                callbacks: callbacks,
                observer: new IntersectionObserver(entries => {
                    logger.info("IntersectionObserver triggered for %d entries.", entries.length);
                    for (const entry of entries) {
                        const id = entry.target.getAttribute("x-observe-id") || "";
                        const callback = callbacks[id];
                        if (!callback) {
                            continue;
                        }

                        callback(entry.isIntersecting);
                    }
                }, { root: rootElement }),
                refCount: 0,
            };
        }

        instance.refCount++;
        instance.observer.observe(ref.current);
        instance.callbacks[itemId] = setVisible;

        return () => {
            instance = instance!;

            delete instance.callbacks[itemId];
            if (--instance.refCount === 0) {
                instance.observer.disconnect();
            } else if (ref.current) {
                instance.observer.unobserve(ref.current);
            }
        }
    }, [ itemId, setVisible ]);

    const children = props.renderer({ item: props.item, index: props.index, visible });
    return (
        <div ref={ref} x-observe-id={itemId}>
            {children}
        </div>
    )
});

const kInverseInfinityOffset = 1e11;
const logger = getLogger("web-bidirectional-flat-list");
export const BidirectionalFlatList = React.memo((props: BidirectionalFlatListProperties<any>) => {
    logComponentRendered("BidirectionalFlatListAny");

    const {
        data,
        renderItem,
        keyExtractor,
        onViewableItemsChanged,
        onLayout,
    } = props;

    const [ refScroll, setRefScroll ] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (!refScroll) {
            return;
        }

        /* FIXME: Update/change listener! */
        const rect = refScroll!.getBoundingClientRect();
        if (onLayout) {
            onLayout({
                height: rect.height,
                width: rect.width,
                x: rect.x,
                y: rect.y
            });
        }
    }, [ refScroll ]);

    if (props.data.length === 0) {
        return null;
    }

    const prependedItemCount = typeof props.prependedItemCount === "number" ? props.prependedItemCount : 0;

    /* Virtuoso lists work from the bottom up */
    return (
        <Virtuoso
            firstItemIndex={kInverseInfinityOffset - prependedItemCount}

            data={props.data}
            itemContent={(index, data) => (
                <ItemRenderWrapper
                    index={index - kInverseInfinityOffset + prependedItemCount}
                    item={data}
                    renderer={renderItem}
                />
            )}

            endReached={() => {
                props.onEndReached?.();
                logger.info("endReached");
            }}
            startReached={() => {
                props.onStartReached?.();
                logger.info("startReached");
            }}

            rangeChanged={({ startIndex, endIndex }) => {
                if (!onViewableItemsChanged) {
                    return;
                }

                let mappedStartIndex = startIndex - kInverseInfinityOffset + prependedItemCount;
                let mappedEndIndex = endIndex - kInverseInfinityOffset + prependedItemCount;
                logger.info("Original { start: %d, end: %d }, Mapped: { start: %d, end: %d }, Offset: %d", startIndex, endIndex, mappedStartIndex, mappedEndIndex, prependedItemCount);

                /* the range includes all over scan items as well! */

                const visibleItems: { index: number, item: any }[] = [];
                for (let index = mappedStartIndex; index < mappedEndIndex; index++) {
                    if (index >= data.length || index < 0) {
                        continue;
                    }

                    visibleItems.push({
                        index,
                        item: data[index]
                    });
                }
                /* FIXME! */
                //onViewableItemsChanged(visibleItems);
            }}
            computeItemKey={keyExtractor ? (index, item) => keyExtractor(item, index) : undefined}

            //increaseViewportBy={3200}
            scrollerRef={ref => {
                if (!ref) {
                    return;
                }

                if (ref instanceof HTMLElement) {
                    setRefScroll(ref);

                    ref.tabIndex = 1;
                    ref.onclick = () => {
                        ref.focus();
                    };
                }
            }}

            isScrolling={props.onScrollToggle}
        />
    );
});
