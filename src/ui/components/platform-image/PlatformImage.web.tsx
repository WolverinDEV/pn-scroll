import React from "react";
import { Image } from "react-native";
import {PlatformImageProps} from "./index";

function fn<T>(fn: T | undefined) {
    return fn || (() => {});
}

export const PlatformImageImplementation = React.memo((props: PlatformImageProps) => {
    return (
        <Image
            source={{
                uri: props.source.uri
            }}

            style={props.style}
            resizeMode={props.resizeMode}

            onError={() => fn(props.onError)()}
            onLoadStart={() => fn(props.onLoadStart)()}
            onProgress={e => fn(props.onProgress)(e)}
            onLoad={e => fn(props.onLoad)(e)}
            onLoadEnd={() => fn(props.onLoadEnd)()}
            onLayout={e => fn(props.onLayout)(e)}

            testID={props.testID}
            nativeID={props.nativeID}
        />
    );
});
