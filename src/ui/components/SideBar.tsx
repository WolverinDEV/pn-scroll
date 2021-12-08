import React, {useEffect, useState} from "react";
import {
    StyleSheet,
    TouchableWithoutFeedback,
    View,
    Animated,
    Text,
    TouchableNativeFeedback,
    Platform, TouchableHighlight
} from "react-native";
import {Easing} from "../Animations";
import {AppStore, useAppSelector} from "../../AppState";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {useAnimation} from "../hooks/UseAnimation";
import {HoverAnimatedView} from "./Hoverable";
import {useHistory} from "react-router-native";
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
        toggle: (state, action: PayloadAction<boolean | undefined>) => {
            state.visible = typeof action.payload === "boolean" ? action.payload : !state.visible;
        }
    }
});

export const sidebarReducer = sidebarSlice.reducer;
export const toggleSideBar = (visible?: boolean) => AppStore.dispatch(sidebarSlice.actions.toggle(visible));

export const SideBar = React.memo((props: {
    children?: React.ReactChild | React.ReactChild[],
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
                <TouchableWithoutFeedback onPress={() => {
                    if(!visible) {
                        return;
                    }

                    toggleSideBar(false);
                }}>
                    <View style={style.innerBody} pointerEvents={visible ? "box-only" : "auto"}>
                        {props.children}
                    </View>
                </TouchableWithoutFeedback>
            </Animated.View>
        </View>
    )
});

const SideBarRenderer = React.memo(() => {
    const activeBlogs = useAppSelector(state => state.blogRegistry.activeBlogs);
    const navigate = useHistory();

    return (
        <React.Fragment>
            <SideBarEntry icon={"rocket"} onPress={() => navigate.push("/test")}>
                Go to Test
            </SideBarEntry>
            <SideBarEntry icon={"image"}>
                Blogs
            </SideBarEntry>
            <React.Fragment>
                {activeBlogs.map(blog => (
                    <SideBarEntry icon={"image"} key={"blog-" + blog} onPress={() => navigate.push("/feed/" + blog + "/")}>
                        {blog}
                    </SideBarEntry>
                ))}
            </React.Fragment>
            <View style={{ flex: 1 }} />
            <SideBarEntry icon={"cogs"} onPress={() => navigate.push("/settings")}>
                Settings
            </SideBarEntry>
        </React.Fragment>
    );
});

const SideBarEntry = (props: { children?: React.ReactNode, icon: string, onPress?: () => void }) => {
    const TouchableWithFeedback = Platform.select({
        web: TouchableWithoutFeedback as any,
        android: TouchableNativeFeedback,
        default: TouchableHighlight
    });

    return (
        <TouchableWithFeedback
            onPress={() => {
                toggleSideBar(false);

                if(props.onPress) {
                    props.onPress();
                }
            }}
        >
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
                <Text style={style.menuEntryText}>{props.children}</Text>
            </HoverAnimatedView>
        </TouchableWithFeedback>
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
        paddingLeft: 15,
        paddingRight: 15,
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
        shadowRadius: 5,
    },
    innerBody: {
        height: "100%",
        width: "100%",
    }
});
