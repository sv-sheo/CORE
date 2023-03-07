
// MUST return a promise-returning function - because it is used in Promise.chain!
exports.create_workers = async function(previous_step={}) {

    if(previous_step.ok) {

        var result = {ok: 0, data: {previous_step}, id:'', text: '', error: null};

        try {

            var id = 1; // M.cluster.fork is 1-based;

            // Fork workers.
            for(id; id <= CONFIG.core.workers; id++) { 
                
                M.cluster.fork();  // cluster.forks spawns a new process with incremented id, starting with 1

                M.cluster.workers[id].on('message',     C.process.MAKE_MASTER_LISTEN_TO_WORKER);

                // the rest of worker events is handled via C.process.bind_cluster_event_listeners (in index.js)

                PROCESSES['WORKER_'+id] = M.cluster.workers[id];

                //C.process.bind_process_event_listeners('WORKER_'+id, 'WORKER'); // executed in worker branch of index.js
            
            }

            result = {...result, ok: 1, id: '[i20]', text: 'Created '+CONFIG.core.workers+' workers.'};

            C.logger.bootup_step(result);

        } catch(error) { result = {...result, error, id: '[e15]', text: 'Failed to create workers - unknown error: '+error.message}; }

        return result;

    } else { return previous_step; }

};

// MUST return a promise-returning function - because it is used in Promise.chain!
exports.init_workers = async function(previous_step={}) {

    if(previous_step.ok) {

        var result = {ok: 0, data: {previous_step}, id:'', text: '', error: null};

        try {

            var id          = 1; // M.cluster.fork is 1-based;
            var promises    = {};
            var default_msg = { action: 'process.handlers.worker.init_worker', data: { start_time: C.bootup.start_time.getTime()}}; // worker starts whole new script, with new start time, send start time of master
            var total_count = Object.keys(M.cluster.workers).length;

            C.logger.bootup_step({id: '[i5]', text: 'Starting to initialize  ' + total_count +' workers.'});

            // send each worker necessary init messages - only JSON safe - worker wont start until it gets it
            for(id; id <= CONFIG.core.workers; id++) { promises[id] = C.process.EXECUTE_ON_WORKER({...default_msg, worker_id: id}); }

            var count               = 0;
            var promises_result     = await C.promise.parallel(promises);
                result.data.workers = {};
                result.data.errors  = {};

            M._.forEach(promises_result, function(res, worker) { 
                
                if(worker !== 'ROOT') { 

                    result.data.workers[worker] = res;

                    if(res.ok) {

                        if(res.resolved && res.resolved.ok) { count++; } 
                        else                                { result.data.errors[worker] = res.resolved; }

                    } else { result.data.errors[worker] = res.error; }
                
                }
            
            });

            result.id   = count ? '[i21]' : '[e39.1]';
            result.ok   = count ? 1 : 0;
            result.text = count ? 'Successfully initialized '+count+'/'+total_count+ ' workers.' : 'No workers ('+count+'/'+total_count+') were successfully initialized.';

            if(M._.size(result.data.errors)) {

                result.text += '\r\n ---- ERRORS: ';

                M._.forEach(result.data.errors, function(error, worker) { 
                    
                    if(error?.id && error?.text){ result.text += '\r\n -------- worker '+worker+': '+error.id+' '+error.text; }
                    else                        { result.text += '\r\n -------- worker '+worker+': '+error?.message; }
                
                });

            }

            result.error = count ? null : new Error(result.text);

            if(result.ok) C.logger.bootup_step(result); // otherwise, let the error propagate to the end of bootup, where it will be logged

        } catch(error) { result = {...result, error, id: '[e39]', text: 'Failed to initialize workers - unknown error: '+error.message}; }

        return result;

    } else { return previous_step; }

};

// create http proxy for all http hosts and listen on 80
exports.create_http = async function(previous_step={}) { 

    if(previous_step.ok) {

        var result = {ok: 0, data: {previous_step}, id: '[i10]', text:'', error: null};

        try {
    
            PROCESSES.PROXY_SERVER = M.proxy.createProxyServer({});

            // create http proxy server - checks if requested site is supposed to be https, in that case redirect to https, otherwise proxy to real http server
            PROCESSES.HTTP_PROXY_SERVER = M.http.createServer((Q, s) => { // Q = request, s = response

                // PROXY requests are not logged or tracked if successful (only regular behind-proxy requests are). In case of proxy request error, the error is logged in DB and file

                try {

                    /* the q object will be passed to .web() method, were it will be mutated and all data set to it in here will be wiped, however if you change url or host here,
                       the change will persist therefore DO NOT SAVE ANYTHING in q object here that you would like to use after proxy. simply get it again after proxy */

                    // DO NOT BOTHER with /favicon.ico requests - serve 200 and stop the handling of this request
                    if(CONFIG.core.request.ignore_favicon && Q.url === '/favicon.ico') { return C.request.do_not_serve_favicon(s); };

                    // now check if acessing by IP, if yes, adjust host and URL so that we can find site
                    var adjust_by_ip    = C.request.adjust_host_and_url_by_IP(Q);
                    var from_ip         = adjust_by_ip.from_ip;
                    var host            = adjust_by_ip.host;
                    var url             = adjust_by_ip.url;
                    var site            = C.sites.get_site_by_host(host);                                                   // get site from host 
                    var site_is_valid   = (site && S[site] && S[site].config && STATE.sites.loaded[site]) ? true : false;   // check if site is valid
                    var is_https        = (site_is_valid && S[site].config.is_https);    // check if its https 
console.log('?????????????????????????????', adjust_by_ip, site, site_is_valid)
                    if(host && site && site_is_valid) {

                        // redirect to HTTPS if certificate is found
                        if( is_https ) { s.writeHead(302, {'Location': 'https://' + Q.headers.host + Q.url, 'Method': Q.method}); s.end(); return; }

                        // site is not https or IO - proxy to real http server
                        // .web() method doesnt return anything
                        PROCESSES.PROXY_SERVER.web(Q, s, { target: 'http://' + Q.headers.host + ':8080'}); // HERE      ... do not add the Q.url, the .web() methods adds it automatically

                    } else { C.response.quick_error({s, code: 404, text: '404 SITE NOT FOUND'}); }
                    
                } catch(error) { C.request.handle_error({Q, s, type: 'PROXY', request_result: {id:'[e62]', error, text: 'Failed to handle request on HTTP PROXY server - unknown error: '+error.message}}); }

            }).listen(80);
            
            // create real server and route hosts to individual site routers
            PROCESSES.HTTP_SERVER = M.http.createServer(async function(Q, s) {
                
                try { 

                    var handle_result = await C.request.handle(Q, s); // returns a result object, but all errors will be handled inside
                    
                } catch(error) { 
                    
                    var handle_error = await C.request.handle_error({Q, s, request_result: {id:'[e63]', error, text: 'Failed to handle request on HTTP server - unknown error: '+error.message}}); 

                };
                
            }).listen(8080); // IS HERE

            C.process.bind_server_event_listeners(PROCESSES.PROXY_SERVER, 'PROXY_SERVER');
            C.process.bind_server_event_listeners(PROCESSES.HTTP_PROXY_SERVER, 'HTTP_PROXY_SERVER');
            C.process.bind_server_event_listeners(PROCESSES.HTTP_SERVER, 'HTTP_SERVER');
            
            // resolve creating http TO DO error (probably somewhere else (shutdown handlers ?))
            var HTTP_PROXY_SERVER_RUNNING_PROMISE   = new Promise(function(resolve, reject) { PROCESSES.HTTP_PROXY_SERVER.on('listening', () => {resolve({ok:1});}); });
            var HTTP_SERVER_RUNNING_PROMISE         = new Promise(function(resolve, reject) { PROCESSES.HTTP_SERVER.on('listening', () => {resolve({ok:1});}); });

            var HTTP_PROXY_SERVER   = await HTTP_PROXY_SERVER_RUNNING_PROMISE;
            var HTTP_SERVER         = await HTTP_SERVER_RUNNING_PROMISE;

            if(HTTP_PROXY_SERVER.ok && HTTP_SERVER.ok) {

                result.ok   = 1;
                result.text = 'Created proxied HTTP server and started listening on port 80.';

                C.logger.bootup_step(result);

             } else { result.id = '[e60.1]'; result.text = 'Failed to create HTTP server - unknown error.'; result.error = new Error(result.text); }

        } catch(error) { result = {...result, id: '[e60]', text: 'Failed to create HTTP server - unknown error: '+error.message, error}; }

        return result;

    } else { return previous_step; }

};

// create https proxy and https server for all sites with certificate. listen on 443 
exports.create_https = async function(previous_step={}) {
    
    if(previous_step.ok) {

        var result = {ok: 0, data: {previous_step}, id: '[i11]', text:'', error: null};

        try {

            PROCESSES.PROXY_SERVER_SECURE = M.proxy.createProxyServer({});

            // create https proxy server - checks if site has certificate, if not, redirect to http
            PROCESSES.HTTPS_PROXY_SERVER = M.https.createServer(STATE.certificates.https, (Q, s) => { // Q = request, s = response
                
                try {

                    // DO NOT BOTHER with /favicon.ico requests - serve 200 and stop the handling of this request
                    if(CONFIG.core.request.ignore_favicon && Q.url === '/favicon.ico') return C.request.do_not_serve_favicon(s);

                    // now check if acessing by IP, if yes, adjust host and URL so that we can find site
                    var adjust_by_ip    = C.request.adjust_host_and_url_by_IP(Q);
                    var from_ip         = adjust_by_ip.from_ip;
                    var host            = adjust_by_ip.host;
                    var url             = adjust_by_ip.url;
                    var site            = C.sites.get_site_by_host(host);                                                   // get site from host 
                    var site_is_valid   = (site && S[site] && S[site].config && STATE.sites.loaded[site]) ? true : false;   // check if site is valid
                    var is_https        = (site_is_valid && S[site].config.is_https);    // check if its https 

                    // weird host error
                    if(host && site && site_is_valid) {

                        // redirect to HTTP if no certificate is found
                        if( !is_https ) { s.writeHead(302, {'Location': 'http://' + Q.headers.host + Q.url, 'Method': Q.method}); s.end(); return; }

                        let SITE = S[site];
                        let port = parseInt(SITE.config.https_port); // EACH HTTPS SITE HAS TO HAVE ITS OWN PORT

                        if(port) {

                            // site exists and is https - proxy to real https server
                            PROCESSES.PROXY_SERVER_SECURE.web(Q, s,    { 
                                                                            ssl:    M._.cloneDeep(STATE.certificates.https), // in the .web() method, ssl gets mutated
                                                                            target: 'https://' + Q.headers.host + ':' + port,
                                                                            secure: false
                                                                        });  

                        } else { throw new Error('[e79] Invalid HTTPS port.'); }
                        
                    } else { C.response.quick_error({s, code: 404, text: '404 SITE NOT FOUND'}); }

                } catch(error) { C.request.handle_error({Q, s, type: 'PROXY', request_result: {id:'[e62.1]', error, text: 'Failed to handle request on HTTPS PROXY server - unknown error: '+error.message}}); }

            });
            
            PROCESSES.HTTPS_PROXY_SERVER.listen(443); // EACH HTTPS SITE HAS TO HAVE ITS OWN https_port (i.e. 8443, 8444, ...)

            C.process.bind_server_event_listeners(PROCESSES.PROXY_SERVER_SECURE, 'PROXY_SERVER_SECURE');
            C.process.bind_server_event_listeners(PROCESSES.HTTPS_PROXY_SERVER, 'HTTPS_PROXY_SERVER');
            
            // create real https server - for each https site, with its own certificate - and set site router
            PROCESSES.HTTPS_SERVERS = {};

            var site_list           = '';
            var site_count          = 0;
            var log_text            = '';
            var https_errors        = {};
            var https_promises      = {};
                https_promises.PROXY= new Promise(function(resolve, reject) { PROCESSES.HTTPS_PROXY_SERVER.on('listening', () => {resolve({ok:1});}); });

            for(site in S) {
                
                let SITE = S[site];
                let port = parseInt(SITE.config.https_port) || false;

                if( SITE.config && SITE.config.is_https && port ) {

                    let https_server = M.https.createServer(STATE.certificates.https, async function(Q, s) {
                        
                        try          { var handle_result = await C.request.handle(Q, s); }  // returns a result object, but all errors will be handled inside
                        catch(error) { var handle_error  = await C.request.handle_error({Q, s, request_result: {id:'[e63.2]', error, text: 'Failed to handle request on HTTPS server - unknown error: '+error.message}}); }
                        
                    }).listen(port); // EACH HTTPS SITE HAS TO HAVE ITS OWN https_port (i.e. 8443, 8444, ...)
                    
                    let server_id = port+'_'+SITE.name;

                    PROCESSES.HTTPS_SERVERS[server_id] = https_server;

                    C.process.bind_server_event_listeners(PROCESSES.HTTPS_SERVERS[server_id], 'HTTPS_SERVER_'+server_id);

                    https_promises[site] = new Promise(function(resolve, reject) { https_server.on('listening', () => {resolve({ok:1});}); });
                    
                }
                
            }

            // do not shutdown HTTPS proxy if there are no HTTPS sites anymore (there might be some turned on later on)
            /*if(site_list) {
                
                site_list   = site_list.slice(0, (site_list.length - 3))
                log_text    = 'Created proxied HTTPS servers for sites: ' + site_list + '.';
                
            } else {
                
                // no https sites, thus servers -> no need for https proxy server -> close it
                PROCESSES.HTTPS_PROXY_SERVER.close();
                delete PROCESSES.HTTPS_PROXY_SERVER;
                log_text = C.server.worker_id + 'No HTTPS sites loaded, HTTPS proxy server closed.';
                
            }*/
            
            var ALL_HTTPS_SERVERS_RUNNING = await C.promise.parallel(https_promises);

            M._.forEach(ALL_HTTPS_SERVERS_RUNNING, function(result_, server_name) {

                if(server_name !== 'ROOT') {

                    if(result_.ok)  { if(server_name !== 'PROXY') { site_count++; site_list += server_name + ' | '; } }
                    else            { https_errors[server_name] = result_.error; }

                }

            });

            site_list   = site_list.slice(0, (site_list.length - 3))
            log_text    = 'Created proxied HTTPS servers for ['+site_count+'] sites: ' + site_list + '.';

            if(M._.size(https_errors)) {

                log_text += '\r\n ---- ERRORS: ';
                M._.forEach(https_errors, function(error, server_name) { log_text += '\r\n -------- '+server_name+': '+error.message; });

            }

            result.ok       = 1;
            result.text     = log_text;
            result.errors   = https_errors;

            C.logger.bootup_step(result);

        } catch(error) { result = {...result, id: '[e61]', text: 'Failed to create HTTPS servers - unknown error: '+error.message, error}; }

        return result;

    } else { return previous_step; }
    
};

// populate STATE.certificates
exports.load_certificates = async function(previous_step = {}) {

    if(previous_step.ok) {

        var result  = {ok: 0, data: {previous_step}, id: '[i41]', text:'', error: null};

        try {

            // first load https certificates - https://nodejs.org/en/knowledge/HTTP/servers/how-to-create-a-HTTPS-server/
            if(CONFIG.core.https && CONFIG.core.certificates.https.key_file && CONFIG.core.certificates.https.crt_file) {

                STATE.certificates.https     = {};
                STATE.certificates.https.key = M.fs.readFileSync(CONFIG.core.certificates.https.key_file);
                STATE.certificates.https.cert= M.fs.readFileSync(CONFIG.core.certificates.https.crt_file);

            }

            result = {...result, ok: 1, text: 'Successfully loaded certificates.'};

        } catch(error) { result = {...result, id: '[e74]', text: 'Failed to load certificates - unknown error: '+error.message, error}; }

        C.logger.bootup_step(result);

        return result;

    } else { return previous_step; }

}

// DEPRECATED ... replaced by C.socket.create_master_server, C.socket.setup_worker and C.socket.connect_site
// creates Socket.IO server (only on 1 worker) (via HTTPS server) and create rooms for given sites and add handlers
exports.create_socket_io = async function(previous_step = {}) {

    if(previous_step.ok) {

        var result  = {ok: 0, data: {previous_step}, id: '[i13]', text:'', error: null};
        var cfg     = CONFIG.core.socket; // shortcut
        var secure  = CONFIG.core.socket.secure;

        try {
            
            // request must response with VALID HTML (content-type, <!doctype> AND a script with socket invocation)
            var handshake_handler =  function(q, s) {

                                        //s.writeHead(200, {'Content-Type': 'text/html', 'P3P': 'CP="CAO PSA OUR"', 'Access-Control-Allow-Origin': 'http://sheo.ss'});
                                        s.writeHead(200, {'Content-Type': 'text/html', 'P3P': 'CP="CAO PSA OUR"', 'Access-Control-Allow-Origin': '*'});

                                        // request must response with VALID HTML (content-type, <!doctype> AND a script with socket invocation)
                                        var handshake =`<!doctype html>
                                                        <html>
                                                            <head>
                                                                <script src='/socket.io/socket.io.js'></script>
                                                                <script>var socket = io();</script>
                                                                <meta http-equiv="P3P" content='CP="CAO PSA OUR"'>
                                                            </head>
                                                            <body></body>
                                                        </html>`;

                                        s.end(handshake);

                                    }
            
            // if secure, create socket server via HTTPS - needs certificate
            if(secure)  { PROCESSES.SOCKET_HANDSHAKE_SERVER = M.https.createServer( C.server.certificate, handshake_handler).listen(cfg.port);}     // create HTTPS server that serves socket io handshake !IMPORTANT
            else        { PROCESSES.SOCKET_HANDSHAKE_SERVER = M.http.createServer(handshake_handler).listen(cfg.port); }                            // insecure socket server - via HTTP - removes problem with accessing HTTP from HTTPS

            // creates socket.io server (attached to HTTPS or HTTP)
            //var options         = {cors: {origin: ['https://sheo.ss', 'https://opajda.ss'], methods: ["GET", "POST"]}} // https://socket.io/docs/v4/handling-cors/
            var options         = {cors: {origin: '*', methods: ["GET", "POST"]}} 

            PROCESSES.SOCKET_IO_SERVER= M.socket_io(PROCESSES.SOCKET_HANDSHAKE_SERVER, options);

            var log_text = 'Created Socket IO server. SITES: ';
            
            //loop through sites, and create room for every site with socket
            for(site in S) {
        
                var site_config = S[site].config;
                var site_socket = site_config.socket || false;

                if(site_socket) {

                    // require site socket handler (file path in site config) 
                    /*var site_root       = site_config.root
                    var handler_path    = M.path.join(site_root, site_socket.handler);
                    var socket_handler  = require(handler_path);
                    
                    // create site room in socket and add handler for connection
                    PROCESSES.SOCKET_IO_SERVER.of(site_socket.room).on('connection', socket_handler);*/
                    
                    // update log_text
                    log_text += site + ' | ';
                    
                }
                
            }

            result.ok   = 1;
            result.text = log_text;

            C.logger.bootup_step(result);
            
        } catch(error) { result = {...result, id: '[e23]', text: 'Failed to create Socket IO server - unknown error: '+error.message, error}; }

        return result;

    } else { return previous_step; }
    
};

exports.connect_process_to_DB = async function(previous_step={}) {

    if(previous_step.ok) {

        var result = {ok: 0, data: {previous_step}, id: '', text:'', error: null};

        try {

            var pid = M.cluster.isMaster ? 'MASTER' : 'WORKER_'+M.cluster.worker.id;

            var process_DB_data  = {log: true, site: pid, site_root: '', config: {...CONFIG.core, name: pid}};

            result = await C.sites.connect_site_to_DB(process_DB_data);

            result.data.previous_step = previous_step;

        } catch(error) { result = {...result, id: '[e59]', text: 'Failed to connect process to DB - unknown error: '+error.message, error}; }

        return result;

    } else { return previous_step; }

}

exports.extract_previous_steps = function(result={}, steps_by_id={}) {

    var current_step    = result;
    var all_steps       = {};
    var step_key        = '';

    while(current_step.data.previous_step) {

        step_key                    = steps_by_id[current_step.id] || current_step.id;

        // do not include result.data.previous_step ... it would lead to circular JSON error (but at the same time, do no remove it from the step)
        all_steps[step_key]         = M._.omit(current_step, ['data']); // omit data to prevent circular JSON
        all_steps[step_key].data    = M._.omit(current_step.data, ['previous_step']);

        current_step                = current_step.data.previous_step;

    }

    return all_steps;

}

// kill server as quickly as possible, possibly ungracefully
exports.shutdown = async function({shutdown_log_path='', trigger='unknown'}={}) {

    try {

        var process_name = M.cluster.isPrimary ? 'MASTER' : 'WORKER '+M.cluster?.worker?.id;
        C.logger.runtime_log({id:'[i60]', text: 'Starting shutdown on '+process_name});

        if(M.cluster.isPrimary) {

            // create shutdown log file if it hasnt been created yet, or is invalid
            if( !M.fs.existsSync(shutdown_log_path) ) shutdown_log_path = C.logger.shutdown.create_log_file(trigger);

            let shutdown_timeout = parseInt(CONFIG?.core?.shutdown_timeout) || 30;

            M.fs.appendFileSync(shutdown_log_path, '\r\n\r\n SERVER SHUT DOWN.');

            setTimeout(function() { process.exit(0); }, (shutdown_timeout*1000));  	// just in case, set timeout to exit immediately
            process.kill(process.pid); 								                // send kill signal, try to exit gracefully

        // called on worker, send shutdown request to master
        } else {

            C.process.EXECUTE_ON_MASTER({action: 'process.handlers.master.shutdown', type: 'master_handler', data: {trigger, shutdown_log_path}});

        }

    } catch(error) {

        C.logger.catch_unknown_runtime_error({id: '[e89]', error, text: 'Unknown error during shutdown: '+error.message}); // error will be saved in file, but wont have the time to save to DB

        if(M.cluster.isPrimary) { C.server.emergency_shutdown(); } 
        else                    { process.send({type: 'emergency_shutdown'}); }

    }

}

// close and kill all processes slowly, gracefully, giving them enough time to log the exit/close events into DB, if it timeouts, kill it ungracefully (total timeout is 30 seconds)
exports.shutdown_slowly = async function({trigger='unknown'}={}) {

    try {

        var process_name = M.cluster.isPrimary ? 'MASTER' : 'WORKER '+M.cluster?.worker?.id;
        C.logger.runtime_log({id:'[i61]', text: 'Starting slow shutdown on '+process_name});

        if(M.cluster.isPrimary) {

            // create shutdown log file if it hasnt been created yet, or is invalid
            var shutdown_log_path   = C.logger.shutdown.create_log_file(trigger);

            var append_result       = M.fs.appendFileSync(shutdown_log_path, '\r\n['+M.moment().format()+'][MASTER] Started graceful shutdown.');

            // send messages tu shutdown workers, set timeout for 15 seconds, after that, start shutting down master, set timeout for master for 15s, after that, if the server is not down yet, make an emergency exit
            var shutdown_workers_promise = new Promise(function(resolve, reject) {

                resolve(C.process.EXECUTE_ON_WORKERS('all', {action: 'process.handlers.worker.shutdown_worker', data: {shutdown_log_path}}));

                setTimeout(function() {resolve({ok:0, id:'[e90.2]', text: 'Worker shutdown promise timeout.'}); }, 15000);

            }).catch(function(error) {resolve({ok:0, id:'[e90.1]', error, text: 'Worker shutdown promise error: '+error?.message}); });

            let shutdown_workers_result = await shutdown_workers_promise; // if ok=1 --> {ok:1, ..., data: {..., results: {1: {}, 2: {}, ROOT: {}}}} OTHERWISE {ok: 0, text: '', ...}

            C.logger.runtime_log(shutdown_workers_result);

            // set a timeout for hard shutdown in case of soft shutdown failure
            setTimeout(C.server.emergency_shutdown, 15000);

            let shutdown_master_result = await C.server.shutdown_master({shutdown_log_path});

        // called on worker, send shutdown request to master
        } else {

            C.process.EXECUTE_ON_MASTER({action: 'process.handlers.master.shutdown_slowly', data: {trigger}});

        }

    } catch(error) {

        C.logger.catch_unknown_runtime_error({id: '[e90]', error, text: 'Unknown error during shutdown_slowly: '+error.message}); // error will be saved in file, but wont have the time to save to DB

        C.server.shutdown({trigger});

    }

}

exports.shutdown_master = async function({shutdown_log_path=''}={}) {

    var result  = {ok: 0, id: '[i63]', text: '', data: {}, error: null};

    try {

        // by this time, workers are already dead, all thats left to kill is rethinkdb and socket_handshake_server
        if(M.cluster.isPrimary) {

            // close SICKET HANDSHAKE SERVER
            var closed_socket_server = await C.server.close_http_server_by_name('SOCKET_HANDSHAKE_SERVER', PROCESSES.SOCKET_HANDSHAKE_SERVER);

            // wait 5 seconds after server closed to allow for some time to log the close events into DB, then kill the RETHINKDB
            var closed_RETHINKDB_promise= new Promise(function(resolve, reject) {

                setTimeout(function() { PROCESSES.RETHINKDB.kill(); resolve({time: C.helper.now(), text: 'Killed RETHINKDB process.'}); }, 5000);

            }).catch(function(error) { return {time: C.helper.now(), text: 'Error in closed_RETHINKDB_promise, failed to kill RETHINKDB: '+error?.message } });

            var closed_RETHINKDB = await closed_RETHINKDB_promise;

            // format text for log file and console log
            let s_t     = M.moment(closed_socket_server?.time).format();
            let r_t     = M.moment(closed_RETHINKDB?.time).format();
            let f_log   = '\r\n ['+s_t+'][MASTER] '+closed_socket_server?.text;
                f_log  += '\r\n ['+r_t+'][MASTER] '+closed_RETHINKDB?.text;

            // write results to shutdown log
            if(M.fs.existsSync(shutdown_log_path)) M.fs.appendFileSync(shutdown_log_path, f_log);

            result.text = 'Shutdown master result: '+closed_socket_server?.text+' | '+closed_RETHINKDB?.text;

            C.logger.runtime_log(result);

            // everything should be closed by now, finally kill the master process
            process.kill(process.pid);

        } else { result.text = 'server.shutdown_master must be called on master process.'; }

    } catch(error) { result = {...result, error, text: 'Unknown error during shutdown_master: '+error?.message}; }

    // if this code executes, the graceful shutdown was unsuccessfull
    C.logger.catch_unknown_runtime_error(result);

    return result;

}

// used in shutdown_slowly
exports.shutdown_worker = async function({shutdown_log_path=''}={}) {

    var result  = {ok: 0, id: '[i59]', text: '', data: {}, error: null};
    var wid     = M.cluster?.worker?.id;

    try {

        if(wid) {

            var log_exists = M.fs.existsSync(shutdown_log_path);

            // now close all server
            var server_close_promises   = {

                HTTP_PROXY_SERVER:      C.server.close_http_server_by_name('HTTP_PROXY_SERVER', PROCESSES.HTTP_PROXY_SERVER), // 5 seconds timeout to close the server
                HTTP_SERVER:            C.server.close_http_server_by_name('HTTP_SERVER', PROCESSES.HTTP_SERVER),
                HTTPS_PROXY_SERVER:     C.server.close_http_server_by_name('HTTPS_PROXY_SERVER', PROCESSES.HTTPS_PROXY_SERVER),
                SOCKET_IO_SERVER:       C.server.close_http_server_by_name('SOCKET_IO_SERVER', IO), // === PROCESSES.SOCKET_IO_SERVER // throws "ERR_SERVER_NOT_RUNNING", but the IO is closed
                SOCKET_HANDSHAKE_SERVER:C.server.close_http_server_by_name('SOCKET_HANDSHAKE_SERVER', PROCESSES.SOCKET_HANDSHAKE_SERVER),  // throws "ERR_SERVER_NOT_RUNNING"

            }

            M._.forOwn(PROCESSES.HTTPS_SERVERS, function(server_, server_name) {

                server_close_promises[server_name] = C.server.close_http_server_by_name(server_name, server_);

            });

            var server_close_results    = await C.promise.parallel(server_close_promises);

            // wait 5 seconds after servers closed to allow for some time to log the close events into DB, then kill the worker
            var worker_kill_promise     = new Promise(function(resolve, reject) {

                setTimeout(function() {

                    M.cluster.worker.kill();
                    resolve({time: C.helper.now(), text: 'Killed worker '+M.cluster.worker.id+'.'});

                }, 5000);

            }).catch(function(error) { return {time: C.helper.now(), text: 'Error in worker_kill_promise, failed to kill worker '+M.cluster.worker.id+': '+error?.message } });

            var worker_kill_result = await worker_kill_promise;

            // compile results
            var sc_log = '';
            var sc_res = '';

            M._.forOwn(server_close_results, function(scr, s_name) {

                if(s_name !== 'ROOT') {

                    if(scr.ok)  { let t = M.moment(scr?.resolved?.time).format(); sc_log +='\r\n ['+t+'][WORKER '+wid+'] '+scr?.resolved?.text; sc_res+= (scr?.resolved?.text + ' | ') }
                    else        { sc_log+='\r\n [WORKER '+wid+'] '+s_name+' failed to resolve: '+scr.error?.message; sc_res+=(s_name+' failed to resolve: '+scr.error?.message+' | '); }

                }

            });

            let w_t = M.moment(worker_kill_result?.time).format();
            sc_log += '\r\n ['+w_t+'][WORKER '+wid+'] '+worker_kill_result?.text;
            sc_res += worker_kill_result?.text + ' | ';

            // write results to shutdown log
            if(log_exists) M.fs.appendFileSync(shutdown_log_path, sc_log);

            result.ok   = 1;
            result.text = 'SHUTDOWN WORKER '+wid+' RESULT: '+sc_res;
            result.data = {server_close_results, worker_kill_result};

        } else { result.text = 'Failed to shutdown worker - invalid worker.'; }

    } catch(error) { result = {...result, ok: 0, id: '[e91]', error, text: 'Failed to shutdown worker '+wid+' - unknown error: '+error?.message} }

    if(result.ok) { C.logger.runtime_log(result); } else { C.logger.catch_unknown_runtime_error(result); }

    return result;

}

exports.close_http_server_by_name = async function(server_name='', SERVER=null) {

    var result = 'Server '+server_name+' not found.';

    try {

        if(SERVER) {

            var timeout_promise = new Promise(function(resolve, reject) {

                SERVER.close(function(error) { resolve({time: C.helper.now(), text: 'Server '+server_name+' closed.'+(error?.message ? (' (with error: '+error.message+')') : '')}); }); // Socket handshake and IO servers might close with  "ERR_SERVER_NOT_RUNNING" error

                setTimeout(function() { resolve({time: C.helper.now(), text: 'Attempt to close server '+server_name+' timeouted.'}); }, 5000);

            }).catch(function(err) { return {time: C.helper.now(), text: 'Error during server close timeout promise ('+server_name+') - '+err.message}; });

            result = await timeout_promise;

        } // server not found

    } catch(error) { result = {time: C.helper.now(), text: 'Failed to close server '+server_name+' - unknown error: '+error.message}; }

    return result;

}

// ! should be run only on master
exports.emergency_shutdown = function() {

    let shutdown_timeout = parseInt(CONFIG?.core?.shutdown_timeout) || 30;

    console.log('[i62] Emergency shutdown initiated. Server will now be killed. In case of failure, process will exit in '+shutdown_timeout+' seconds.');

    setTimeout(function() { process.exit(1); }, (shutdown_timeout*1000));  	// just in case, set timeout to exit immediately
    process.kill(process.pid); 								                // send kill signal, try to exit gracefully

}