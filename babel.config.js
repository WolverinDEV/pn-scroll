module.exports = {
    presets: [
        ["@babel/preset-env", { targets: "ie 11", loose: true, modules: false }],
        /* automatically add the appropriate plugin */
        ["module:metro-react-native-babel-preset", {disableImportExportTransform: true}]
    ],
    // Re-write paths to import only the modules needed by the app
    plugins: [
        "@babel/plugin-transform-modules-commonjs",
    ]
};
