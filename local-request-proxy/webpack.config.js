const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: path.resolve(__dirname, "src", "index.ts"),
    output: {
        filename: 'server.js',
        path: path.resolve(__dirname, 'dist')
    },
    plugins: [
        // `process.env.NODE_ENV === 'production'` must be `true` for production
        // builds to eliminate development checks and reduce build size. You may
        // wish to include additional optimizations.
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        }),
    ],
    mode: "development",
    target: "node",
    devtool: "source-map",
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: "ts-loader"
            },
        ],
    },

    resolve: {
        extensions: [
            '.ts',
            '.js',
        ],
    },
}
