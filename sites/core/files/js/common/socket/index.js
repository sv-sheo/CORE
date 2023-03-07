
// import promise resolving with Socket IO instance
exports.connect = function() {
    
    return new Promise((resolve, reject) => {

        var request_id  = PRELOAD_DATA.request_id;
        var socket_data = PRELOAD_DATA.socket;

        // check if everything socket needs exists
        if(request_id && socket_data.host && io) { // io is defined in a standalone script provided by the socket_io server (index.html must have <script src="https://sheo.cz:8442/socket.io/socket.io.js"></script>)

            var socket_url      = socket_data.protocol+'://'+socket_data.host+':'+socket_data.port+socket_data.namespace;
            var socket_options  =   {
                                        reconnection:           true,
                                        reconnectionDelay:      1000,
                                        reconnectionDelayMax:   5000,
                                        reconnectionAttempts:   Infinity,
                                        forceNew:               true
                                    };

            // conect to Socket.IO and save the handle int the global variable
            SOCKET = io(socket_url, socket_options);

            SOCKET.execute  = M.socket.execute; // create custom interface

            // now emit a first event, to check if everythings ok, and to authorize IO connection with server
            // IO will not be available without succesfull INIT event
            // INIT event respnse looks like this: {ok: 1, text: 'result text', data: {}}

            var return_event = 'INIT_RESULT_'+M.helpers.random_alpha_numeric(9);

            // init socket
            SOCKET.emit('INIT', {request_id, return_event});
            
            M.log.time('Waiting for socket connection.');

            // resolve with INIT result, timeout in 30 seconds
            var timeout = setTimeout(function() { 

                SOCKET.off(return_event); 

                reject(new Error('[se4] Socket initialization timeouted.')); 

            }, 30000);

            SOCKET.once(return_event, (result) => { clearTimeout(timeout); resolve(result); });

        } else { reject(new Error('[se4] Socket couldn\'t be connected due to missing prerequisities.')); }  
        
    });
    
}

// do once, return promise, global.SOCKET must be populated (connected instance)
exports.execute = function(route, data={}, options={}) {
    
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
    
}