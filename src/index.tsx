import {AppRegistry, Platform, StyleProp, ViewStyle} from 'react-native';

import React from 'react';
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
import {SideBar} from "./components/SideBar";
import "./IconSetup";
import "./engine";

namespace Colors {
    export const primary = '#1292B4';
    export const white = '#FFF';
    export const lighter = '#F3F3F3';
    export const light = '#DAE1E7';
    export const dark = '#444';
    export const darker = '#222';
    export const black = '#000';
}

const Section = (props: { title: string, children?: any }): Node => {
    const { children, title } = props;
    const isDarkMode = useColorScheme() === 'dark';
    return (
        <View style={styles.sectionContainer}>
            <Text
                style={[
                    styles.sectionTitle,
                    {
                        color: isDarkMode ? Colors.white : Colors.black,
                    },
                ]}>
                {title}
            </Text>
            <Text
                style={[
                    styles.sectionDescription,
                    {
                        color: isDarkMode ? Colors.light : Colors.dark,
                    },
                ]}>
                {children}
            </Text>
        </View>
    );
};

const App: () => Node = () => {
    const isDarkMode = useColorScheme() === 'dark';

    const backgroundStyle: StyleProp<ViewStyle> = {
        backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
        height: Platform.OS === "web" ? "100vh" : "100%"
    };

    return (
        <Provider store={AppStore}>
            <SafeAreaView style={backgroundStyle}>
                <SideBar renderer={() => <Text>Hello World</Text>}>
                    <View style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center"
                    }}>
                        <Text>Page A</Text>
                    </View>
                </SideBar>
            </SafeAreaView>
        </Provider>
    );
};

const styles = StyleSheet.create({
    sectionContainer: {
        marginTop: 32,
        paddingHorizontal: 24,
        textAlign: "center"
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: '600',
    },
    sectionDescription: {
        marginTop: 8,
        fontSize: 18,
        fontWeight: '400',
    },
    highlight: {
        fontWeight: '700',
    },
});

AppRegistry.registerComponent("pn-scroll", () => App);


{
    const rootTag = document.createElement("div");
    document.body.append(rootTag);

    AppRegistry.runApplication("pn-scroll", {
        initialProps: {},
        rootTag: rootTag,
    });
}

