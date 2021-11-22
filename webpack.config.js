const path = require('path');
const webpack = require('webpack');
const HTMLWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const isDevelopment = process.env.NODE_ENV !== 'production';
console.log("Generating webpack config for %s", process.env.NODE_ENV || 'development');

module.exports = {
    entry: {
        app: path.resolve(__dirname, "src", "index.tsx")
    },
    output: {
        filename: '[name]_[fullhash].web.js',
        path: path.resolve(__dirname, 'dist')
    },
    plugins: [
        new CleanWebpackPlugin(),
        new HTMLWebpackPlugin({
            title: "Your pn-feed"
        }),
        // `process.env.NODE_ENV === 'production'` must be `true` for production
        // builds to eliminate development checks and reduce build size. You may
        // wish to include additional optimizations.
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
            __DEV__: isDevelopment,
        }),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
    ],
    mode: isDevelopment ? "development" : "production",
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
        historyApiFallback: true,
    },

    optimization: {
        splitChunks: {
            chunks: 'all',
        },
    },
}
