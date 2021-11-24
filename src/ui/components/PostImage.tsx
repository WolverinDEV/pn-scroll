import {createItemCache} from "../../engine/cache/Cache";
import {ImageLoadResult, PostImageInfo} from "../../engine";
import {MemoryCacheResolver} from "../../engine/cache/CacheResolver";
import React, {useEffect, useState} from "react";
import {PlatformImage, PlatformImageProps} from "./platform-image";

const imageCache = createItemCache<PostImageInfo, ImageLoadResult>(
    key => key.identifier,
    [
        /*
         * FIXME: Cache timeout 60 seconds or something.
         *        We only use this right now to improve scrolling.
         */
        new MemoryCacheResolver(),
        async key => {
            return {
                status: "cache-hit",
                value: await key.loadImage(),
            };
        }
    ]
);
const kImageDownloadUnavailable: ImageLoadResult = { status: "failure", message: "download unavailable", recoverable: false };

export const PostImageRenderer = React.memo((props: { source: PostImageInfo } & Omit<PlatformImageProps, "source">) => {
    const [ imageUri, setImageUri ] = useState<string | null>(null);

    useEffect(() => {
        const refAbort: {
            aborted: boolean,
            unloadCallback?: () => void
        } = {
            aborted: false,
            unloadCallback: undefined
        };

        imageCache.resolve(props.source, { defaultValue: kImageDownloadUnavailable }).then(result => {
            if(refAbort.aborted) {
                if(result.status === "success") {
                    result.unload();
                }

                return;
            }

            if(result.status === "success") {
                setImageUri(result.imageUri);
                refAbort.unloadCallback = result.unload;
            } else if(props.onError) {
                props.onError();
            }
        });

        return () => {
            refAbort.aborted = true;
            if(refAbort.unloadCallback) {
                refAbort.unloadCallback();
            }
        };
    }, [ ]);

    if(imageUri) {
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
