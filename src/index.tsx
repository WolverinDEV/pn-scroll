import {AppRegistry, Platform, StyleProp, ViewStyle} from 'react-native';

import React, {useEffect, useMemo} from 'react';
import type { ReactElement as Node } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from 'react-native';
import {Provider} from "react-redux";
import {AppStore} from "./AppState";
import "./IconSetup";
import "./engine";
import {AppView} from "./ui";
import "./declarations";
import {AppRouter} from "./ui/Router";
import {executeLoading} from "./AppLoader";

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
        height: Platform.OS === "web" ? "100vh" : "100%"
    };

    return (
        <Provider store={AppStore}>
            <AppRouter>
                <SafeAreaView style={backgroundStyle}>
                    <AppView />
                </SafeAreaView>
            </AppRouter>
        </Provider>
    );
};

AppRegistry.registerComponent("pn-scroll", () => App);

{
    const rootTag = document.createElement("div");
    document.body.append(rootTag);

    AppRegistry.runApplication("pn-scroll", {
        initialProps: {},
        rootTag: rootTag,
    });
}

