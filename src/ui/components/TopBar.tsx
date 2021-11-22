import React from "react";
import {StyleSheet, TouchableHighlight, View} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {toggleSideBar} from "./SideBar";

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
        </View>
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
        paddingRight: 10
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