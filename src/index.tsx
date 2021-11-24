import {AppRegistry, Platform, StyleProp, View, ViewStyle} from 'react-native';
import React from 'react';
import type { ReactElement as Node } from 'react';
import {Provider} from "react-redux";
import {AppStore} from "./AppState";
import {AppView} from "./ui";
import {AppRouter} from "./ui/Router";
import "./declarations";
import {ImageDetailedViewHook} from "./ui/components/ImageDetailedView";
import { SafeAreaProvider } from 'react-native-safe-area-context';

namespace Colors {
    export const primary = '#1292B4';
    export const white = '#FFF';
    export const lighter = '#F3F3F3';
    export const light = '#DAE1E7';
    export const dark = '#444';
    export const darker = '#222';
    export const black = '#000';
}

const App: () => Node = () => {
    const backgroundStyle: StyleProp<ViewStyle> = {
        backgroundColor: Colors.darker,
        height: Platform.OS === "web" ? "100vh" : "100%",
        position: "relative"
    };

    return (
        <Provider store={AppStore}>
            <AppRouter>
                <SafeAreaProvider>
                    <View style={backgroundStyle}>
                        <AppView />
                    </View>
                </SafeAreaProvider>
                <ImageDetailedViewHook />
            </AppRouter>
        </Provider>
    );
};

AppRegistry.registerComponent("pn-scroll", () => App);

if(Platform.OS === "web") {
    const rootTag = document.createElement("div");
    document.body.append(rootTag);

    AppRegistry.runApplication("pn-scroll", {
        initialProps: {},
        rootTag: rootTag,
    });
}
