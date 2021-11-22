import React from "react";
import {StyleSheet, Text, View} from "react-native";

export const UnknownPage = React.memo(() => {
    console.error("RENDER UNKNOWN");
    return (
        <View style={style.container}>
            <Text style={style.text}>How did you landed here?</Text>
        </View>
    );
});

const style = StyleSheet.create({
    container: {
        flex: 1,

        display: "flex",
        flexDirection: "column",
        justifyContent: "center",

        textAlign: "center",
        fontSize: 20,

        backgroundColor: "black"
    },
    text: {
        fontSize: 20,
        color: "#fff"
    }
});