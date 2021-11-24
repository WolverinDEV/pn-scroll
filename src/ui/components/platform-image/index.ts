import {
    AccessibilityProps, ColorValue, FlexStyle,
    ImageResizeMode,
    LayoutChangeEvent, ShadowStyleIOS, StyleProp, TransformsStyle,
} from "react-native";
import type { OnProgressEvent } from "react-native-fast-image";

export interface PlatformImageStyle extends FlexStyle, ShadowStyleIOS, TransformsStyle {
    backfaceVisibility?: 'visible' | 'hidden' | undefined;
    borderBottomLeftRadius?: number | undefined;
    borderBottomRightRadius?: number | undefined;
    backgroundColor?: ColorValue | undefined;
    borderColor?: ColorValue | undefined;
    borderWidth?: number | undefined;
    borderRadius?: number | undefined;
    borderTopLeftRadius?: number | undefined;
    borderTopRightRadius?: number | undefined;
    overflow?: 'visible' | 'hidden' | undefined;
    overlayColor?: ColorValue | undefined;
    tintColor?: ColorValue | undefined;
    opacity?: number | undefined;
}

interface OnLoadEvent {
    nativeEvent: {
        source: {
            height: number;
            width: number;
            uri: string;
        };
    };
}

export type PlatformImageSource = {
    uri: string,
    /* TODO: More props? */
}

export interface PlatformImageProps extends AccessibilityProps {
    source: PlatformImageSource;

    style?: StyleProp<PlatformImageStyle>,
    resizeMode?: ImageResizeMode | undefined;

    onError?: () => void;
    onLoadStart?: () => void;
    onProgress?: (event: OnProgressEvent) => void;
    onLoad?: (event: OnLoadEvent) => void;
    onLoadEnd?: () => void;
    onLayout?: (event: LayoutChangeEvent) => void;

    testID?: string | undefined;
    nativeID?: string | undefined;
}

/* Forwarding the appropriate implementation */
import { PlatformImageImplementation } from "./PlatformImage";
export const PlatformImage = PlatformImageImplementation;
export default PlatformImageImplementation;

