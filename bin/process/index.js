// DEPICTION OF MASTER-WORKER COMMUNICATION FLOW
//				
//	WORKER -> MASTER
//	._______________________________________________________________________________________________.
//	| executed on:	|| WORKER			 | MASTER					 | WORKER						|
//	|_______________||___________________|___________________________|______________________________|
//	| method:		|| EXECUTE_ON_MASTER | EXECUTE_ON_MASTER_HANDLER | EXECUTE_ON_MASTER_RESPONSE	|
//	|_______________||___________________|___________________________|______________________________|
//
//	flow: [on worker] EXECUTE_ON_MASTER -> process.send -> [on master] MAKE_MASTER_LISTEN_TO_WORKER -> EXECUTE_ON_MASTER_HANDLER -> CUSTOM MASTER HANDLER (in master_handlers.js) 	-> (optionally) process.send -> [some workers] MAKE_WORKER_LISTEN_TO_MASTER -> EXECUTE_ON_WORKER_HANDLER -> CUSTOM WORKER HANDLER (in worker_handlers.js) -> (always) process.send -> [MASTER] -> MAKE_MASTER_LISTEN_TO_WORKER  -> EXECUTE_ON_WORKER_RESPONSE
//																																													-> (always, simultaneously) process.send -> [the original worker] MAKE_WORKER_LISTEN_TO_MASTER -> EXECUTE_ON_MASTER_RESPONSE
// 
//
//	MASTER -> WORKER
//	._______________________________________________________________________________________________.
//	| executed on:	|| MASTER			 | WORKER					 | MASTER						|
//	|_______________||___________________|___________________________|______________________________|
//	| method:		|| EXECUTE_ON_WORKER | EXECUTE_ON_WORKER_HANDLER | EXECUTE_ON_WORKER_RESPONSE	|
//	|_______________||___________________|___________________________|______________________________|
//

//exports.handlers = { 'master': require('./master_handlers'), 'worker': require('./worker_handlers') };
exports.handlers 	= require('./handlers');
exports.admin 		= require('./admin');

exports.promise_handlers = {}; // internal storage for resolve/reject functions of promises (it is created on EXECUTE and used in EXECUTE_*_RESPONSE)

// this function is executed on MASTER when it receives a message from WORKER - there may be 2 types of messages: 1) to execute something some WORKER wants to have done OR 2) a response from WORKER after it has done something the MASTER wanted him to do
exports.MAKE_MASTER_LISTEN_TO_WORKER = async function(message) { // IMPORTANT: all functions inside message object will be removed during process.send 

	var result = {ok: 1, id: '[i49]', text: 'Empty message.', data: {message}, error: null};

	try {

		// handling some CORE messages
		if(message && message.action && message.type) {

			// emergency shutdown bypass
			if(message.type === 'emergency_shutdown') { C.server.emergency_shutdown(); }

			if(message.type === 'master_handler') 	{ result = await C.process.EXECUTE_ON_MASTER_HANDLER(message); } 	// execute something some WORKER wants to have done
			if(message.type === 'worker_response') 	{ result = await C.process.EXECUTE_ON_WORKER_RESPONSE(message); } 	// a response from WORKER after it has done something the MASTER wanted him to do

		// handling some 3rd party messages (like socket.io cluster adapter)
		} else { result = {...result, ok: 1, text: 'Message handled by a 3rd party with their own handler.'};  }

	} catch(error) { result = {...result, ok: 0, id: '[e80]', error, text: 'Unknown error during MAKE_MASTER_LISTEN_TO_WORKER: '+error.message}; }

	if(result?.ok) {	
		
		// C.logger.runtime_log(result); // use only for debugging
	
	} else { C.logger.catch_unknown_runtime_error(result); }

	return result;

}

// this function is executed on WORKER when it receives a message from MASTER - there may be 2 types of messages: 1) to execute some order from MASTER OR 2) a response from MASTER after it has done something the WORKER wanted him to do
exports.MAKE_WORKER_LISTEN_TO_MASTER = async function(message) { // IMPORTANT: all functions inside message object will be removed during process.send 

	var result = {ok: 1, id: '[i50]', text: 'Empty message.', data: {message}, error: null};

	try {

		// handling some CORE messages
		if(message && message.action && message.type) {

			if(message.type === 'worker_handler') 	{ result = await C.process.EXECUTE_ON_WORKER_HANDLER(message); } 	// execute some order given by MASTER
			if(message.type === 'master_response') 	{ result = await C.process.EXECUTE_ON_MASTER_RESPONSE(message); } 	// a response from MASTER after it has done something the WORKER wanted him to do

		// handling some 3rd party messages (like socket.io cluster adapter)
		} else { result = {...result, ok: 1, text: 'Message handled by a 3rd party with their own handler.'};  }

	} catch(error) { result = {...result, ok: 0, id: '[e81]', error, text: 'Unknown error during MAKE_WORKER_LISTEN_TO_MASTER: '+error.message}; }

	if(result?.ok) {	
		
		//C.logger.runtime_log(result); 
	
	} else { C.logger.catch_unknown_runtime_error(result); }

	return result;

}

// this function is called and being executed on WORKER - its sending instructions to MASTER what to do
exports.EXECUTE_ON_MASTER = function(message = {action: '', data: {}}) { // IMPORTANT: all functions inside message object will be removed during process.send 

	var result = {ok: 0, id: '[i46]', text: '', data: {message}, resolved: null, error: null}; // structure of result

	return new Promise(function(resolve, reject) {

		message.action = message.action || '';

		if(M.cluster.isWorker && C.server.worker_id) {

			// extend message for internal core functionality
			message.type 				= 'master_handler';
			message.worker_id 			= C.server.worker_id; // append to data id of worker that issued the action
			message.id					= 'worker_to_master_order_'+message.action+'_'+C.server.worker_id+'_'+C.helper.random_alpha_numeric(6); // this serves for retrieving resolve and reject of this promise in C.process.promise_handlers
			
			// store resolve/reject in C.process.promise_handlers so that EXECUTE_ON_MASTER_RESPONSE can access them
			C.process.promise_handlers[message.id] = {resolve, reject};

			process.send(message); // this is sent for execution to MASTER (-> MAKE_MASTER_LISTEN_TO_WORKER -> EXECUTE_ON_MASTER_HANDLER)

			// this promise is resolved in EXECUTE_ON_MASTER_RESPONSE

		} else { resolve({...result, id: '[e31]', text: 'Must be called on WORKER process.'}); }

	}).catch(function(error) { return {...result, id: '[e31]', error, text: 'Failed to execute ['+message?.action+'] on master - unknown error: '+error.message}; });

}

// this is continuation of EXECUTE_ON_MASTER, that is being executed od MASTER
exports.EXECUTE_ON_MASTER_HANDLER = async function(message={}) { // IMPORTANT: all functions inside message object will be removed during process.send 

	let result 		= {ok: 0, id: '[e35]', text: '', data: {}, resolved: null, error: null}; // structure of result
	let action 		= message?.action || 'unknown action';
	let wid 		= message?.worker_id || 'unknown';
	let worker 		= M.cluster.workers[wid];
	message.type 	= 'master_response';

	try {

		let handler = M._.get(C, message?.action, null);
		let resolved= null;

		if(handler && M._.isFunction(handler)) {

			resolved 	= await handler(message);
			result 		= {...result, ok: 1, id: '[i54]', resolved, text: 'Successfully executed action ['+action+'] on [MASTER] initiated by [worker '+wid+'].'}

		} else { result = {...result, text: 'Failed to execute action ['+action+'] on [MASTER] initiated by [worker '+wid+'] - Invalid handler on master.'}; }

																	// process.send cant have any non-JSON compliant stuff in message (for example functions) ... get rid of these with the JSON.parse walk-around
		message.resolved = JSON.parse(JSON.stringify(result)); 		// save data the handler resolved with to message, that shall be sent back to MASTER in a response
		worker.send(message);										// send results back to the WORKER: -> MAKE_WORKER_LISTEN_TO_MASTER -> EXECUTE_ON_MASTER_RESPONSE

	} catch(error) {

		result.error	= error;
		result.text 	= 'Failed to execute action ['+action+'] on [MASTER] initiated by [worker '+wid+'] - unknown EXECUTE_ON_MASTER_HANDLER error: '+error.message;

		message.resolved = result;
		worker.send(message);

	}

	return result;
	
}

// this is continuation of EXECUTE_ON_MASTER, that is being executed back on WORKER again
exports.EXECUTE_ON_MASTER_RESPONSE = async function(message={}) { // IMPORTANT: all functions inside message object will be removed during process.send 

	var result 	= {ok: 0, id: '[e36]', text: '', data: {message}, resolved: null, error: null}; // structure of result
	var action 	= message?.action || 'unknown action';

	try {

		if(message.id && C.process?.promise_handlers?.[message.id]?.resolve && M._.isFunction(C.process.promise_handlers[message.id].resolve)) {
			
			result = {...result, ok: 1, id: '[i51]', text: 'Successfully resolved EXECUTE_ON_MASTER action ['+action+'].' };

			result.resolved = message?.resolved || null;

			resolve = C.process.promise_handlers[message.id].resolve;
			resolve(result);

		} else { result.text = 'Failed to resolve EXECUTE_ON_MASTER action ['+action+'] - Could not find resolve in promise handlers.'; }

		if(message.id) delete C.process?.promise_handlers?.[message.id]; // delete it regardless of the validity of its contents

	} catch(error) {

		if(message.id) delete C.process?.promise_handlers?.[message.id]; // delete it regardless of the validity of its contents

		result.error	= error;
		result.text 	= 'Failed to resolve EXECUTE_ON_MASTER action ['+action+'] - unknown EXECUTE_ON_MASTER_RESPONSE error: '+error.message; 

	}

	return result;

}

// this function is being executed on MASTER - its sending instructions to WORKER what to do
exports.EXECUTE_ON_WORKER = function(message = {action: '', worker_id: 0, data: {}}) { // IMPORTANT: all functions inside message object will be removed during process.send 

	var result = {ok: 0, id: '[i52]', text: '', data: {message}, resolved: null, error: null}; // structure of result

	return new Promise(function(resolve, reject) {

		message.action 		= message.action || '';
		message.worker_id 	= message.worker_id || 0;

		if(M.cluster.isMaster) {

			if(message.worker_id && M.cluster.workers[message.worker_id]) {

				// extend message for internal core functionality
				message.type 				= 'worker_handler';
				message.id					= 'master_to_worker_order_'+message.action+'_'+C.helper.random_alpha_numeric(6); // this serves for retrieving resolve and reject of this promise in C.process.promise_handlers
				let worker 					= M.cluster.workers[message.worker_id];

				// store resolve/reject in C.process.promise_handlers so that EXECUTE_ON_MASTER_RESPONSE can access them
				C.process.promise_handlers[message.id] = {resolve, reject};

				worker.send(message); // this is sent for execution to WORKER (-> MAKE_WORKER_LISTEN_TO_MASTER -> EXECUTE_ON_WORKER_HANDLER)

				// this promise is resolved in EXECUTE_ON_WORKER_RESPONSE

			} else { resolve({...result, id: '[e32.1]', text: 'Invalid worker ID.'}); }

		} else { resolve({...result, id: '[e32.1]', text: 'Must be called on MASTER process.'}); }

	}).catch(function(error) { return {...result, id: '[e32]', error, text: 'Failed to execute ['+message?.action+'] on worker ('+message?.worker_id+') - unknown error: '+error.message}; });

}

// this is continuation of EXECUTE_ON_WORKER, that is being executed od WORKER
exports.EXECUTE_ON_WORKER_HANDLER = async function(message={}) { // IMPORTANT: all functions inside message object will be removed during process.send 

	let result 		= {ok: 0, id: '[e37]', text: '', data: {}, resolved: null, error: null}; // structure of result
	let action 		= message?.action || 'unknown action';
	let wid 		= message?.worker_id || 'unknown';
	message.type 	= 'worker_response';

	try {
		
		//let handler = C.process.handlers.worker[message.action];
		let handler 	= M._.get(C, message?.action, null);
		let resolved 	= null;

		if(handler && M._.isFunction(handler)) {

			resolved 	= await handler(message); // do the stuff that the WORKER requested
			result 		= {...result, ok: 1, id: '[i53]', resolved, text: 'Successfully executed action ['+action+'] on [worker '+wid+'].'}

		} else { result = {...result, text: 'Failed to execute action ['+action+'] on [worker '+wid+'] - Invalid handler on worker.'}; }

		let to_send_back = resolved || result;
																	// process.send cant have any non-JSON compliant stuff in message (for example functions) ... get rid of these with the JSON.parse walk-around
		message.resolved = JSON.parse(JSON.stringify(to_send_back));// save data the handler resolved with to message, that shall be sent back to MASTER in a response
		process.send(message);										// send results back to the MASTER: -> MAKE_MASTER_LISTEN_TO_WORKER -> EXECUTE_ON_WORKER_RESPONSE

	} catch(error) {

		result.error	= error;
		result.text 	= 'Failed to execute action ['+action+'] on [worker '+wid+'] - unknown EXECUTE_ON_WORKER_HANDLER error: '+error.message;

		message.resolved = result;
		process.send(message);

	}

	return result;

}

// this is continuation of EXECUTE_ON_WORKER, that is being executed back on MASTER again
exports.EXECUTE_ON_WORKER_RESPONSE = async function(message={}) { // IMPORTANT: all functions inside message object will be removed during process.send ¨

	var result 	= {ok: 0, id: '[e38]', text: '', data: {message}, resolved: null, error: null}; // structure of result
	var action 	= message?.action || 'unknown action';
	var wid  	= message?.worker_id || 'unknown';

	try {

		if(message.id && C.process?.promise_handlers?.[message.id]?.resolve && M._.isFunction(C.process.promise_handlers[message.id].resolve)) {

			result = {...result, ok: 1, id: '[i52]', text: 'Successfully resolved EXECUTE_ON_WORKER (worker '+wid+') action ['+action+'].' };

			result.resolved = message?.resolved || null;

			resolve = C.process.promise_handlers[message.id].resolve;
			resolve(result);

		} else { result.text = 'Failed to resolve EXECUTE_ON_WORKER (worker '+wid+') action ['+action+'] - Could not find resolve in promise handlers.'; }

		if(message.id) delete C.process?.promise_handlers?.[message.id]; // delete it regardless of the validity of its contents

	} catch(error) {

		if(message.id) delete C.process?.promise_handlers?.[message.id]; // delete it regardless of the validity of its contents

		result.error	= error;
		result.text 	= 'Failed to resolve EXECUTE_ON_WORKER (worker '+wid+') action ['+action+'] - unknown EXECUTE_ON_WORKER_RESPONSE error: '+error.message; 

	}

	return result;

}

exports.EXECUTE_ON_WORKERS = async function(workers=[], message={action: '', worker_id: 0, data: {}}) {

	let result = {ok: 0, id: '[i55]', data: {message, workers}, error: null, text: '' };
	let action = message?.action || 'unknown action';

	try {

		message_promises = {};

		if(workers === 'all') workers = Object.keys(M.cluster.workers);

		workers.forEach(function(worker_id) {

			if( M.cluster.workers[worker_id]) {
				
				let worker_message 			 = structuredClone(message);
					worker_message.worker_id = worker_id;

				message_promises[worker_id]  = C.process.EXECUTE_ON_WORKER(worker_message);

			}

		});

		result.data.results = await C.promise.parallel(message_promises);

		result = {...result, ok: 1, text: 'Successfully executed action ['+action+'] on workers: '+workers.join(',')};

	} catch(error) { result = {...result, id: '[e82]', error, text: 'Unknown error during EXECUTE ON WORKERS (action '+action+') - '+error?.message}}

	return result;

}

// try to save each event of each process to DB (the record will stay for 24 hours), do not wait for response
exports.bind_process_event_listeners = function(process_name='unknown', type='') {

	try {

		var PROCESS_ = M._.get(PROCESSES, process_name, false);

		if(PROCESS_) {

			// get from MASTER proccess {pid, ppid, uptime(), cpuUsage(), resourceUsage(), memoryUsage()}
			// get from WORKER proccess {pid, connected bool, killed bool}
			
			// beforeExit event is emitted when Node.js empties its event loop and has no additional work to schedule ... code = 0 usually .. does not trigger upon calling process.exit() !!!
			PROCESS_.on('beforeExit', function(code) { C.process.admin.log_event({event_: 'beforeExit', type, process_name, arguments: {code}}); });

			// If the Node.js process is spawned with an IPC channel, the 'disconnect' event will be emitted when the IPC channel is closed.
			PROCESS_.on('disconnect', function() { C.process.admin.log_event({event_: 'disconnect', type, process_name, arguments: {}}); });

			// message events are handled during the MASTER<->WORKER communication
			//If the Node.js process is spawned with an IPC channel (see the Child Process and Cluster documentation), the 'message' event is emitted whenever a message sent by a parent process using childprocess.send() is received by the child process.
			// PROCESS_.on('message', function(message) { C.process.admin.log_event({event_: 'message', type, process_name, arguments: {message}}); } );

			// The 'rejectionHandled' event is emitted whenever a Promise has been rejected and an error handler was attached to it (using promise.catch(), for example) later than one turn of the Node.js event loop.
			// The Promise object would have previously been emitted in an 'unhandledRejection' event, but during the course of processing gained a rejection handler.
			PROCESS_.on('rejectionHandled', function(promise_) { C.process.admin.log_event({event_: 'rejectionHandled', type, process_name, arguments: {promise_}}); } );

			// The 'unhandledRejection' event is emitted whenever a Promise is rejected and no error handler is attached to the promise within a turn of the event loop.
			PROCESS_.on('unhandledRejection', function(reason, promise_) { C.process.admin.log_event({event_: 'unhandledRejection', type, process_name, arguments: {reason, promise_}}); } );

			// use uncaughtExceptionMonitor instead of uncaughtException ... to preserve native handler of uncaughtException (adding a listener to it would overwrite it), 
			// The 'uncaughtException' event is emitted when an uncaught JavaScript exception bubbles all the way back to the event loop. By default, Node.js handles such exceptions by printing the stack trace to stderr and exiting with code 1, overriding any previously set process.exitCode.
			PROCESS_.on('uncaughtExceptionMonitor', function(error, origin) { C.process.admin.log_event({event_: 'uncaughtExceptionMonitor', type, process_name, arguments: {error, origin}}); } );

			// The 'warning' event is emitted whenever Node.js emits a process warning. ... warning = {name: '', message: '', stack: ''}
			PROCESS_.on('warning', function(warning) { C.process.admin.log_event({event_: 'warning', type, process_name, arguments: {warning}}); } );

			// The 'worker' event is emitted after a new <Worker> thread has been created.
			PROCESS_.on('worker', function(worker) { C.process.admin.log_event({event_: 'worker', type, process_name, arguments: {worker}}); } );


			// The 'exit' event is emitted when the Node.js process is about to exit as a result of either:
				// The process.exit() method being called explicitly;
				// The Node.js event loop no longer having any additional work to perform.
			// There is no way to prevent the exiting of the event loop at this point, and once all 'exit' listeners have finished running the Node.js process will terminate.
			// Listener functions must only perform synchronous operations. The Node.js process will exit immediately after calling the 'exit' event listeners causing any additional work still queued in the event loop to be abandoned. 
			// code 1 = error, code 0 = gracefull exit
			//PROCESS_.on('exit', function(code) { C.process.admin.log_event({event_: 'exit', type, process_name, arguments: {code}}); } ); // the channels are already closes, worker-master communication is no longer possible
			//PROCESS_.on('exit', async (code) => {try { console.log('exit '+code); } catch(error) { } });

		}

	} catch(error) { /* do nothing */ }

}

exports.bind_cluster_event_listeners = function() {

	const type = 'CLUSTER';

	// Emitted after the worker IPC channel has disconnected. 
	// This can occur when a worker exits gracefully, is killed, or is disconnected manually (such as with worker.disconnect()).
	M.cluster.on('disconnect', function(worker) { C.process.admin.log_event({event_: 'disconnect', type, process_name: 'WORKER_'+worker?.id, arguments: {worker}}); } );

	// When any of the workers die the cluster module will emit the 'exit' event. This can be used to restart the worker by calling .fork() again.
	// There may be a delay between the 'disconnect' and 'exit' events. These events can be used to detect if the process is stuck in a cleanup or if there are long-living connections.
	//M.cluster.on('exit', function(worker, code, signal='') { C.process.admin.log_event({event_: 'exit', type, process_name: 'WORKER_'+worker?.id, arguments: {worker, code, signal}}); } ); // the channels are already closes, worker-master communication is no longer possible

	// When a new worker is forked the cluster module will emit a 'fork' event.
	M.cluster.on('fork', function(worker) { C.process.admin.log_event({event_: 'fork', type, process_name: 'WORKER_'+worker?.id, arguments: {worker}}); } );

	// After calling listen() from a worker, when the 'listening' event is emitted on the server (HTTP for example), a 'listening' event will also be emitted on cluster in the primary.
	M.cluster.on('listening', function(worker, address) { C.process.admin.log_event({event_: 'listening', type, process_name: 'WORKER_'+worker?.id, arguments: {worker, address}}); } );

	// Emitted when the cluster primary receives a message from any worker.
	// M.cluster.on('message', function(worker, message, handle) { C.process.admin.log_event({event_: 'message', type, process_name: 'WORKER_'+worker?.id, arguments: {worker, message, handle}}); } );

	// After forking a new worker, the worker should respond with an online message. When the primary receives an online message it will emit this event. 
	// The difference between 'fork' and 'online' is that fork is emitted when the primary forks a worker, and 'online' is emitted when the worker is running.
	M.cluster.on('online', function(worker) { C.process.admin.log_event({event_: 'online', type, process_name: 'WORKER_'+worker?.id, arguments: {worker}}); } );

	// Emitted every time .setupPrimary() is called.
	M.cluster.on('setup', function(settings) { C.process.admin.log_event({event_: 'setup', type, process_name: 'MASTER', arguments: {settings}}); } );

}

// used for listening to events of child_processes (created by spawn method, for example rethinkdb)
exports.bind_child_process_event_listeners = function(PROCESS_, process_name='') {

	const type = 'CHILD_PROCESS';

	if(PROCESS_ && process_name && PROCESS_.pid) {

		//The 'close' event is emitted after a process has ended and the stdio streams of a child process have been closed. 
		// This is distinct from the 'exit' event, since multiple processes might share the same stdio streams. 
		// The 'close' event will always emit after 'exit' was already emitted, or 'error' if the child failed to spawn.
		PROCESS_.on('close', function(code, signal='') { C.process.admin.log_event({event_: 'close', type, process_name, arguments: {code, signal}}); } );

		// The 'disconnect' event is emitted after calling the subprocess.disconnect() method in parent process or process.disconnect() in child process.
		// After disconnecting it is no longer possible to send or receive messages
		PROCESS_.on('disconnect', function() { C.process.admin.log_event({event_: 'disconnect', type, process_name, arguments: {}}); } );

		// The 'error' event is emitted whenever: 1)The process could not be spawned, or 2) The process could not be killed, or 3) Sending a message to the child process failed.
		// The 'exit' event may or may not fire after an error has occurred. When listening to both the 'exit' and 'error' events, guard against accidentally invoking handler functions multiple times.
		PROCESS_.on('error', function(error) { C.process.admin.log_event({event_: 'error', type, process_name, arguments: {error}}); } );

		// The 'exit' event is emitted after the child process ends. If the process exited, code is the final exit code of the process, otherwise null. 
		// If the process terminated due to receipt of a signal, signal is the string name of the signal, otherwise null. One of the two will always be non-null.
		// When the 'exit' event is triggered, child process stdio streams might still be open.
		// Node.js establishes signal handlers for SIGINT and SIGTERM and Node.js processes will not terminate immediately due to receipt of those signals. 
		// Rather, Node.js will perform a sequence of cleanup actions and then will re-raise the handled signal.
		PROCESS_.on('exit', function(code, signal='') { C.process.admin.log_event({event_: 'exit', type, process_name, arguments: {code, signal}}); } );

		// The 'message' event is triggered when a child process uses process.send() to send messages.
		// The message goes through serialization and parsing. The resulting message might not be the same as what is originally sent.
		PROCESS_.on('message', function(message, handle) { C.process.admin.log_event({event_: 'message', type, process_name, arguments: {message, handle}}); } );

		// The 'message' event is triggered when a child process uses process.send() to send messages.
		// The message goes through serialization and parsing. The resulting message might not be the same as what is originally sent.
		PROCESS_.on('spawn', function() { C.process.admin.log_event({event_: 'disconnect', type, process_name, arguments: {}}); } );

		if(PROCESS_.stdout) PROCESS_.stdout.on('data', function(data) {let text = data.toString('utf8'); C.process.admin.log_event({event_: 'STDOUT.DATA', type, process_name, arguments: {text}}); } );
		if(PROCESS_.stderr) PROCESS_.stderr.on('data', function(data) {let text = data.toString('utf8'); C.process.admin.log_event({event_: 'STDERR.DATA', type, process_name, arguments: {text}}); } );

	}

}

exports.bind_server_event_listeners = function(SERVER, process_name='') {

	const type = 'SERVER';

	if(SERVER && process_name) {

		// Node.JS handles these events, they are not important for this server
		//SERVER.on('checkContinue', function() {}); 
		//SERVER.on('checkExpectation', function() {}); 

		// Emitted when the server closes.
		// If a client connection emits an 'error' event, it will be forwarded here. Listener of this event is responsible for closing/destroying the underlying socket. 
		// For example, one may wish to more gracefully close the socket with a custom HTTP response instead of abruptly severing the connection.
		// Default behavior is to try close the socket with a HTTP '400 Bad Request', or a HTTP '431 Request Header Fields Too Large' 
		// SERVER.on('clientError', function(exception_=null, socket_=null) { /* NODE JS HANDLES IT */ } );


		// Emitted each time a client requests an HTTP CONNECT method. If this event is not listened for, then clients requesting a CONNECT method will have their connections closed.
		// no need to listen to this event
		// SERVER.on('connect', function(request, socket, head) { } );

		// handled while handling the request handler
		// SERVER.on('connection', function(socket) { } );

		// Node.JS handles this one, sends 503 to client
		// SERVER.on('dropRequest', function(req, socket) { } );

		// Emitted each time there is a request. There may be multiple requests per connection (in the case of HTTP Keep-Alive connections).
		// handled while handling the request handler
		//SERVER.on('request', function(req, res) { console.log('REEEEEEEEEEEEEEEEEEEEEEEQ on [W'+C.server.worker_id+'] '+process_name+' ('+req?.headers?.host+req.url+')', req.headers) } );
		SERVER.on('request', function(req, res) { C.process.admin.log_request(req, process_name); } );

		// Emitted each time a client requests an HTTP upgrade. Listening to this event is optional and clients cannot insist on a protocol change.
		// no need to listen to this event
		// SERVER.on('upgrade', function(request, socket, head) { } );

		// Emitted when the server closes.
		SERVER.on('close', function(a='') { C.process.admin.log_event({event_: 'close', type, process_name, arguments: {a}}); } );

		// EVENTS of net.Server (inherited by HTTP server)

		// Emitted when an error occurs. Unlike net.Socket, the 'close' event will not be emitted directly following this event unless server.close() is manually called. See the example in discussion of server.listen().
		SERVER.on('error', function(error) { C.process.admin.log_event({event_: 'error', type, process_name, arguments: {error}}); } );

		// Emitted when the server has been bound after calling server.listen().
		SERVER.on('listening', function() { C.process.admin.log_event({event_: 'listening', type, process_name, arguments: {}}); } );

		// When the number of connections reaches the threshold of server.maxConnections, the server will drop new connections and emit 'drop' event instead. 
		// data = undefined OR {localAddress: ', localPort: 0, localFamily: '', remoteAddress: '', remotePort: 0, remoteFamily: ''}
		SERVER.on('drop', function(data=null) { C.process.admin.log_event({event_: 'drop', type, process_name, arguments: {data}}); } );

	}

}

exports.get_final_text_of_worker_to_master_to_workers_action = function(EXECUTE_ON_MASTER_RESULT) {

	//    console.log(M.util.inspect(result.data.update_shadow_on_other_workers.resolved.resolved.data.results, true, 30));

	var res 		= EXECUTE_ON_MASTER_RESULT || {};
	var final 		= {ok: 0, id: '', text: '', err: null, data: {}};

	if(res.ok) {

		res = res.resolved;

		if(res.ok) {

			res = res.resolved; // this resolved is a result of Promise.parallel (results of each worker)

			if(res.ok) {

				final.ok 		= 1;
				final.id 		= res.id;
				final.text 		= res.text + ' - [ ';
				final.results	= {};

				M._.forOwn(res.data.results, function(worker_result, worker_key) {

					if(worker_key !== 'ROOT') {

						if(worker_result?.ok && worker_result?.resolved) {

							if(worker_result.resolved?.ok) { 

								if(worker_result.resolved?.resolved?.ok) {
							
									final.text += '(worker '+worker_key+' OK '+worker_result.resolved?.resolved?.id+' - '+worker_result.resolved?.resolved?.text+')';

								} else { final.text += '(worker '+worker_key+' NOT OK '+worker_result.resolved?.resolved?.id+' - '+worker_result.resolved?.resolved?.text+')'; }
							
								// now format the result inside the worker
								final.results[worker_key] = worker_result.resolved?.resolved;

							} else { final.text += '(worker '+worker_key+' NOT OK '+worker_result.resolved?.id+' - '+worker_result.resolved?.text+')'; }

						} else { final.text+='(worker '+worker_key+' NOT OK - not resolved)'; }

						final.text += ' - | - ';

					}

				});
		
			} else { final = {ok: res.ok, id: res.id, text: res.text, error: res.error}; }
	
		} else { final = {ok: res.ok, id: res.id, text: res.text, error: res.error}; }

	} else { final = {ok: res.ok, id: res.id, text: res.text, error: res.error}; }

	return final;

}

exports.get_final_text_of_execute_on_master = function(EXECUTE_ON_MASTER_RESULT) {

	//    console.log(M.util.inspect(result.data.update_shadow_on_other_workers.resolved.resolved.data.results, true, 30));

	var res 		= EXECUTE_ON_MASTER_RESULT || {};
	var final 		= {ok: 0, id: '', text: '', err: null};

	if(res.ok) {

		res = res.resolved;

		if(res.ok) {

			res = res.resolved; // this resolved is a result of Promise.parallel (results of each worker)

			if(res.ok) {

				final = res;
		
			} else { final = {ok: res.ok, id: res.id, text: res.text, error: res.error}; }
	
		} else { final = {ok: res.ok, id: res.id, text: res.text, error: res.error}; }

	} else { final = {ok: res.ok, id: res.id, text: res.text, error: res.error}; }

	return final;

}



exports.get_cross_process_processes_data = function(what='', data={}) {

	var result = {};

	if(what === 'STATE') {

		result = M._.pick(STATE, ['sites', 'socket']);

	}

	if(what === 'PROCESSES') {

		//console.log(M.util.inspect(PROCESSES, true, 2));

		result = Object.keys(PROCESSES);

	}

	if(what === 'REQUESTS') {

		//console.log(M.util.inspect(PROCESSES, true, 2));
		M._.forOwn(R, function(req) {

			result[req.id] = M._.pick(req, ['site', 'host', 'true_host', 'url', 'true_url', 'base_url']);

		});

	}

	if(what === 'SITES') {

		//console.log(M.util.inspect(PROCESSES, true, 2));
		M._.forOwn(S, function(site, site_name) {

			result[site_name] = M._.pick(site, ['name', 'root', 'STATE']);

		});

	}

	if(what === 'SOCKETS') {

		result = Object.keys((global?.IO?.sockets?.sockets || {}));

	}

	return result;

}

