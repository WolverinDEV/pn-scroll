import {PostImageInfo} from "../../engine";
import React, {useEffect} from "react";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {AppStore, useAppSelector} from "../../AppState";
import {Platform, StyleSheet, Text, TouchableWithoutFeedback, View} from "react-native";
import {PostImageRenderer} from "./PostImage";
import {NativeFunctions} from "../../engine/NativeFunctions";

type ViewState = {
    imageIdentifier: string | null
}

const kInitialViewState: ViewState = {
    imageIdentifier: null
};

const stateSlice = createSlice({
    name: "Image detail view",
    initialState: kInitialViewState,
    reducers: {
        setImage: (state, action: PayloadAction<string | null>) => {
            state.imageIdentifier = action.payload;
        }
    }
});

export const imageDetailedViewReducer = stateSlice.reducer;
export const setImagePreview = (image: PostImageInfo | undefined) => {
    if(image) {
        AppStore.dispatch(stateSlice.actions.setImage(image.identifier));
        currentPreviewImage = image;
    } else {
        currentPreviewImage = undefined;
        AppStore.dispatch(stateSlice.actions.setImage(null));
    }
};

let currentPreviewImage: PostImageInfo | undefined;

export const ImageDetailedViewHook = React.memo(() => {
    const imageIdentifier = useAppSelector(state => state.detailedImage.imageIdentifier);
    if(Platform.OS !== "web") {
        useEffect(() => {
            NativeFunctions.toggleFullScreen(!!imageIdentifier);
        }, [ imageIdentifier ]);
    }

    if(!imageIdentifier || imageIdentifier !== currentPreviewImage?.identifier) {
        return null;
    }

    return (
        <TouchableWithoutFeedback onPress={() => setImagePreview(undefined)}>
            <View style={style.outerContainer}>
                {currentPreviewImage ? (
                    <PostImageRenderer source={currentPreviewImage} style={{ height: "100%", width: "100%" }} resizeMode={"contain"} key={currentPreviewImage.identifier} />
                ) : null}
            </View>
        </TouchableWithoutFeedback>
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
