import React from "react";
import {StyleSheet, TouchableHighlight, View, Text} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {toggleSideBar} from "./SideBar";
import {Portal, PortalHost} from "@gorhom/portal";

const kTopBarPortalId = "top-bar";
const MenuButton = React.memo(() => {

    return (
        <TouchableHighlight
            onPress={() => toggleSideBar()}
            underlayColor={"#0000001f"}
            style={style.menuButton}
        >
            <Icon name={"align-justify"} size={30} style={{ color: "white" }} />
        </TouchableHighlight>
    )
});

export const TopBar = React.memo(() => {
    return (
        <View style={style.container}>
            <MenuButton />
            <PortalHost name={kTopBarPortalId} />
        </View>
    );
});

export const TopBarHeader = React.memo((props: { children: React.ReactChild }) => {
    return (
        <Portal hostName={kTopBarPortalId}>
            {props.children}
        </Portal>
    );
});

const style = StyleSheet.create({
    container: {
        height: 50,
        width: "100%",
        backgroundColor: "#222",

        display: "flex",
        flexDirection: "row",

        paddingLeft: 10,
        paddingRight: 10,

        zIndex: 10
    },
    menuButton: {
        padding: 5,
        alignSelf: "center",
        backgroundColor: "transparent",
        borderRadius: 3,
        alignContent: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center"
    }
});
