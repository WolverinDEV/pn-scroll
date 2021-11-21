module.exports = {
  // The 'metro-react-native-babel-preset' preset is recommended to match React Native's packager
  presets: [
    ["@babel/preset-env", { targets: "ie 11", loose: true, modules: false }],
    "module:metro-react-native-babel-preset"
  ],
  // Re-write paths to import only the modules needed by the app
  plugins: [
    "@babel/plugin-transform-modules-commonjs",
    'react-native-web'
  ]
};
