const path = require('path');
const webpack = require('webpack');
const HTMLWebpackPlugin = require('html-webpack-plugin');

const appDirectory = path.resolve(__dirname, '../');

module.exports = {
    entry: path.resolve(__dirname, "src", "index.tsx"),
    output: {
        filename: 'bundle.web.js',
        path: path.resolve(appDirectory, 'dist')
    },
    plugins: [
        new HTMLWebpackPlugin(),
        // `process.env.NODE_ENV === 'production'` must be `true` for production
        // builds to eliminate development checks and reduce build size. You may
        // wish to include additional optimizations.
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
            __DEV__: process.env.NODE_ENV !== 'production' || true,
        }),
    ],
    mode: "development",
    devtool: "source-map",
    module: {
        rules: [
            {
                test: /\.js$/,
                use: "babel-loader",
                include: [
                    path.join(__dirname, "src"),
                    path.join(__dirname, "node_modules/react-native-vector-icons")
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
        //  --inline --hot --colors
    },

}
