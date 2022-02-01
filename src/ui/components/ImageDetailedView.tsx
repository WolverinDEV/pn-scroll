import React from "react";
import { StyleSheet, TouchableWithoutFeedback, View } from "react-native";
import { ImageRenderer } from "./PostImage";
import { Portal, PortalHost } from "@gorhom/portal";
import { BlogProvider } from "../../engine";
import { ImageInfo } from "../../engine/types/PostImage";

export const ImagePreview = React.memo((props: { image: ImageInfo, blog: BlogProvider }) => {
    return (
        <Portal hostName={"preview-image"}>
            <TouchableWithoutFeedback onPress={() => {
                console.info("Close preview!");
            }}>
                <View style={style.outerContainer}>
                    <ImageRenderer source={props.image} blog={props.blog} style={{ height: "100%", width: "100%" }}
                                   resizeMode={"contain"}/>
                </View>
            </TouchableWithoutFeedback>
        </Portal>
    );
});

export const ImageDetailedViewHook = React.memo(() => {
    return (
        <PortalHost name={"preview-image"}/>
    );
});

const style = StyleSheet.create({
    outerContainer: {
        position: "absolute",

        top: 0,
        left: 0,
        right: 0,
        bottom: 0,

        backgroundColor: "#ff0000",
        zIndex: 100
    },
    container: {
        width: 300,
        height: 300,
        backgroundColor: "#00ff00"
    }
});
