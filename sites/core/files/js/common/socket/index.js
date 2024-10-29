
// import promise resolving with Socket IO instance (manager)
exports.create = async function(namespace) {

        var request_id  = SERVER_DATA.request_id;
        var socket_data = SERVER_DATA.socket;
        var admin_id    = SERVER_DATA.admin?.id || 0;
        var result      = {ok: 0, error: null, text: 'Socket couldn\'t be connected due to missing prerequisities.', data: {id: '[fe4]'}};

        // check if everything socket needs exists
        if(request_id && socket_data.server && socket_data.host) {

            // check if namespace is valid
           if(socket_data.namespaces[namespace]) {

                var NS_path         = socket_data.namespaces[namespace];
                var socket_url      = socket_data.url + NS_path;
                var timeout         = (parseInt(socket_data.timeout) || 0) * 1000; // 0 = no timeout
                var socket_options  =   {
                                            //reconnection:           true,       // default
                                            //reconnectionDelay:      1000,       // default
                                            //reconnectionDelayMax:   5000,       // default
                                            //reconnectionAttempts:   Infinity,   // default
                                            reconnectionAttempts:   (24*60*60/5),   // keep trying reconnecting for 1 day max (assuming delay is 5 second) 
                                            //timeout:                20000,       // default // tried, doesnt work (for my purposes)
                                            forceNew:               true,
                                            transports:             ['websocket'], // default ["polling", "websocket"] ... polling is disabled because of cluster and workers
                                            query:                  {site: A.NAME},
                                            //auth:                   {type: 'none'},                                               // namespace specific
                                            //auth:                   {type: 'request', request_id: request_id, same_site: true},   // checks request, max age 24 h, only from same client IP and same site (if specified)
                                            auth:                   {type: 'user', request_id, user_id: admin_id, same_site: true},           // checks request AND if user was logged in in that request, max age 24 h, same IP, same site (if specified)
                                        };

                // conect to Socket.IO and save the handle int the global variable
                SOCKETS[namespace] = IO_CLIENT(socket_url, socket_options); // usually SOCKETS.MAIN and/or SOCKETS.ADMIN

                //create socket state
                STATE.SOCKETS = STATE.SOCKETS || {};
                STATE.SOCKETS[namespace] = {state: 'connecting', first_response: null, connection_resolve: null, connection_promise: null, connection_timeout: null}; // connection_promise will be fulfilled after first response (connect or connect_error) or timeout

                // create a promise that will resolve upon first response - timeout is implemented inside
                STATE.SOCKETS[namespace].connection_promise = new Promise(function(resolve, reject) { 
                    
                    STATE.SOCKETS[namespace].connection_resolve = resolve; // save resolve to STATE, it will be called when the connect event is emitted

                    if(timeout) { 
                        
                        STATE.SOCKETS[namespace].connection_timeout = setTimeout(function() {
                            resolve({ok: 0, error:null, text: 'Socket connection timeout.', data: {id: '[fe9.1]'}}); 
                            M.socket.destroy(namespace); // stop browser from trying to establish the connection
                        }, timeout); 
                    
                    }
                
                }).catch(function(error) { return {ok: 0, error, text: 'Unknown connection_promise error: '+error.message, data: {id: '[fe9.1]'}}; }); // if an already resolved promise is resolved again, nothing happens

                SOCKETS[namespace].on('connect',          ()      => { E.dispatch('ON_SOCKET_STATE_CHANGE', {state: 'connect', namespace, socket_url}); });
                SOCKETS[namespace].on('connect_error',    (err)   => { E.dispatch('ON_SOCKET_STATE_CHANGE', {state: 'connect_error', namespace, socket_url, err}); });
                SOCKETS[namespace].on('disconnect',       (reason)=> { E.dispatch('ON_SOCKET_STATE_CHANGE', {state: 'disconnect', namespace, socket_url, reason}); });

                SOCKETS[namespace].io.on('reconnect_attempt', ()  => { E.dispatch('ON_SOCKET_STATE_CHANGE', {state: 'reconnect_attempt', namespace, socket_url}); });
                SOCKETS[namespace].io.on('reconnect',         ()  => { E.dispatch('ON_SOCKET_STATE_CHANGE', {state: 'reconnect', namespace, socket_url}); });

                result = STATE.SOCKETS[namespace].connection_promise;


                //SOCKET.execute  = M.socket.execute; // create custom interface

                // now emit a first event, to check if everythings ok, and to authorize IO connection with server
                // IO will not be available without succesfull INIT event
                // INIT event respnse looks like this: {ok: 1, text: 'result text', data: {}}

                /*var return_event = 'INIT_RESULT_'+M.helpers.random_alpha_numeric(9);

                // init socket
                SOCKET.emit('INIT', {request_id, return_event});
                
                M.log.time('Waiting for socket connection.');

                // resolve with INIT result, timeout in 30 seconds
                var timeout = setTimeout(function() { 

                    SOCKET.off(return_event); 

                    reject(new Error('[se4] Socket initialization timeouted.')); 

                }, 30000);

                SOCKET.once(return_event, (result) => { clearTimeout(timeout); resolve(result); });*/

            } else { return {ok: 0, error: null, text: 'Socket couldn\'t be connected due to invalid namespace.', data: {id: '[fe4]'}}; }  

        }

        return result;
    
}

exports.destroy = function(namespace) {

    if(SOCKETS[namespace]) {

        SOCKETS[namespace].disconnect();

        delete SOCKETS[namespace];
        delete STATE.SOCKETS[namespace];

    }

}

exports.execute = async function(namespace, action, data={}, options={}) {

    // options = {return: bool (default false), timeout: <seconds> (default 10 (seconds), 0 = no timeout)}
    var result = {ok: 0, id: '[fe10]', text: 'Failed to execute socket emit - unknown error.', error: null, data: {}};

    try {

        let SOCKET = SOCKETS[namespace];

        if(SOCKET) {

            if(options.return) data.return_event = action+'_'+M.helpers.random_alpha_numeric(9);

            SOCKET.emit(action, data);
    
            // if data.return is true, expect a response from server - via a random unique event name generated here
            if(options.return) {

                result = await M.socket.listen_once(namespace, data.return_event, options);

                // in case of error, overwrite listen once ID for better error handling
                result.id = result.ok ? result.id : '[fe10.1]'; 
    
            // otherwise the event is considered succesfull and finished
            } else { result.ok = 1; result.text = 'Socket event successfully emitted.'; }

        } else {result.text = 'Failed to execute socket emit - invalid namespace.'}

    } catch(error) { result.error = error; result.text = 'Failed to execute socket emit: '+error.message; }

    return result;

}

exports.listen_once = async function(namespace, event, options={}) {

    // options = {timeout: <seconds> (default 30 (seconds), 0 = no timeout)}
    var result = {ok: 0, id: '[fe11]', text: 'Failed to listen once - unknown error.', error: null, data: {namespace, event}};

    try {

        let SOCKET = SOCKETS[namespace];

        if(SOCKET) {

            var response_promise = new Promise(function(resolve, reject) {

                var timeout_ms  = _.isNumber(options.timeout) ? (options.timeout * 1000) : 30000; // default 30 s, if 0 = no timeout
                var timeout     = null;

                // timeout
                if(timeout_ms) {

                    timeout = setTimeout(function() { 
                        
                        SOCKET.off(event); 
                        resolve({ok:0, id: '[fe11.2]', data: {}, text: 'Socket listen once timeout.', error: {message: 'Socket listen once timeout.'},}); 
                    
                    }, timeout_ms);

                }

                // listen to return event
                SOCKET.once(event, function(response) { if(timeout) { clearTimeout(timeout); }; resolve(response); });

            }).catch(error => {return {ok: 0, error, id: '[fe11.1]', data: {}, text: 'Failed to listen once - unknown error during response promise: '+error.message}; } );

            result = await response_promise;

        } else {result.text = 'Failed to listen once - invalid namespace.'}

    } catch(error) { result.error = error; result.text = 'Failed to listen once: '+error.message; }

    return result;

}

// now emit a first event, to check if everythings ok, and to authorize IO connection with server
// SOCKET will not listen to any events until initialization is finished
/*exports.init = async function(namespace) {

    var result = {ok: 0, text: '[fe7] Failed to initialize SOCKET.'+namespace+' - unknown error.', data: {namespace}, error: null};

    try {

        let socket          = SOCKETS[namespace];
        let state           = STATE.SOCKETS[namespace];
        let return_event    = 'INIT_RESULT_'+M.helpers.random_alpha_numeric(9);
        let request_id      = PRELOAD_DATA.request_id || 0;

        await state.resolvers.connected;

        M.log.time('Starting initialization of SOCKET.'+namespace);

        // init socket
        socket.emit('INIT', {request_id, return_event});

        var timeout_promise = new Promise(function(resolve, reject) {

            // resolve with INIT result, timeout in config|30 seconds
            let timeout_duration = ((parseInt(PRELOAD_DATA.socket.timeout)) || 30) * 1000;
            let timeout = setTimeout(function() { 

                socket.off(return_event); 
                resolve({ok: 0, data: {namespace}, text: 'INIT TIMEOUT.', error: new Error('Failed to initialize SOCKET.'+namespace+' - INIT TIMEOUT.')});

            }, timeout_duration);

            socket.once(return_event, (result_) => { clearTimeout(timeout); resolve(result_); });

        }).catch(function(error) { return {ok: 0, error, data: {namespace}, text: 'Failed to initialize SOCKET.'+namespace+' - unknown error during timeout: '+error.message}; });

        result = await timeout_promise;

        if(result.ok)   { M.log.time(result); }
        else            { M.log.error(result.error||{}, '[fe8] SOCKET INIT ERROR'); }

    } catch(error) {

        result.text = 'Failed to initialize SOCKET.'+namespace+' - '+error.message;
        result.error = error;
        M.log.error(error, '[fe6] SOCKET INIT ERROR');

    }

    return result;

}*/

// do once, return promise, global.SOCKET must be populated (connected instance)
/*exports.execute_ = function(route, data={}, options={}) {
    
    // options = {return: bool (default false), timeout: <seconds> (default 10 (seconds), 0 = no timeout)}
    var a_id = '[si0]';

    return new Promise((resolve, reject) => {
 
        if(options.return) data.return_event = route+'_'+M.helpers.random_alpha_numeric(9);

        SOCKET.emit(route, data);

        // if data.return is true, expect a response from server - via a random unique event name generated here
        if(options.return) {

            // timeout
            if(options.timeout) {

                var timeout = setTimeout(function() { 
                    
                    SOCKET.off(data.return_event); 
                    reject({ok:0, id: a_id, data, text: 'Socket event timeout.', error: {message: 'Socket event timeout.'},}); 
                
                }, (options.timeout*1000));

            }

            SOCKET.once(data.return_event, function(result) { 
                
                if(options.timeout) clearTimeout(timeout);

                resolve(result); 
            
            });

        // otherwise the event is considered succesfull and finished
        } else { resolve({ok: 1, id: a_id, text: 'Socket event successfully sent.', data, error: null}); }
        
    }).catch(function(error) { return {ok: 0, id: a_id, data, error, text: 'Unknown socket.execute error: '+error.message}; });
    
}*/