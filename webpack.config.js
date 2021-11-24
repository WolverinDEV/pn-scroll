const path = require('path');
const webpack = require('webpack');
const HTMLWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const ReactNative = require('@callstack/repack');

const targetPlatform = ReactNative.getPlatform({ fallback: process.env.TARGET_PLATFORM || "android" });
const mode = ReactNative.getMode({ fallback: "development" });
console.log("Generating webpack config for %s on %s", mode, targetPlatform);

/* Notify all other plugins */
process.env.NODE_ENV = mode;

if(targetPlatform === "web") {
    module.exports = {
        entry: {
            app: path.resolve(__dirname, "src", "index.tsx")
        },
        output: {
            filename: '[name]_[fullhash].web.js',
            path: path.resolve(__dirname, 'dist'),
            publicPath: "/"
        },
        plugins: [
            new CleanWebpackPlugin(),
            new HTMLWebpackPlugin({
                title: "Your PN-Feed"
            }),
            // `process.env.NODE_ENV === 'production'` must be `true` for production
            // builds to eliminate development checks and reduce build size. You may
            // wish to include additional optimizations.
            new webpack.DefinePlugin({
                'process.env.TARGET_PLATFORM': JSON.stringify(targetPlatform),
                'process.env.NODE_ENV': JSON.stringify(mode),
                __DEV__: mode === "development",
            }),
            new webpack.ProvidePlugin({
                Buffer: ['buffer', 'Buffer'],
            }),
        ],
        mode,
        devtool: "source-map",
        module: {
            rules: [
                {
                    test: /\.js$/,
                    use: "babel-loader",
                    include: [
                        path.join(__dirname, "node_modules/react-native-vector-icons"),
                        path.join(__dirname, "node_modules/react-router-native"),
                    ]
                },
                {
                    test: /\.tsx?$/,
                    exclude: /node_modules/,
                    use: [
                        "babel-loader",
                        "ts-loader"
                    ]
                },
                {
                    test: /\.(gif|jpe?g|png|svg)$/,
                    use: {
                        loader: 'url-loader',
                        options: {
                            name: '[name].[ext]',
                            esModule: true,
                        }
                    }
                },
                {
                    test: /\.ttf$/,
                    use: [
                        'babel-loader',
                        "url-loader"
                    ],
                },
            ]
        },

        resolve: {
            alias: {
                'react-native$': 'react-native-web'
            },
            extensions: [
                '.web.tsx',
                '.web.ts',
                '.tsx',
                '.ts',
                '.web.jsx',
                '.web.js',
                '.jsx',
                '.js',
            ],
        },

        devServer: {
            compress: true,
            historyApiFallback: true,
        },

        optimization: {
            splitChunks: {
                chunks: 'all',
            },
        },
    }
} else {
    const devServer = ReactNative.getDevServerOptions();
    const reactNativePath = ReactNative.getReactNativePath();
    const context = ReactNative.getContext({ fallback: __dirname });

    /* HMR only available for development builds. */
    devServer.hmr = mode === "development" ? devServer.hmr : false;

    console.error(devServer);

    /**
     * Webpack configuration.
     */
    module.exports = {
        mode,
        /* We're generating custom source maps */
        devtool: false,
        context,
        /**
         * `getInitializationEntries` will return necessary entries with setup and initialization code.
         * If you don't want to use Hot Module Replacement, set `hmr` option to `false`. By default,
         * HMR will be enabled in development mode.
         */
        entry: [
            ...ReactNative.getInitializationEntries(reactNativePath, {
                hmr: devServer.hmr,
            }),
            path.join(__dirname, "src", "index.tsx"),
        ],
        resolve: {
            /* Add resolve options for platform depend resolve. */
            ...ReactNative.getResolveOptions(targetPlatform),
        },

        /**
         * Configures output.
         * It's recommended to leave it as it is unless you know what you're doing.
         * By default Webpack will emit files into the directory specified under `path`. In order for the
         * React Native app use them when bundling the `.ipa`/`.apk`, they need to be copied over with
         * `ReactNative.OutputPlugin`, which is configured by default.
         */
        output: {
            clean: true,
            path: path.join(__dirname, 'build', targetPlatform),
            filename: 'index.bundle',
            chunkFilename: '[name].chunk.bundle',
            publicPath: ReactNative.getPublicPath(devServer),
        },


        /* FIXME: Minimize bundle! */
        module: {
            rules: [
                {
                    test: /\.[jt]sx?$/,
                    include: [
                        /node_modules(.*[/\\])+react/,
                        /node_modules(.*[/\\])+@react-native/,
                        /node_modules(.*[/\\])+@react-navigation/,
                        /node_modules(.*[/\\])+@react-native-community/,
                        /node_modules(.*[/\\])+@expo/,
                        /node_modules(.*[/\\])+pretty-format/,
                        /node_modules(.*[/\\])+metro/,
                        /node_modules(.*[/\\])+abort-controller/,
                        /node_modules(.*[/\\])+@callstack[/\\]repack/,
                    ],
                    use: 'babel-loader',
                },

                {
                    test: /\.[jt]sx?$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            /* Only add refresh plugin if we're using hmr. */
                            plugins: devServer.hmr ? ['module:react-refresh/babel'] : undefined,
                        },
                    },
                },

                {
                    test: ReactNative.getAssetExtensionsRegExp(
                        ReactNative.ASSET_EXTENSIONS
                    ),
                    use: {
                        loader: '@callstack/repack/assets-loader',
                        options: {
                            platform: targetPlatform,
                            devServerEnabled: devServer.enabled,
                            /**
                             * Defines which assets are scalable - which assets can have
                             * scale suffixes: `@1x`, `@2x` and so on.
                             * By default all images are scalable.
                             */
                            scalableAssetExtensions: ReactNative.SCALABLE_ASSETS,
                        },
                    },
                },
            ],
        },
        plugins: [
            new webpack.DefinePlugin({
                __DEV__: JSON.stringify(mode === "development"),
            }),
            new webpack.ProvidePlugin({
                Buffer: ['buffer', 'Buffer'],
            }),

            /**
             * This plugin makes sure the resolution for assets like images works with scales,
             * for example: `image@1x.png`, `image@2x.png`.
             */
            new ReactNative.AssetsResolverPlugin({
                platform: targetPlatform,
            }),

            /**
             * React Native environment (globals and APIs that are available inside JS) differ greatly
             * from Web or Node.js. This plugin ensures everything is setup correctly so that features
             * like Hot Module Replacement will work correctly.
             */
            new ReactNative.TargetPlugin(),

            /**
             * By default Webpack will emit files into `output.path` directory (eg: `<root>/build/ios`),
             * but in order to for the React Native application to include those files (or a subset of those)
             * they need to be copied over to correct output directories supplied from React Native CLI
             * when bundling the code (with `webpack-bundle` command).
             * All remote chunks will be placed under `remoteChunksOutput` directory (eg: `<root>/build/<platform>/remote` by default).
             * In development mode (when development server is running), this plugin is a no-op.
             */
            new ReactNative.OutputPlugin({
                platform: targetPlatform,
                devServerEnabled: devServer.enabled,
                remoteChunksOutput: path.join(__dirname, 'build', targetPlatform, 'remote'),
            }),

            /**
             * Runs development server when running with React Native CLI start command or if `devServer`
             * was provided as s `fallback`.
             */
            new ReactNative.DevServerPlugin({
                ...devServer,
                platform: targetPlatform,
            }),

            /**
             * Configures Source Maps for the main bundle based on CLI options received from
             * React Native CLI or fallback value..
             * It's recommended to leave the default values, unless you know what you're doing.
             * Wrong options might cause symbolication of stack trace inside React Native app
             * to fail - the app will still work, but you might not get Source Map support.
             */
            new webpack.SourceMapDevToolPlugin({
                test: /\.(js)?bundle$/,
                exclude: /\.chunk\.(js)?bundle$/,
                filename: '[file].map',
                append: `//# sourceMappingURL=[url]?platform=${targetPlatform}`,
                /**
                 * Uncomment for faster builds but less accurate Source Maps
                 */
                // columns: false,
            }),

            /**
             * Configures Source Maps for any additional chunks.
             * It's recommended to leave the default values, unless you know what you're doing.
             * Wrong options might cause symbolication of stack trace inside React Native app
             * to fail - the app will still work, but you might not get Source Map support.
             */
            new webpack.SourceMapDevToolPlugin({
                test: /\.(js)?bundle$/,
                include: /\.chunk\.(js)?bundle$/,
                filename: '[file].map',
                append: `//# sourceMappingURL=[url]?platform=${targetPlatform}`,
                /**
                 * Uncomment for faster builds but less accurate Source Maps
                 */
                // columns: false,
            }),

            /**
             * Logs messages and progress.
             * It's recommended to always have this plugin, otherwise it might be difficult
             * to figure out what's going on when bundling or running development server.
             */
            new ReactNative.LoggerPlugin({
                platform: targetPlatform,
                devServerEnabled: devServer.enabled,
                output: {
                    console: true,
                    /**
                     * Uncomment for having logs stored in a file to this specific compilation.
                     * Compilation for each platform gets it's own log file.
                     */
                    // file: path.join(__dirname, `${mode}.${targetPlatform}.log`),
                },
            }),
        ],
    };
}
