import React, {useEffect, useState} from "react";
import {StyleSheet, TouchableWithoutFeedback, View, Animated, Text} from "react-native";
import {Easing} from "../Animations";
import {AppStore, useAppSelector} from "../AppState";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {useAnimation} from "../hooks/UseAnimation";
import {HoverAnimatedView} from "./Hoverable";
import Icon from "react-native-vector-icons/FontAwesome";

type SidebarState = {
    visible: boolean
}

const InitialSidebarState: SidebarState = {
    visible: false
};

export const sidebarSlice = createSlice({
    name: "sidebar",
    initialState: InitialSidebarState,
    reducers: {
        toggle: (state, action: PayloadAction<boolean>) => {
            state.visible = action.payload;
        }
    }
});

export const sidebarReducer = sidebarSlice.reducer;
export const toggleSideBar = (visible: boolean) => AppStore.dispatch(sidebarSlice.actions.toggle(visible));

export const SideBar = (props: {
    renderer: () => React.ReactElement,
    children?: React.ReactNode | React.ReactNode[],
    width?: number,
    animationDuration?: number
}) => {
    const visible = useAppSelector(state => state.sidebar.visible);

    const width = typeof props.width === "undefined" ? 250 : props.width;
    const showAnimation = useAnimation(Animated.Value, 0);
    const [ sidebarVisible, setSidebarVisible ] = useState(false);

    useEffect(() => {
        if(visible && !sidebarVisible) {
            setSidebarVisible(true);
        }

        const animation = Animated.timing(showAnimation, {
            duration: typeof props.animationDuration === "number" ? props.animationDuration : 200,
            toValue: visible ? width : 0,
            easing: Easing.easeInOut,
            useNativeDriver: false,
        });

        animation.start(() => {
            /* Don't render the sidebar unless we're visible */
            setSidebarVisible(visible);
        });

        return () => animation.stop();
    }, [ visible ]);

    return (
        <View style={style.container}>
            <Animated.View style={[style.menu, { width }]}>
                {(sidebarVisible || visible) && <SideBarRenderer />}
            </Animated.View>
            <Animated.View
                style={[style.body, { left: showAnimation }]}
            >
                <TouchableWithoutFeedback
                    onPress={() => toggleSideBar(!visible)}
                >
                    {props.children}
                </TouchableWithoutFeedback>
            </Animated.View>
        </View>
    )
}

const SideBarRenderer = React.memo(() => {

    return (
        <React.Fragment>
            <SideBarEntry icon={"rocket"}>
                Home
            </SideBarEntry>
            <SideBarEntry icon={"bomb"}>
                Test 1
            </SideBarEntry>
            <SideBarEntry icon={"rocket"}>
                Test 2
            </SideBarEntry>
        </React.Fragment>
    );
});

const SideBarEntry = (props: { children?: React.ReactNode, icon: string }) => {
    return (
        <TouchableWithoutFeedback onPress={() => console.error("PRESS!")}>
            <HoverAnimatedView
                duration={200}
                style={style.menuEntry}
                hoverStyle={hoverAnimation => ({
                    backgroundColor: hoverAnimation.interpolate(
                        [0, 100], ["#ffffff00", "#ffffff1f"]
                    ),
                })}
            >
                <Icon style={style.menuEntryIcon} name={props.icon} size={20} />
                <Text style={style.menuEntryText}>Home</Text>
            </HoverAnimatedView>
        </TouchableWithoutFeedback>
    );
}

const style = StyleSheet.create({
    container: {
        overflow: "hidden",
        height: "100%"
    },
    menu: {
        position: "absolute",
        height: "100%",
        left: 0,
        right: 0,
        zIndex: 0,

        paddingTop: 8,
        paddingBottom: 8,

        display: "flex",
        flexDirection: "column"
    },
    menuEntry: {
        height: 50,
        margin: 10,
        marginTop: 2,
        marginBottom: 2,
        padding: 5,
        paddingLeft: 10,
        paddingRight: 10,
        flexDirection: "row",
        borderRadius: 5,

        cursor: "pointer",
    },
    menuEntryText: {
        fontSize: 18,
        marginLeft: 10,
        alignSelf: "center",
        color: "#fff"
    },
    menuEntryIcon: {
        alignSelf: "center",
        color: "#fff"
    },
    body: {
        position: "absolute",
        height: "100%",
        width: "100%",
        left: 0,
        top: 0,

        shadowColor: "#000",
        shadowOffset: { width: -1, height: 0 },
        shadowOpacity: .5,
        shadowRadius: 5
    }
});
