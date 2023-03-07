
exports.get_process_data = function(data={}) {

	var result 			= {};
	var WORKER_regex 	= /^WORKER_\d{1,2}$/; // matches "WORKER_0" to "WORKER_9" and "WORKER_00"-"WORKER_99"

	M._.forOwn(PROCESSES, function(PROCESS_, P_NAME) {

		// MASTER
		if(M.cluster.isPrimary) {

			// MASTER PROCESS
			if(P_NAME === 'MASTER') {

				let master_state = M._.pick(PROCESS_, ['pid', 'ppid', 'arch', 'platform', 'version']);
				
				master_state.usage 			= {};
				master_state.usage.cpu 		= PROCESS_.cpuUsage();
				master_state.usage.memory 	= PROCESS_.memoryUsage();
				// master_state.usage.resource = PROCESS_.resourceUsage(); // too large and includes data that i dont know how to handle yet, also, includes cpuUsage

				master_state.uptime 		= PROCESS_.uptime();
				master_state.release_name	= PROCESS_.release?.name || '';
				master_state.versions 		= {}
				master_state.versions.node 	= PROCESS_.versions?.node || '';
				master_state.versions.v8 	= PROCESS_.versions?.v8 || '';
				master_state.workers		= Object.keys(M.cluster.workers);

				result[P_NAME] = master_state;

			} else if(P_NAME === 'RETHINKDB') {

				result[P_NAME] = M._.pick(PROCESS_, ['pid', 'connected', 'killed', 'spawnfile']); // ppid does not exist

			} else if(P_NAME === 'SOCKET_HANDSHAKE_SERVER') { 
				
				result[P_NAME] = {listening: PROCESS_.listening}; 

			// WORKERS ... data will will be acquired by the worker themselves (below)
			} else if(WORKER_regex.test(P_NAME)) {

				result[P_NAME] = M._.pick(PROCESS_, ['id', 'state']);
			
			} else { result[P_NAME] = Object.keys(PROCESS_); }

		// WORKER
		} else {

			// WORKER PROCESSES
			if(WORKER_regex.test(P_NAME)) {

				let worker_state = M._.pick(PROCESS_, ['pid', 'ppid', 'connected', 'killed']);

				worker_state.usage 			= {};
				worker_state.usage.cpu 		= PROCESS_.cpuUsage();
				worker_state.usage.memory 	= PROCESS_.memoryUsage();
				//worker_state.usage.resource = PROCESS_.resourceUsage(); // too large and includes data that i dont know how to handle yet, also, includes cpuUsage

				worker_state.uptime 		= PROCESS_.uptime();

				worker_state.worker 		= {};
				worker_state.worker.id 		= M.cluster.worker.id;
				worker_state.worker.state 	= M.cluster.worker?.state || '';

				result[P_NAME] = worker_state;

			} else if(P_NAME === 'SOCKET_HANDSHAKE_SERVER') { result[P_NAME] = {listening: PROCESS_.listening}; 
			} else if(P_NAME === 'SOCKET_IO_SERVER') 		{ result[P_NAME] = {listening: PROCESS_.listening}; 
			} else if(P_NAME === 'PROXY_SERVER') 			{ /* not a process nor a running server }; */
			} else if(P_NAME === 'PROXY_SERVER_SECURE') 	{ /* not a process nor a running server }; */
			} else if(P_NAME === 'HTTP_PROXY_SERVER') 		{ result[P_NAME] = {listening: PROCESS_.listening}; 
			} else if(P_NAME === 'HTTP_SERVER') 			{ result[P_NAME] = {listening: PROCESS_.listening}; 
			} else if(P_NAME === 'HTTPS_PROXY_SERVER') 		{ result[P_NAME] = {listening: PROCESS_.listening}; 

			} else if(P_NAME === 'HTTPS_SERVERS') {

				result[P_NAME] = {};

				M._.forOwn(PROCESS_, function(https_server, server_name) { result[P_NAME][server_name] = {listening: https_server.listening}; });

			} else { result[P_NAME] = Object.keys(PROCESS_); }

		}

	});

	return result;

}

exports.get_process_state = function(data={}) {

	var result = {};

	// MASTER
	if(M.cluster.isPrimary) {

		M._.forOwn(STATE, function(val, key) {
			
					if(key === 'sites') 	{ result[key] = val; 
			} else  if(key === 'socket')	{ result[key] = val;
			} else  if(key === 'server_IP')	{ result[key] = val;
			} else 							{ result[key] = Object.keys(val); }

		});

	// WORKER
	} else {

		M._.forOwn(STATE, function(val, key) {
			
					if(key === 'sites') 	{ result[key] = val; 
			} else  if(key === 'socket')	{ result[key] = val;
			} else 							{ result[key] = Object.keys(val); } // mailers, certificates ...

		});

	}

	return result;

}

// should be called only on master
exports.get_process_logs = async function(data={}) {

	var result = {};

	if(data?.first_call) {

		result = await DB.GET(DBP, 'process_logs');

	}

	return result;

}

exports.get_os_data = function(data={}) {

	let os_data = {};

	if(data?.first_call) {

		let to_get 	= ['arch', 'cpus', 'freemem', 'totalmem', 'hostname', 'loadavg', 'networkInterfaces', 'platform', 'type', 'version', 'machine', 'uptime'];

		to_get.forEach((method_name)=>{ os_data[method_name] = (M.os[method_name] && M._.isFunction(M.os[method_name])) ? (M.os[method_name]() || '') : ''; });

		// calculating CPU usage of whole PC - https://gist.github.com/bag-man/5570809 ... calculate it on frontend, just get the data in intervals from here

	}

	return os_data;

}

exports.get_process_config = function(data={}) {

	return data?.first_call ? CONFIG.core : {};

}

exports.get_sites_data = function(data={}) {

	var result = {};

	M._.forOwn(S, function(site, site_name) {

		result[site_name] 			= M._.pick(site, ['name', 'root', 'STATE', 'config', 'machine']);

		result[site_name].DB 		= M._.pick(site.DB, ['CONNECTED', 'READY', 'TABLES', 'NAME']);
		result[site_name].IO 		= M._.pick(site.IO, [/*'sockets'*/, 'name']); // sockets is a Map that will be coerced into empty {} during transport
		result[site_name].mailer 	= site.mailer ? Object.keys(site.mailer) : '';

	});

	return result;

}

// should be called only on workers
exports.get_sockets_data = function(data={}) {

	var result = {};
	var connections_by_namespaces = C.socket.get_current_connections();

	// Map cannot be passed via process.send and socket JSON, convert it to object here
	M._.forOwn(connections_by_namespaces, function(map_of_connections, namespace_name) {

		result[namespace_name] = {};

		map_of_connections.forEach(function(value, key, map) { 
			
			result[namespace_name][key] = M._.pick(value, ['id', 'connected']);

			result[namespace_name][key].events 	= Object.keys(value._events);
			result[namespace_name][key].rooms 	= Array.from(value.rooms); // value.rooms is a getter that returns a Set ... convert it into array via Array.from

			result[namespace_name][key].handshake 			= M._.pick(value.handshake, ['address', 'issued', 'secure', 'url', ]); // issued = time (ms)
			result[namespace_name][key].handshake.host 		= value.handshake.headers.host;
			result[namespace_name][key].handshake.origin	= value.handshake.headers.origin;
			result[namespace_name][key].handshake.referer	= value.handshake.headers.referer;
			result[namespace_name][key].handshake.user_agent= value.handshake.headers['user-agent'];
		
		});

	});

	return result;

}

exports.get_requests = function(data={}) {

	let result = {current: {}, by_server: {}};

	// first get data of currently processed requests (probably none, since its difficult to hit the exact meantime of a request being processed, if theres many, theres probably something wrong)
	M._.forOwn(R.current, function(req) {

		result.current[req.id] = M._.pick(req, ['id', 'site', 'host', 'true_host', 'url', 'true_url', 'base_url', 'from_ip', 'client_ip', 'method', 'hook', 'safe']);

	});

	result.by_server = R.by_server;

	return result;

}

/*exports.get_cross_process_processes_data = function(what='', data={}) {

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

}*/

// log process event
exports.log_event = async function({event_= '', type='', process_name= '', arguments={}}) {

	try {
    
		var log 		= {};
		var d 			= new Date(); 

		// get from MASTER proccess {pid, ppid, uptime(), cpuUsage(), resourceUsage(), memoryUsage()}
		// get from WORKER proccess {pid, connected bool, killed bool}
		
		log.name 		= process_name;
		log.event 		= event_;
		log.origin 		= M.cluster.isPrimary ? 'MASTER' : 'WORKER';
		log.type 		= type;
		log.worker_id 	= M.cluster.isWorker ? M.cluster.worker.id : 0;
		log.time 		= d.getTime();
		log.id 			= log.time+'_'+C.helper.random_alpha_numeric(3);
		log.data 		= {};

		// log cannot contain 'undefined' values, otherwise this error is thrown during DB.SET: Object field 'fd' may not be undefined at ReqlDriverCompileError
		// log cannot contain too deep objects (looking at you, message event), otherwise: Nesting depth limit exceeded at ReqlDriverCompileError.ReqlError

		// MASTER/WORKER PROCESS
		if(type === 'PROCESS') {

			if(event_ === 'beforeExit') 					{ log.data = arguments; } // { code=int }
			else if(event_ === 'disconnect') 				{ log.data = arguments; } // { }
			else if(event_ === 'message') 					{ log.data.message = M.util.inspect(arguments.message, true, 1); } // { message: {...} }
			else if(event_ === 'rejectionHandled')			{ log.data.promise = M.util.inspect(arguments.promise_, true, 0); }
			else if(event_ === 'unhandledRejection')		{ log.data = {reason: arguments.reason, promise: M.util.inspect(arguments.promise_, true, 0)}; }
			else if(event_ === 'uncaughtExceptionMonitor')	{ log.data = {origin: arguments.origin, error: M.util.inspect(arguments.error)}; }
			else if(event_ === 'warning') 					{ log.data = arguments; } // { warning: {name: '', message: '', stack: ''} }
			else if(event_ === 'worker') 					{ log.data.worker_id = arguments?.worker?.id; }

		// M.cluster events (worker events)
		} else if(type === 'CLUSTER') {

			if(event_ === 'disconnect') 	{ log.data = {worker: M._.pick(arguments.worker, ['id', 'state'])}; } // { worker }
			else if(event_ === 'exit') 		{ log.data = {code: arguments.code, signal: arguments.signal, worker: M._.pick(arguments.worker, ['id', 'state'])}; } // { worker, code, signal }
			else if(event_ === 'fork') 		{ log.data = {worker: M._.pick(arguments.worker, ['id', 'state'])}; } // { worker }
			else if(event_ === 'listening') { log.data = {address: arguments.address, worker: M._.pick(arguments.worker, ['id', 'state'])}; log.data.address.fd = (log.data.address?.fd || '') } // { worker, address={address, port, addressType, fd=undefined} }
			else if(event_ === 'message') 	{ log.data = {message: M.util.inspect(arguments.message, true, 1), worker: M._.pick(arguments.worker, ['id', 'state'])}; } // { worker, message, handle }
			else if(event_ === 'online') 	{ log.data = {worker: M._.pick(arguments.worker, ['id', 'state'])}; } // { worker }
			else if(event_ === 'setup') 	{ log.data = arguments; } // { settings }

		// RETHINKDB child process
		} else if(type === 'CHILD_PROCESS') {

			if(event_ === 'disconnect') 	{ log.data = {}; } // {  }
			else if(event_ === 'close') 	{ log.data = arguments; } // { code, signal }
			else if(event_ === 'error') 	{ log.data.error = M.util.inspect(arguments.error); } // { error }
			else if(event_ === 'exit') 		{ log.data = arguments; } // { code, signal }
			else if(event_ === 'message') 	{ log.data.message = M.util.inspect(arguments.message, true, 1); } // { message: {...} }
			else if(event_ === 'spawn') 	{ log.data = {}; } // { code, signal }
			else if(event_ === 'STDOUT.DATA'){log.data = arguments; } // { text }
			else if(event_ === 'STDERR.DATA'){log.data = arguments; } // { text }

		} else if(type === 'SERVER') {

			if(event_ === 'close') 			{ log.data = arguments; } // { a }
			else if(event_ === 'error') 	{ log.data.error = M.util.inspect(arguments.error); } // { error }
			else if(event_ === 'listening') { log.data = arguments; } // { }
			else if(event_ === 'drop') 		{ log.data = arguments; } // { data }

		}

		// make sure to not log message events ... the DB would get bloated quickly, and the EXECUTE_ON_MASTER of socket would create an infinite loop, making the server go ka-boom
		if(event_ !== 'message') {

			// if process has not been connected to DB yet, wait 10 seconds to try again
			if(typeof DBP !== 'undefined') {

				var db_result 	= await DB.SET(DBP, 'process_logs', log);

			} else {

				var wait_10_seconds = new Promise(function(resolve, reject) { 
					
					setTimeout(function() { 
						
						if(typeof DBP !== 'undefined') 	{ DB.SET(DBP, 'process_logs', log).then(resolve).catch(reject)} 
						else 							{ resolve('Process is not connected to DB yet.'); }; 
					
					}, 10000); 
				
				});

				var db_result = await wait_10_seconds;

			}

			db_result = db_result?.inserted === 1 ? '1 row added to process_logs' : db_result;

			// relay the log to CORE admin socket, if there are any connected at the moment, do not wait for reply
			var message_for_workers = {action: 'process.handlers.worker.send_process_event_log_to_core_admin', data: {log}};

			if(log.origin === 'MASTER') {	C.process.handlers.master.execute_on_all_workers({data: {message_for_workers}}); }
			else {							C.process.EXECUTE_ON_MASTER({action: 'process.handlers.master.execute_on_all_workers', data: {message_for_workers}}); } 

			//C.logger.runtime_log({id: '[i58]', text: 'Process ['+process_name+'] (type '+type+') handled process event ['+event_+']('+Object.keys(arguments).join(',')+'), DB result: '+M.util.inspect(db_result)});

		}

	} catch(error) { C.logger.catch_unknown_runtime_error({ok: 0, id: '[e88]', error, text: 'Failed to log process ['+process_name+'] (type '+type+') event ['+event_+'] - unknown error: '+error.message}); }

}

exports.log_request = function(req, server_name='') {

	try {

		if(req && server_name) {

			R.by_server[server_name] = R.by_server[server_name] || [];

			// prepend to the beginning of the array
			R.by_server[server_name].unshift({time: C.helper.now(), host: req.headers.host, url: req.url, method: req.method, protocol: (req?.connection?.encrypted ? 'https' : 'http')});

			// of theres more than 100 requests log, remove the last one
			if(R.by_server[server_name].length > 100) R.by_server[server_name].pop();

		}

	} catch(error) { /* do nothing */ }

}
