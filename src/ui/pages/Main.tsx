import React from "react";
import {StyleSheet, Text, View} from "react-native";

export const MainPage = React.memo(() => {
    return (
        <View style={style.outerContainer}>
            <Text style={style.text}>
                Hello!
            </Text>
        </View>
    );
})

const style = StyleSheet.create({
    outerContainer: {
        padding: 20,

        height: "100%",
        width: "100%",

        backgroundColor: "#000",

        display: "flex",
        flexDirection: "column",
        justifyContent: "center"
    },

    text: {
        color: "#fff",
        textAlign: "center",
        fontSize: 30
    }
})
