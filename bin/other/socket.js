
// NOTE:
/*
	BAD USECASE - CHATTING APPS
	socket servers running on this device are not a good fit for chatting applications (if the server runs on more than 1 worker) - socket.io servers are clustered
	and there is no adapter in place (socket.io cluster adapter + socket.io sticky sessions do not support HTTPS yet viz https://github.com/socketio/socket.io-sticky)
	... meaning that if you make a chatting application, some users join a chatroom on worker 1 and others will join the chatroom on worker 2, they wont be able to communicate
	between each other (nodeJS doesnt enable you to control which worker will the connection go through) which is kinda useless
	SOLUTIONS: if you want to run chatting application on this server, you can
				1) use only 1 worker
				2) use external socket.io servers (on different device, or script) that either support clustering or are powerfull enough to handle everything on 1 worker
						... -> in config, you have to add the socket server and set external: true (there is an example in config)... this will make sure the socket server wont be created on this device,
								but the config will be available for the sites to use

	GOOD USECASE - web apps (for example crypto exchanges)
	... good for applications that need socket to control the app, because using AJAX would be too cumbersome
*/

// there are no socket servers running on MASTER, but it will be pulling together all active sockets from all workers (sort of a simplified socket.io cluster adapter)
// but just for purposes of enabling simple chat applications
// DEPRECATED - doesnt serve any real usecase at the moment
exports.setup_socket_on_master = async function(previous_step={}) {
    
    if(previous_step.ok) {

        var result = {ok: 0, data: {previous_step}, id: '[i69]', text:'', error: null};

        try {
            
			IO.SOCKETS 		= {}; // all connections from all workers will be saved here
			PROCESSES.IO	= {}; // empty on master

			result.ok = 1;
			result.text = 'SETUP SOCKET.IO ON MASTER';

			C.logger.bootup_step(result);

        } catch(error) { result = {...result, id: '[e95]', text: 'Failed to setup socket.io on MASTER - unknown error: '+error.message, error}; }

        return result;

    } else { return previous_step; }
    
};


// if the socket server is not secure (ws://), it cannot be used on HTTPS sites
// if the socket server is secure (wss://), it must be hosted on domain, IP address cannot be used
exports.create_servers = async function(previous_step={}) {
    
    if(previous_step.ok) {

        var result = {ok: 0, data: {previous_step}, id: '[i64]', text:'', error: null};

        try {

            //PROCESSES.PROXY_SERVER_SECURE = M.proxy.createProxyServer({});
            //C.process.bind_server_event_listeners(PROCESSES.PROXY_SERVER_SECURE, 'PROXY_SERVER_SECURE');
            
			IO.SOCKETS 		= {}; 				// all connections on this worker will be saved here, on master they will be pooled together
			PROCESSES.IO	= {SERVERS: {}}; 	// all socket servers will be available here

			// call for start of all socket servers defined in config
			var results = {none: {ok: 1, id: '[i67]', text: 'Socket not enabled.', error: null}}

			if(CONFIG.core.socket.enabled) {

				results.none.text = 'No socket servers defined.';

				var socket_servers_to_be_started = []; // array of server names
				
				// do not create external socket servers on this machine
				M._.forEach(CONFIG.core.socket.servers, function(s_config, s_name) { if( !s_config.external ) socket_servers_to_be_started.push(s_name); });

				if(socket_servers_to_be_started.length) {

					delete results.none;

					var socket_server_promises = {};

					socket_servers_to_be_started.forEach(server_name => { socket_server_promises[server_name] = C.socket.create_server(server_name); });

					results = await C.promise.parallel(socket_server_promises);

				}

			}

			

			var socket_servers_created = {total: 0, ok: 0, failed: 0};

			// print result of each socket server
			M._.forEach(results, function(result_, key) {

				// ignore ROOT of parallel promise (unless it was overwritten by a socket server called ROOT)
				if(key === 'ROOT' && result_.resolved === 'ROOT') { /* ignore */ }
				else { // results of each socket server
					
					if(result_.ok) { 

						if(result_.resolved.ok) {
							
							STATE.socket.running_servers[key] = key; // update STATE of the worker 
							socket_servers_created['ok']++;

						} else { socket_servers_created['failed']++; }
						
						C.logger.bootup_step(result_.resolved); 

					} else { 
						
						result_.id 		= '[67.6]';
						result_.text 	= 'Socket server creation promise was rejected in parallel execution - '+result_.error?.message; 
						C.logger.bootup_step(result_); 
					
					}

					socket_servers_created['total']++;
				
				}

			});

			result.ok = 1;
			result.text = 'Created ['+socket_servers_created.total+'] socket servers: ('+socket_servers_created.ok+' ok) and ('+socket_servers_created.failed+' failed)';
			result.data.results = results;

			C.logger.bootup_step(result);

        } catch(error) { result = {...result, text: 'Failed to create HTTPS servers - unknown error: '+error.message, error}; }

        return result;

    } else { return previous_step; }
    
};

// used in C.socket.create_servers() only
exports.create_server = async function(server_name='') {

	var result	= {ok: 0, id: '[i67.1]', text: 'Invalid socket server.', error: null};

	if(CONFIG.core.socket.servers[server_name]) {

		var config = CONFIG.core.socket.servers[server_name];

		if(config.host && config.port && config.protocol) {

			var ws_uri 	= config.protocol+config.host+':'+config.port;
			var options = {

				transports: ['websocket'], 	// by default its ['polling', 'websocket'], but if polling is enabled, the cluster server would have to 
											// utilize '@socket.io/sticky' and @socket.io/cluster-adapter to match the workers with the requests (explained here https://socket.io/docs/v4/using-multiple-nodes/)
											// with 'websocket', the CPU ensures that the request reaches the same worker each time (the ws connection doesnt change)
											// @socket.io/sticky does not support HTTPS yet, and 'polling' is an unecessary performance hit anyway
																
				cors: {
						origin: 'http://localhost', 								// for proper security, here should be only hosts of sites running on this server, or a whitelist function can be used (https://www.npmjs.com/package/cors)
						methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
				}, 		// since its unecessary overhead to have a socket server for each site (on each worker)
						// there will instead be 1 regular (HTTP=WS) and 1 secure (HTTPS=WSS) socket.io server (on each worker)
						// the HTTP server will be on IP, but the secure one will be on some domain that has certificate (sheo.cz)
						// if other secure sites try to connect via socket, they will be connecting to sheo.cz - which will trigger CORS
						// thats why it needs to be allowed in the options
						// https://socket.io/docs/v4/handling-cors/

			};

			var IO_SERVER 		= {};

			if(config.secure) 	{ IO_SERVER.BASE = M.https.createServer(STATE.certificates.https); } 
			else 				{ IO_SERVER.BASE = M.http.createServer(); }
	
			IO_SERVER.SOCKET 	= new M.socket_io.Server(IO_SERVER.BASE, options);

			// special socket.io events - https://socket.io/docs/v4/server-instance/#Server-engine
			// IO_SERVER.SOCKET.engine.on('initial_headers', (headers, req) => {}); // enables to adjust headers of handshake ... not needed
			// IO_SERVER.SOCKET.engine.on('headers', (headers, req) => {}); 		// enables to adjust headers of the rest of HTTP requests ... not needed
			IO_SERVER.SOCKET.engine.on('connection_error', (err) => { 
				C.logger.catch_unknown_runtime_error({id: '[se5]', error, text: 'Socket connection error {code: '+err.code+', message: '+err.message+'}.'}); 
			}); // err = {req, code, message, context}

			// save to global IO and PROCESSES
			PROCESSES.IO.SERVERS[server_name] = IO_SERVER;

			// set middleware on global namespace - nothing can connect to the global namespace, authorization of other namespaces is handled later
			IO_SERVER.SOCKET.use((socket, next) => { let err = new Error('Global "/" namespace is forbidden.'); err.data = {id: '[se7]'}; next(err); });

			// deploy (start listening)
			var LISTENING_PROMISE = new Promise(function(resolve, reject) {

				IO_SERVER.BASE.listen(config.port);
				
				IO_SERVER.BASE.on('listening', function() {

					var r_ = IO_SERVER.BASE.listening 	
								? {ok: 1, id: '[i67.2]', text: 'Succesfully created SOCKET SERVER ['+server_name+'] and started listening on '+ws_uri+'.', error: null} 
								: {ok: 0, id: '[i67.3]', text: 'Failed to create SOCKET SERVER ['+server_name+'] - did not start listening on '+ws_uri+'.', error: null};

					resolve(r_);

				});

				// timeout after 30 seconds
				setTimeout(function() { resolve({ok: 0, id: '[i67.5]', text: 'Timeouted while trying to create SOCKET SERVER ['+server_name+'] - failed to start listening on '+ws_uri+'.', error: null}); }, 30000);

			}).catch(function(error) { return {ok: 0, id: '[i67.4]', text: 'Unknown error while trying to create SOCKET SERVER ['+server_name+'] - '+error.message, error} }); 

			result = await LISTENING_PROMISE;

		}

	}

	return result;

}


// _________________________________________________________ LEGACY - socket.io ____________________________________________________________________
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

// run in site.load - to explain, each site that is to be connected to socket needs to be for safety reasons bound to a namespace that enables the connections to be authorized
exports.bind_site_namespaces = async function({site='', site_root='', config={}, SITE_BIN={}, log=false}={}) {

    var result  = {ok: 0, data: {}, id: '[i45]', text: '', error: null, site, steps: {}};
	let config_	= config.site_socket || {};

    try {

		// first check if socket is enabled both in core and in site
		if(CONFIG.core.socket.enabled && config_.enabled) {

			// check if the socket server the site is trying to listen is running
			if(STATE.socket.running_servers[config_.server] && PROCESSES.IO.SERVERS[config_.server]) {

				let server_name 	= config_.server;
				let server_config 	= CONFIG.core.socket.servers[server_name];
				let server_url 		= server_config.protocol+server_config.host+':'+server_config.port;
				let SITE_IO			= PROCESSES.IO.SERVERS[server_name].SOCKET; // get the IO that is in the socket docs (server instance)
				let namespace_keys 	= Object.keys(config_.namespaces)

				// now start listening to all namespaces defined in site config, do not listen to the default "/" namespace
				if(namespace_keys.length) {

					// save the IO and namespace managers
					let result_IO 				= {IO: SITE_IO}; // available in SITE.SOCKET.IO
					let namespaces_results 		= [];
					let authorization_method	= SITE_BIN?.socket?.custom_connection_authorization || C.socket.authorize_connection;
					let rate_limitng_method		= SITE_BIN?.socket?.custom_connection_rate_limiting || C.socket.connection_rate_limiting;
					let connection_handler		= SITE_BIN?.socket?.custom_connection_handler 		|| C.socket.connection_handler;
					let artifical_delay			= config_?.artifical_delay 							|| CONFIG.core.socket.artifical_delay || 0;

					M._.forEach(config_.namespaces, function(namespace_, namespace_name) {

						// save to namespaces that are being listened to, and by what sites
						STATE.socket.listening_to_namespaces[namespace_] = STATE.socket.listening_to_namespaces[namespace_] || {sites: {}};
						STATE.socket.listening_to_namespaces[namespace_].sites[site] = site;

						result_IO[namespace_name] = SITE_IO.of(namespace_); // -> available in e.g. SITE.SOCKET.MAIN ... (MAIN = namespace_name) // returns the local IO of this namespace

						// RATE LIMITING - limit maximum of opened connections ... the rest will fail to connect (connect_error event will be emitted)
						result_IO[namespace_name].use(rate_limitng_method); // includes rate limiting (max 1000 open connections at time) (viz config)

						// AUTHORIZE socket connection via middleware ... rejected connections will emit the connect_error event that will be caught on frontend
						result_IO[namespace_name].use(authorization_method); 

						// artificial timeout - for testing purposes only
						result_IO[namespace_name].use(function(socket, next) { setTimeout(next, artifical_delay); });

						// bind connection handler
						result_IO[namespace_name].on('connection', connection_handler); // init socket connection and bind event handlers

						namespaces_results.push(namespace_+' ('+namespace_name+')');

					});



					result.ok 	= 1;
					result.text = 'Site '+site+' bound to socket server ['+server_url+'], listening on namespaces: '+(namespaces_results.join('; '));
					result.data = {SOCKET: result_IO};

				} else { result = {...result, ok: 1, text: 'No socket namespaces to listen to.'}; }

			} else { result = {...result, ok: 1, text: 'Invalid socket server.'}; }

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
// when an even is emitted, it will come here
exports.connection_handler = async function(socket) {

	var result = {ok: 1, id: '[se3]', data: {}, error: null, text: 'Failed to initialize socket connection (bind event listeners) - unknown error.'};

	// TO DO - socket events routing
	console.log('___________IO CONNECTION ['+socket.id+']'+socket.nsp.name);

	try {

		// pick important socket data
		let s			= {}
		s.id 			= socket.id;
		s.client_IP 	= socket.handshake.address; // IP of client
		s.client_HOST 	= socket.handshake.headers.host; // 127.0.0.1:8380
		s.client_ORIGIN	= socket.handshake.headers.origin; // http://localhost
		s.time 			= socket.handshake.issued; 	// socket.handshake.url is available too
		s.query 		= socket.handshake.query; 	// custom data sent from frontend (via query property of options)
		s.url 			= socket.handshake.url; 	//
		s.auth 			= socket.handshake.auth;
		s.namespace		= {name: socket.nsp.name};
		s.data			= socket.data; 				// data to share to mirror sockets on different workers, and to save from middlewares (.use())
		s.all_clients	= socket.server.engine.clients
		s.all_clients_count= socket.server.engine.clientsCount;	

		// first get SITE and check if its loaded and enabled
		let site_name 	= socket.handshake.query.site || '';
		let SITE 		= S[site_name];
		let Q 			= socket?.data?.Q || {}; // retrieve parent request data-  it might be empty (in case of connections that dont need any authorization)

		// start listening to events specified by site
		let handled_events  	= {};
		let ok_count 			= 0;
		let total_count 		= 0;
		let socket_handlers 	= SITE?.socket?.handlers || null;
		let socket_router 		= SITE?.socket?.router || null;
			
		if(socket_router && M._.isFunction(socket_router)) {
			
			let socket_routes = socket_router(socket_handlers, s.namespace.name) || {};
			
			for(EVENT in socket_routes) {
		
				let handler = socket_routes[EVENT];
				
				total_count++;
				
				// make sure handler is a promise returning function
				if(handler && M._.isFunction(handler)) {
		
					// start listening
					socket.on(EVENT, async function(e_data) {

						try { 			var event_result = await handler(Q, socket, SITE, e_data); } // result format: {ok: 1, id: '', data: {}, text: '', error: Error}
						catch(error) {	var event_result = {ok: 0, id: '[se3]', data: e_data, error, text: 'Failed to handle socket event - unknown error: '+error.message}; }

						// if data.return_event is set, this event will be emitted with result back to frontend
						if(e_data?.return_event && M._.isString(e_data.return_event)) socket.emit(e_data.return_event, event_result);
						
					});
				
					ok_count++;
					handled_events[EVENT] = {ok: 1, text: EVENT+' initialized.'};
				
				} else { handled_events[EVENT] = {ok: 0, text: 'Event '+EVENT+' cannot be initialized - invalid handler.'}; }
				
			}

			// succesfully started listening to events, emit init event
			result.ok 	= 1;
			result.data = {handled_events};
			result.text	= 'Succesfully initialized socket connection (bound '+ok_count+'/'+total_count+' event listeners)';

		} else { result.text = 'Could not initialize socket connection - invalid socket router.'; }

		//console.log('SOCKET CONNECTION HANDLER RESULT', result);
		socket.emit('INIT', result);

	} catch(error) { 
		
		result.text		= 'Failed to initialize socket connection (bind event listeners) - unknown error: '+error.message;
		result.error 	= error;

		C.logger.catch_unknown_runtime_error(result); 
		socket.emit('INIT', result);

	}

}

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

// https://socket.io/docs/v4/server-api/#serverusefn
// function must end with next() ... in case of success or next(err) ... in case of invalid
exports.connection_rate_limiting = async function(socket, next) {

	let connected_clients_count = parseInt(socket?.server?.engine?.clientsCount) || 999999; // in case of failing to get connected clients count, assume the server is full
	let allowed_clients_count	= parseInt(CONFIG?.core?.socket?.max_connections) || 1000;

	// server not full
	if(connected_clients_count < allowed_clients_count) { 
		
		next(); 
	
	// server full
	} else { 
		
		let err = new Error('Server is full, please try again later.');
			err.data = {id: '[se8]', connected_clients_count, allowed_clients_count};

		next(err);
	
	}

}

// https://socket.io/docs/v4/server-api/#serverusefn
// function must end with next() ... in case of success or next(err) ... in case of invalid authorization
exports.authorize_connection = async function(socket, next) {

	try {

		// pick important socket data
		let s			= {}
		s.id 			= socket.id;
		s.client_IP 	= socket.handshake.address; // IP of client
		s.client_HOST 	= socket.handshake.headers.host; // 127.0.0.1:8380
		s.client_ORIGIN	= socket.handshake.headers.origin; // http://localhost
		s.time 			= socket.handshake.issued; 	// socket.handshake.url is available too
		s.query 		= socket.handshake.query; 	// custom data sent from frontend (via query property of options)
		s.url 			= socket.handshake.url; 	//
		s.auth 			= socket.handshake.auth;
		s.namespace		= {name: socket.nsp.name};
		s.data			= socket.data; 				// data to share to mirror sockets on different workers
		s.all_clients	= socket.server.engine.clients
		s.all_clients_count= socket.server.engine.clientsCount;

		// for authorization, AUTH is the most important - possible values: (different for each namespace)
		// auth: {type: 'none'},												// allow all connections
		// auth: {type: 'request', request_id: request_id, same_site: true},  	// checks request, max age 24 h, only from same client IP and same site (if specified)
		// auth: {type: 'user', request_id: request_id, user_id: user_id, same_site: true},  

		// first get SITE and check if its loaded and enabled
		let site_name 	= socket.handshake.query.site || '';
		let SITE 		= S[site_name]; 
		let result 		= {ok: 0, text: 'Site is not enabled.', data: {id: '[se9]'}};

		if(C.sites.site_is_enabled(site_name)) {

			if(s.auth.type === 'none') { result = {ok: 1}; }

			// user authorization requires a request auth as well (user auth is a subset of request auth)
			if(s.auth.type === 'request' || s.auth.type === 'user') {

				let request_id = s.auth.request_id;

				if(request_id) {

					Q = await DB.GET(DBP, 'requests', {get: request_id});

					// check if request is valid
					if(Q && Q.id) {

						// save Q (request data) into socket, to make the Q available in socket connection_handler
						socket.data.Q = Q;

						// get time of request call (from ID)
						let call_time 	= parseInt(Q.id);
						let treshold 	= 24*60*60*1000; // 1 day
						let now 		= M.moment().format('x');
						let safe 		= Q.safe || {}; // special data saved in DB (table requests)

						// check if request is not expired
						if(now < (call_time + treshold) ) {

							// ONLY REQUEST AUTH
							if(s.auth.type === 'request') { result = {ok: 1}; }

							// USER AUTH
							if(s.auth.type === 'user') { 

								let user_id			= parseInt(s.auth.user_id);
								let logged_in_user	= parseInt(safe?.user);

								if(logged_in_user && logged_in_user === user_id) {

									result = {ok: 1};

								} else { result.text = 'Invalid or unauthorized user.'; result.data.id = '[se9.4]'; }

							 }

							 // SAME SITE CHECK
							 if(result.ok && s.auth.same_site) {

								// fail auth if site the request was made on is different from the one, that the socket is connecting from
								if(site_name !== safe?.site) { result = {ok: 0, text: 'Invalid site.', data: {id: '[se9.5]'}}; }

							 }

							 // client IP check
							 if(result.ok) {

								let client_ip_of_request 	= safe?.client_ip;	// on localhost '::1'   			... localhost in IPv6 (equivalent 127.0.0.1 in IPv4)
								let client_ip_of_socket		= s.client_IP; 		// on localhost '::ffff:127.0.0.1'	... is an IPv4 address expressed in IPv6 notation.

								let localhost_ips 			= {"::1": 1, "::ffff:127.0.0.1": 1, "127.0.0.1": 1};
								let request_from_localhost 	= localhost_ips[client_ip_of_request];
								let socket_from_localhost 	= localhost_ips[client_ip_of_socket];
								let both_from_localhost 	= (request_from_localhost && socket_from_localhost);
								
								if( !((client_ip_of_request === client_ip_of_socket) || both_from_localhost) ) {

									result = {ok: 0, text: 'Unauthorized client IP.', data: {id: '[se9.6]'}};

								}

							 }

						} else { result.text = 'Request expired.'; result.data.id = '[se9.3]'; }

					} else { result.text = 'Invalid request.'; result.data.id = '[se9.2]'; }

				} else { result.text = 'Invalid request ID.'; result.data.id = '[se9.1]'; }

			}

		}

		// authorized
		if(result.ok) {

			next();

		// authorization failed
		} else {

			let err 		= new Error(result.text);
				err.data 	= result.data;

			next(err);

		}

	} catch(error) { 
		
		error.message 	= 'Unknown socket authorize_connection error: '+error.message;
		error.data 		= {id: '[se6]'};
		C.logger.catch_unknown_runtime_error({id: error.data.id, error, text: error.message});
		
		next(error); // will be sent to front end via connect_error event
	
	}

}





// get all connections that are currently connected to socket on this worker (should be called only on workers), sorted by namespace
// result = {namespace_1: Map{'id123': socket, 'id456': socket}, namespace_2: Map{...}}

// SHOULD BE MOVED TO CORE SITE
exports.get_current_connections = function() {

	var connections = {};
	var io_ 		= PROCESSES.IO.SERVERS.REGULAR;

	if(io_ && io_._nsps) {


		// io_._nsps is a Map object
		io_._nsps.forEach(function(namespace, namespace_name) {
			
			//connections[namespace_name] = connections[namespace_name] || {};

			connections[namespace_name] = namespace.sockets; // Map {} // socket === connection = { nsp: Namespace object, connected: bool, server, id: '...', rooms, ... }

			// to iterate through connections, use connection[nsp].forEach(...);

		});

	}

	return connections;

}
