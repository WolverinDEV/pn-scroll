import React from "react";
import {PlatformImageProps} from "./index";
import FastImage, { ResizeMode as FastResizeMode } from "react-native-fast-image";

function fn<T>(fn: T | undefined) {
    return fn || (() => {});
}

export const PlatformImageImplementation = React.memo((props: PlatformImageProps) => {
    let resizeMode: FastResizeMode | undefined;

    if(props.resizeMode) {
        switch (props.resizeMode) {
            case "center":
            case "contain":
            case "cover":
            case "stretch":
                resizeMode = props.resizeMode;
                break;

            case "repeat":
                console.error("Image resize mode %s is not supported by this implementation. Fall back to contain.", props.resizeMode);
                resizeMode = "contain";
                break;

            default:
                console.warn("Invalid image resize mode: %s", props.resizeMode);
                break;
        }
    }

    return (
        <FastImage
            source={{
                uri: props.source.uri,
            }}

            style={props.style as any}
            resizeMode={resizeMode}

            onError={() => fn(props.onError)()}
            onLoadStart={() => fn(props.onLoadStart)()}
            onProgress={e => fn(props.onProgress)(e)}
            onLoad={e => fn(props.onLoad)({
                nativeEvent: {
                    source: {
                        height: e.nativeEvent.height,
                        width: e.nativeEvent.width,
                        uri: props.source.uri
                    }
                }
            })}
            onLoadEnd={() => fn(props.onLoadEnd)()}
            onLayout={e => fn(props.onLayout)(e)}

            testID={props.testID}
            nativeID={props.nativeID}
        />
    );
});
