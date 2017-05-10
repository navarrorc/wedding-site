var gulp = require("gulp"),
    gutil = require('gulp-util'),
    watch = require("gulp-watch"),
    child = require("child_process"),
    webpack = require("webpack"),
    browserSync = require("browser-sync").create(),
    runSequence  = require("run-sequence").use(gulp),
    path = require("path"),
    _ = require("lodash");
    
var isProd = true;

function onBuild(done) {
    return function (err, stats) {
        if (err) {
            gutil.log('Error', err);
        }
        else {
            // see: https://webpack.js.org/configuration/stats/
            gutil.log('onBuild', stats.toString(
                {
                    colors: true,
                    hash: false,
                    version: false,
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
                    version: true
                }
            ));
        }

        if (done) {
            done();
        }
    }
}
  
/**
 * Dev Webpack Configuration
 * see: http://bit.ly/2ph6SJZ 
 */
var devConfig  = {
    entry: './src/app.js',
    watch: true,
    devtool: "cheap-eval-source-map",
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "js")
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["env", "react"]
                    }
                }
            }
        ]
    },
    plugins: [
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery'
        })
    ]
};

/**
 * Production Webpack Configuration
 */
var prodConfig = _.cloneDeep(devConfig); // see: http://bit.ly/2pojyQh
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
    })
);
prodConfig.devtool = "source-map";
prodConfig.output.filename = prodConfig.output.filename.replace(/\.js$/, ".min.js");


/**
 * Tasks
 */
gulp.task("webpack", function() {        
    var webpackConfig = isProd ? prodConfig : devConfig;    
    webpack(webpackConfig).watch(100, function (err, status) {
        onBuild()(err, status);
    })
});

gulp.task("jekyll", function() {
    // see: https://aaronlasseigne.com/2016/02/03/using-gulp-with-jekyll/
    var exec = process.platform === "win32" ? "jekyll.bat" : "jekyll"; // see: http://bit.ly/2pzQeHk
    var jekyll = child.spawn(exec, ["build", "--watch"]); 
    var jekyllLogger = function(buffer) {
        buffer.toString()
            .split(/\n/)
            .forEach(function(message){
                if(message) {
                    gutil.log("Jekyll: " + message);
                }
            });
    };
    
    jekyll.stdout.on("data", jekyllLogger);
    jekyll.stderr.on("data", jekyllLogger);
});

gulp.task("serve", function(){
    var options = {
        server: {baseDir: "_site/"},
        port: process.env.PORT || 8080,
        ui: { port: 8081 },
        ghostMode: false
    };
    browserSync.init(options);    
    watch("_site/**/*", browserSync.reload); // see: http://bit.ly/2qJeZ3d
});

gulp.task("build", function(callback) {
	isProd = true;
	return runSequence("jekyll", "serve", "webpack");
});

gulp.task("default", function (callback) {
    isProd = false;
    return runSequence("jekyll", "serve", "webpack");
})