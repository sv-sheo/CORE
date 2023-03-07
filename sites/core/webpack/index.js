// DOCUMENTATION
//https://webpack.js.org/api/node
//https://webpack.github.io/docs/webpack-dev-server.html
//https://webpack.js.org/guides/production-build/

const path          = require('path');
const webpack       = require("webpack");
const dev_server    = require("webpack-dev-server");
const config_       = require('./config');

let action  = process.argv[2];                                          // example call: node webpack <action> <mode>       action=run|watch        mode=dev|prod
    action  = ['run', 'watch'].indexOf(action) >= 0 ? action : false;   // validate action: only possible values: 'run' and 'watch'

let mode    = process.argv[3];                                          // get config from arguments, by default 'dev', possible values: 'dev' or 'prod'
    mode    = ['dev', 'prod'].indexOf(mode) >= 0 ? mode : 'dev';      

let app     = process.argv[4];                                   
    app     = ['app'].indexOf(app) >= 0 ? app : 'app'; 

let run_handler     = require('./run');     // compiler.run() handler
let watch_handler   = require('./watch');   // compiler.watch() handler

let config          = config_[app][mode];

const compiler      = webpack(config); // you can supply more configs, they ll be run synchronousl in order i.e. webpack(config1, config2);

//process.argv is an array containing the command line arguments. The first element will be 'node', the second element will be the name of the JavaScript file. The next elements will be any additional command line arguments.

// run action creates final build
// watch action starts watching boots up dev server

if(action) {
    
    // RUN
    if(action === 'run') {

        compiler.run(run_handler);

    }
 
    // WATCH
    if(action === 'watch') {
        
        // 4333 = opajda; 4334 = fiby; 4338 = moonblocks; 4335 = ss-system; 4336 = ss-actilog; S-core admin = 4338
        let dev_server_port = config.devServer.port; // INSTANCE CHANGE HERE (source = 3333)

        let dev_server_options = {

            /* VALID OPTIONS 
            
                allowedHosts, bonjour, client, compress, devMiddleware, headers, historyApiFallback, host,
                hot, http2, https, ipc (socket), liveReload, magicHtml, onAfterSetupMiddleware, onBeforeSetupMiddleware
                onListening, open, port, proxy, server, setupExitSignals, static, watchFiles, webSocketServer,

            */
            
            host:           'localhost',
            port:           dev_server_port,
            headers: {
                
                // allow CORS (acces from localhost)
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
                
            },

            static: {

                directory:          path.resolve(__dirname, './files/'),// sites/sheo/webpack/files/ -> serving static files (icons etc) mentioned inside JS and CSS - files dir must be in webpack in prder to imitate the files/get/ interface of production
                staticOptions:      {},
                                                // Can be: publicPath: ['/static-public-path-one/', '/static-public-path-two/'],
                publicPath:         "/",        // = default value -> all files created by webpack will be accessible like http://localhost:3000/bundle.js !!! Make sure publicPath always starts and ends with a forward slash.
                serveIndex:         true,       // Can be: serveIndex: {} (options for the `serveIndex` option you can find https://github.com/expressjs/serve-index)
                watch:              true,       // Can be: watch: {} (options for the `watch` option you can find https://github.com/paulmillr/chokidar)

            },

            devMiddleware: {

                stats:          'normal',       // "errors-only", "minimal", "none", "normal", "verbose"

            },

            allowedHosts: 'all', // ['.host.com', 'host2.com'],

            hot: 'only',
            
        }
        
        // turn on dev server
        let server = new dev_server(dev_server_options, compiler);

            //server.listen(dev_server_port); DEPRECATED

        (async () => {

            await server.start();
            console.log("Webpack Dev Server running");

        })();
        
    }
    
} else { console.log('MISSING or INVALID ACTION argument. Possible values: "run" or "watch"'); }