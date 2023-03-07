
// insetad of socket.io use this 
// https://edisonchee.com/writing/intro-to-%C2%B5websockets.js/
// https://github.com/uNetworking/uWebSockets.js

// newly, socket.io/sticky methods enable the use of cluster - guide here https://socket.io/docs/v4/cluster-adapter/
const socket_io_sticky 	= require('@socket.io/sticky');
const socket_io_adapter = require('@socket.io/cluster-adapter');

// creates master Socket.IO server ... later on, on each server, workers will connect via adpapters, and then, during site load, each site will create a room for itself
exports.create_master_server = async function(previous_step = {}) {

    if(previous_step.ok) {

        var result  = {ok: 0, data: {previous_step}, id: '[i13]', text:'', error: null};

        try {

			var config = CONFIG?.core?.socket; // shortcut ... {enabled: true, host: '', port: 0, secure: true}

			if(config.enabled) {

				if(config.host && config.port) {
            
					// if secure, create socket server via HTTPS - needs certificate  ... POSTPONED ... @socket.io/sticky does not support HTTPS ... yet
					//if(config.secure) { PROCESSES.SOCKET_HANDSHAKE_SERVER = M.https.createServer(STATE.certificates.https);} 	// create HTTPS server that serves socket io handshake !IMPORTANT
					//else        		{ PROCESSES.SOCKET_HANDSHAKE_SERVER = M.http.createServer(); }                            // insecure socket server - via HTTP - removes problem with accessing HTTP from HTTPS

					PROCESSES.SOCKET_HANDSHAKE_SERVER = M.http.createServer();

					socket_io_sticky.setupMaster(PROCESSES.SOCKET_HANDSHAKE_SERVER, {loadBalancingMethod: "least-connection",}); // returns undefined
					socket_io_adapter.setupPrimary(); // returns undefined
					M.cluster.setupPrimary({serialization: "advanced",}) // undefined; this enables sending more complicated JS objects in messages instead of just JSON, but it might make performance worse
					PROCESSES.SOCKET_HANDSHAKE_SERVER.listen(config.port); // returns server

					C.process.bind_server_event_listeners(PROCESSES.SOCKET_HANDSHAKE_SERVER, 'SOCKET_HANDSHAKE_SERVER');

					STATE.socket.loaded_on_master = true;

					result.ok   = 1;
					result.text = 'Created Socket IO server ('+(config.secure ? 'HTTPS' : 'HTTP')+').';

				} else { result.text = 'Socket IO server could not be created - invalid data.'; }
				
			} else { result.text = 'Socket IO is turned of.'; }

			C.logger.bootup_step(result);

        } catch(error) { result = {...result, id: '[e23]', text: 'Failed to create Socket IO server - unknown error: '+error.message, error}; }

        return result;

    } else { return previous_step; }
    
};

// set-ups socket.io workers - bootstrap them to master server via adapters - guide here https://socket.io/docs/v4/cluster-adapter/
exports.setup_worker = async function(previous_step = {}) {

    if(previous_step.ok) {

        var result  = {ok: 0, data: {previous_step}, id: '[i13.1]', text:'', error: null};

        try {

			var config = CONFIG?.core?.socket; // shortcut ... {enabled: true, host: '', port: 0, secure: true}

			if(config.enabled) {

				if(config.host && config.port) {

					// the server needs to be created again on worker
					// if secure, create socket server via HTTPS - needs certificate ... POSTPONED ... @socket.io/sticky does not support HTTPS ... yet
					//if(config.secure) { PROCESSES.SOCKET_HANDSHAKE_SERVER = M.https.createServer(STATE.certificates.https);}	// create HTTPS server that serves socket io handshake !IMPORTANT
					//else        		{ PROCESSES.SOCKET_HANDSHAKE_SERVER = M.http.createServer(); }                           	// insecure socket server - via HTTP - removes problem with accessing HTTP from HTTPS
					
					PROCESSES.SOCKET_HANDSHAKE_SERVER = M.http.createServer();

					C.process.bind_server_event_listeners(PROCESSES.SOCKET_HANDSHAKE_SERVER, 'SOCKET_HANDSHAKE_SERVER');

					// creates socket.io server (attached to HTTPS or HTTP)
					//var options         		= {cors: {origin: ['https://sheo.ss', 'https://opajda.ss'], methods: ["GET", "POST"]}} // https://socket.io/docs/v4/handling-cors/
					var options         		= {cors: {origin: '*', methods: ["GET", "POST", "PUT", "DELETE"]}} 
					PROCESSES.SOCKET_IO_SERVER	= M.socket_io(PROCESSES.SOCKET_HANDSHAKE_SERVER, options);

					IO 							= PROCESSES.SOCKET_IO_SERVER; // save the IO process into the global varable ... enable all these methods https://socket.io/docs/v4/server-instance/

					IO.adapter(socket_io_adapter.createAdapter()); // returns the server
					socket_io_sticky.setupWorker(IO); // returns undefined

					// namespace for each site is created during site.load, sites can create their own custom namespaces after loading, but the name must be unique
					// PROCESSES.SOCKET_IO_SERVER.of(site_socket.room).on('connection', socket_handler);

					STATE.socket.loaded_on_worker = true;

					result.ok   = 1;
					result.text = 'Setup Socket IO server on worker '+M.cluster.worker.id+'.';

				} else { result.text = 'Socket IO server could not be setup on worker - invalid data.'; }
				
			} else { result.text = 'Socket IO is turned of. (worker)'; }

			C.logger.bootup_step(result);

        } catch(error) { result = {...result, id: '[e23.1]', text: 'Failed to setup Socket IO server on worker - unknown error: '+error.message, error}; }

        return result;

    } else { return previous_step; }

};

// run in site.load - to explain, each site that is to be connected to socket needs to be for safety reasons initiated - on first connection an init action is set that binds socket action handlers for this connection
exports.connect_site = async function({site='', site_root='', config = {}, log=false, SITE_BIN={}}={}) {

    var result  = {ok: 0, data: {}, id: '[i45]', text: '', error: null, steps: {}};

    try {

		if(STATE.socket.loaded_on_worker) {

			if(config?.socket?.connect_site && config?.socket?.namespace) {

				// check if namespace is unique
				if( !STATE.socket.connected_namespaces[config.socket.namespace] ) {

					var SITE_IO = IO.of(config.socket.namespace); // returns the local IO of this napespace // .on('connection', SITE_BIN.socket.connector)

					C.logger.bootup_step({id: 'i45.1', text: 'connecting site '+site+' to socket namespace'+config.socket.namespace+'...'});

					SITE_IO.on('connection', C.socket.connector); // init socket connection and bind event handlers

					result = {...result, ok: 1, text: 'Site '+site+' connected to socket.', data: {SITE_IO, namespace: config.socket.namespace}};

				} else { result = {...result, text: 'Socket namespace ('+config.socket.namespace+') is not unique, could not connect site '+site+' to socket.'}; }

			} else { result = {...result, ok: 1, text: 'Site '+site+' not to be connected to socket.'}; }

		} else { result = {...result, ok: 1, text: 'Socket not enabled.'}; }

		C.logger.bootup_step(result);

	} catch(error) { result = {...result, id: '[e78]', text: 'Failed to connect site '+site+' to socket - unknown error: '+error.message, error}; }

    return result;
    
};







// DO NOT TOUCH! just add handlers and event routes, MUST EXPORT A FUNCTION

// get object of all event handlers
// handlers MUST be a promise returning functions
//var handlers = S?.[site]?.socket_handlers || {};

//match events to handlers (via data.action send from frontend)
//var router = require('./router')(handlers); // must return a function ! (that returns object like; event: handler, ....)


// INIT EXPLAINED
// upon connection, sockets listen ONLY for INIT event, NOTHING ELSE. on INIT event, after checked request, the rest of listeners is attached. see? you are safe.


// MUST RETURN A FUNCTION with 1 argument - socket !!
exports.connector = async function(socket) {

	try {

		let site = socket?.nsp?.name || ''; // getting it out of the namespace
			site = site.slice(1);// remove first char - the "/"
		
		console.log('IO CONNECTION ['+site+']');

		// create request environment for socket event request connection
		var SITE    = S[site] || null;
		var Q       = null;
		
		if(SITE) {
			
			// all connections will be accepted only after init connection (where parent request is retrieved succesfully)
			socket.on('INIT', async function(data) {

				var return_event = data?.return_event || 'INIT_RESULT';

				try {
				
					console.log('INIT FIRED, connection of request '+data.request_id);
					
					if(data.request_id) {
						
						Q = await DB.GET(DBP, 'requests', {get: data.request_id});

						if(Q && Q.id) {

							// got parent request, now check if everything is alright, and attach site event handlers
							var handled_events  	= {};
							var ok_handled 			= 0;
							var total_handled 		= 0;
							var socket_handlers 	= SITE?.socket?.handlers || null;
							var socket_router 		= SITE?.socket?.router || null;

							if(socket_router && M._.isFunction(socket_router)) {

								var socket_routes = socket_router(socket_handlers) || {};

								for(EVENT in socket_routes) {

									let handler = socket_routes[EVENT];

									if(handler && handler?.constructor?.name === 'AsyncFunction') {

										// attach EVENT
										socket.on(EVENT, async function(e_data) {

											try { 			var event_result = await handler(Q, socket, SITE, e_data); } // result format: {ok: 1, id: '', data: {}, text: '', error: Error}
											catch(error) {	var event_result = {ok: 0, id: '[se3]', data: e_data, error, text: 'Failed to handle socket event - unknown error: '+error.message}; }

											// if data.return_event is set, this event will be emitted with result back to frontend
											if(e_data?.return_event && M._.isString(e_data.return_event)) socket.emit(e_data.return_event, event_result);
											
										});
									
										ok_handled++;
										handled_events[EVENT] = {ok: 1, text: EVENT+' initialized.'};
									
									} else { handled_events[EVENT] = {ok: 0, text: 'Event '+EVENT+' cannot be initialized - invalid handler.'}; }

									total_handled++;
									
								}
							
								// succesfully attached event handlers
								socket.emit(return_event, {ok: 1, id: '[se3.4]', text: 'Succesfully attached event handlers for '+ok_handled+'/'+total_handled+' events.', data: {handled_events}});

							} else { socket.emit(return_event, {ok: 0, id: '[se3.3]', data, text: 'Could not initialize socket connection - invalid socket router.', error: null}); }

						} else { data.Q = Q; socket.emit(return_event, {ok: 0, id: '[se3.2]', data, text: 'Could not initialize socket connection - invalid request.', error: null}); }
							
					} else { socket.emit(return_event, {ok: 0, id: '[se3.1]', data, text: 'Could not initialize socket connection - invalid request id.', error: null}); }

				} catch(error) { socket.emit(return_event, {ok: 0, id: '[se3.5]', data, text: 'Could not initialize socket connection - unknown error: '+error.message, error}); }

			});

		} else { C.logger.catch_unknown_runtime_error({id: '[se3.7]', error, text: 'Socket connector error - invalid site ('+site+').'}); }

	} catch(error) { C.logger.catch_unknown_runtime_error({id: '[se3.6]', error, text: 'Unknown socket connector error: '+error.message}); }

};

// not needed anymore
// request must response with VALID HTML (content-type, <!doctype> AND a script with socket invocation)
/*exports.handshake_handler = function(q, s) {

	//s.writeHead(200, {'Content-Type': 'text/html', 'P3P': 'CP="CAO PSA OUR"', 'Access-Control-Allow-Origin': 'http://sheo.ss'});
	s.writeHead(200, {'Content-Type': 'text/html', 'P3P': 'CP="CAO PSA OUR"', 'Access-Control-Allow-Origin': '*'});

	// request must response with VALID HTML (content-type, <!doctype> AND a script with socket invocation)
	var handshake =`<!doctype html>
					<html>
						<head>
							<script src='/socket.io/socket.io.js'></script>
							<script>var socket = io(); console.log('SOCKET.IO SERVER.', io);</script>
							<meta http-equiv="P3P" content='CP="CAO PSA OUR"'>
						</head>
						<body>AHOJ</body>
					</html>`;

	s.end(handshake);

}*/

// get all connections that are currently connected to socket on this worker (should be called only on workers), sorted by namespace
// result = {namespace_1: Map{'id123': socket, 'id456': socket}, namespace_2: Map{...}}
exports.get_current_connections = function() {

	var connections = {};

	if(IO && IO._nsps) {


		// IO._nsps is a Map object
		IO._nsps.forEach(function(namespace, namespace_name) {
			
			//connections[namespace_name] = connections[namespace_name] || {};

			connections[namespace_name] = namespace.sockets; // Map {} // socket === connection = { nsp: Namespace object, connected: bool, server, id: '...', rooms, ... }

			// to iterate through connections, use connection[nsp].forEach(...);

		});

	}

	return connections;

}