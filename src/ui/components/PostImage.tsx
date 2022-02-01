import React, { useEffect, useState } from "react";
import { createItemCache } from "../../engine/cache/Cache";
import { MemoryCacheResolver } from "../../engine/cache/CacheResolver";
import { PlatformImage, PlatformImageProps } from "./platform-image";
import { BlogProvider } from "../../engine";
import { ImageInfo, ImageLoadResult } from "../../engine/types/PostImage";

const imageCache = createItemCache<{ info: ImageInfo, blog: BlogProvider }, ImageLoadResult>(
    key => key.info.identifier,
    [
        /* We only use the mem cache so we don't have to load the image from a file or something. */
        new MemoryCacheResolver(60),
        async key => {
            return {
                status: "cache-hit",
                value: await key.blog.loadImage(key.info),
            };
        }
    ]
);
const kImageDownloadUnavailable: ImageLoadResult = {
    status: "failure",
    message: "download unavailable",
    recoverable: false
};

export const ImageRenderer = React.memo((props: { source: ImageInfo, blog: BlogProvider } & Omit<PlatformImageProps, "source">) => {
    const [ imageUri, setImageUri ] = useState<string | null>(null);

    useEffect(() => {
        const refAbort: {
            aborted: boolean,
            unloadCallback?: () => void
        } = {
            aborted: false,
            unloadCallback: undefined
        };

        imageCache.resolve({
            info: props.source,
            blog: props.blog
        }, { defaultValue: kImageDownloadUnavailable }).then(result => {
            if (refAbort.aborted) {
                if (result.status === "success") {
                    result.unload();
                }

                return;
            }

            if (result.status === "success") {
                setImageUri(result.imageUri);
                refAbort.unloadCallback = result.unload;
            } else if (props.onError) {
                props.onError();
            }
        });

        return () => {
            refAbort.aborted = true;
            if (refAbort.unloadCallback) {
                refAbort.unloadCallback();
            }
        };
    }, []);

    if (imageUri) {
        return (
            <PlatformImage
                {...props}
                source={{
                    uri: imageUri,
                }}
            />
        );
    } else {
        /* TODO: Detect state (loading/error) and display that stuff somehow. */
        return null;
    }
})
