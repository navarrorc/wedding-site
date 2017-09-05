"use strict";

const gulp = require("gulp"),
    gutil = require("gulp-util"),
    child = require("child_process"),
    webpack = require("webpack"),
    browserSync = require("browser-sync").create(),
    path = require("path"),
    _ = require("lodash"),
    fs = require("fs"),
    glob = require("glob"),
    sass = require("gulp-sass"),
    runSequence = require("run-sequence"),
    ExtractTextPlugin = require("extract-text-webpack-plugin"),
    OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');

let isProd = false,
    isSharePoint = false,
    jekyll = null,
    first_run = true;

const messages = {
    jekyllBuild: '<span style="color: grey">Running:</span> $ jekyll build'
};

function onBuild() {
    return function (err, stats) {
        if (err) {
            gutil.log("Error", err);
        }
        else {
            // see: https://webpack.js.org/configuration/stats/
            gutil.log("onBuild", stats.toString({
                colors: true,
                hash: false,
                version: true,
                timings: false,
                assets: true,
                chunks: false,
                chunkModules: false,
                modules: false,
                children: false,
                cached: false,
                reasons: false,
                source: false,
                errorDetails: true,
                chunkOrigins: false,
                displayErrorDetails: true
            }));
        }
    };
}

/**
 * Dev Webpack Configuration
 * see: http://bit.ly/2ph6SJZ 
 */
const devConfig = {
    context: path.resolve(__dirname, "src"),
    entry: {
        main: [
            "./app.js",
            "../_sass/main.scss"
        ]
    },
    watch: true,
    devtool: "eval-source-map",
    output: {
        path: path.resolve(__dirname, "js"),
        filename: "bundle.js"
    },
    module: {
        rules: [{
            test: /\.jsx?$/,
            exclude: /(node_modules|bower_components)/,
            use: {
                loader: "babel-loader",
                options: {
                    presets: ["env", "react"]
                }
            }
        }, {
            test: /\.json$/,
            exclude: /(node_modules)/,
            use: {
                loader: "json-loader"
            }
        }, {
            test: /\.(css|scss)/,
            use: ExtractTextPlugin.extract({
                use: [
                    {
                        loader: "css-loader",
                        options: {
                            importLoaders: 1,
                            sourceMap: true
                        }
                    },
                    { 
                        loader: 'postcss-loader', 
                        options: { 
                            plugins: () => [require('autoprefixer')],
                            sourceMap: true 
                        } 
                    },
                    {
                        loader: "sass-loader",
                        options: {
                            sourceMap: true
                        }
                    }
                ]
            })
        }]
    },
    plugins: [
        new ExtractTextPlugin({
            filename: "../css/[name].css",
        })
        // new webpack.ProvidePlugin({
        //     $: 'jquery',
        //     jQuery: 'jquery'
        // })
    ]
};

/**
 * Production Webpack Configuration
 */
let prodConfig = _.cloneDeep(devConfig); // see: http://bit.ly/2pojyQh
prodConfig.plugins = prodConfig.plugins.concat(
    new webpack.DefinePlugin({
        "process.env": {
            "NODE_ENV": JSON.stringify("production")
        }
    }),
    new webpack.optimize.UglifyJsPlugin({
        compress: {
            warnings: false
        },
        sourceMap: true
    }),
    new OptimizeCssAssetsPlugin({
        assetNameRegExp: /\.css$/g,
        cssProcessorOptions: { discardComments: { removeAll: true }, map: { inline: false } },
        canPrint: true
    }),
    new webpack.optimize.ModuleConcatenationPlugin() // webpack 3 feature
);
prodConfig.watch = false;
prodConfig.devtool = "source-map";
// prodConfig.output.filename = prodConfig.output.filename.replace(/\.js$/, ".min.js");


/**************
 * Tasks
 **************/

/**
* Process JS with webpack
*/
gulp.task("webpack", function (done) {
    let webpackConfig = isProd ? prodConfig : devConfig;
    webpack(webpackConfig, function (err, status) {
        onBuild()(err, status);

        if (first_run) done();

    });
});

/**
 * Rename all index.html files to default.aspx
 */
gulp.task("rename", function (done) {
    glob("_site/**/*index.html", {}, function (er, files) {
        gutil.log(JSON.stringify(files, null, 4));
        files.forEach(function (file_path) {
            let dir = file_path.substr(0, file_path.lastIndexOf('/') + 1);
            fs.rename(`${dir}index.html`, `${dir}default.aspx`, function (err) {
                if (err) {
                    gutil.log("ERROR: " + err);
                    throw err;
                }
            });
        });
        gutil.log("Rename: All index.html renamed.");
        done();
    });
});

/**
 * Build the Jekyll Site
 */
gulp.task("jekyll-build", function (done) {
    // see: https://aaronlasseigne.com/2016/02/03/using-gulp-with-jekyll/
    let exec = process.platform === "win32" ? "jekyll.bat" : "jekyll"; // see: http://bit.ly/2pzQeHk
    if (isProd) {
        if (isSharePoint) {
            jekyll = child.spawn(exec, ["build", "--incremental", "--drafts", "--config", "_config.yml,_config_prod.yml"])
                .on("close", function () {
                    done();
                });
        }
        else {
            jekyll = child.spawn(exec, ["build", "--incremental", "--drafts"])
                .on("close", function () {
                    done();
                });
        }
    }
    else {
        if (!first_run) browserSync.notify(messages.jekyllBuild);

        jekyll = child.spawn(exec, ["build", "--incremental", "--drafts"])
            .on("close", function () {
                if (!first_run) {
                    browserSync.reload();
                }
                else {
                    first_run = false;
                }
                done(); // finished task
            });
    }
    let jekyllLogger = function (buffer) {
        buffer.toString()
            .split(/\n/)
            .forEach(function (message) {
                if (message) {
                    gutil.log("Jekyll: " + message);
                }
            });
    };

    jekyll.stdout.on("data", jekyllLogger);
    jekyll.stderr.on("data", jekyllLogger);
});

gulp.task("serve", function () {
    let options = {
        // files: ["_site/**"],
        server: {
            baseDir: "_site"
        },
        port: process.env.PORT || 8080,
        ui: {
            port: 8081
        },
        ghostMode: false,
        open: false,
        // https: {
        //     pfx: "/temp/localhost-spo-dev.pfx",
        //     passphrase: "spodev"           
        // }
        // https: {
        //     key: "/Users/Robert/SSL_Certs/localhost_dev.key",
        //     cert: "/Users/Robert/SSL_Certs/localhost_dev.crt"
        // }
    };
    browserSync.init(options);

    // Watch scss files for changes & recompile
    // Watch html/md files, run jekyll-build which will reload BrowserSync
    let watcher_js = gulp.watch("js/bundle.js", ["copy-js"]);
    let watcher_css = gulp.watch("css/main.css", ["css"]);
    let watcher_all = gulp.watch([
        // "*.html", 
        // "*.md",
        "pages/**/*.html",
        "_layouts/*",
        "_includes/*",
        "_posts/*",
        "_data/*",
        "_sets/*",
        "_drafts/*"], ['jekyll-build']);

    watcher_js.on("change", function (event) {
        gutil.log("Watcher: File " + event.path + " was " + event.type + ", running copy-js");
    });
    watcher_css.on('change', function (event) {
        gutil.log('Watcher: File ' + event.path + ' was ' + event.type + ', running css');
    });
    watcher_all.on('change', function (event) {
        gutil.log('Watcher: File ' + event.path + ' was ' + event.type + ', running jekyll-build');
    });
});

gulp.task("build", function () {
    isProd = true;
    runSequence(["webpack"],
        "jekyll-build");
});

gulp.task("build-sp", function () {
    // build for SharePoint, replaces index.html to default.aspx
    isProd = true;
    isSharePoint = true;
    runSequence(["webpack"],
        "jekyll-build",
        "rename");
});

gulp.task("copy-js", function () {
    return gulp.src("js/bundle.js")
        .pipe(gulp.dest("_site/js"))
        .pipe(browserSync.stream());
});

/**
 * Compile files from _scss into both _site/css (for live injecting) and site (for future jekyll builds)
 */
gulp.task("css", function () {
    return gulp.src("css/main.css")
        .pipe(gulp.dest("_site/css"))
        .pipe(browserSync.stream());
});

gulp.task("default", function () {
    runSequence(["webpack"],
        "jekyll-build",
        "serve");
});