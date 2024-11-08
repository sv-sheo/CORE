
let rr = require.resolve;

//exports.counter = C.helper.force_require(rr('./counter'));


exports.test = async function(Q, socket, SITE, data = {}) {

	var result = {ok: 0, data: {}, error: null, id: '[si1]', text: ''};

	try {
    
		// check if admin is logged in (if client has rights)
		
		console.log('TEST SOCKET EVENT', data, Q.id, SITE.name);

		result = {...result, ok: 1, data, text: 'Test OK.'}

		// if data.return_event is set, this event will be emitted with result back to frontend (handled in socket.connector)

	} catch(error) { result = {...result, error, text: 'Failed to handle test - error: '+error.message}; }

	return result;
    
};

exports.get_server_data = async function(Q, socket, SITE, data = {}) {

	var result = {ok: 0, data: {}, error: null, id: '[si2]', text: ''};

	try {
    
		// TODO check if admin is logged in (if client has rights)
		result.ok = 1;
		result.text = 'Successfully got server data.';

		let master_result_raw	= await C.process.EXECUTE_ON_MASTER({action: 'process.handlers.master.get_running_stuff', data});
		let workers_result_raw 	= await C.process.EXECUTE_ON_MASTER({action: 'process.handlers.master.execute_on_all_workers', data: {message_for_workers: {action: 'process.handlers.worker.get_running_stuff', data}}});

		result.data.MASTER 		= C.process.get_final_text_of_execute_on_master(master_result_raw);
		result.data.WORKERS		= C.process.get_final_text_of_worker_to_master_to_workers_action(workers_result_raw);

		// if data.return_event is set, this event will be emitted with result back to frontend (handled in socket.connector)

	} catch(error) { result = {...result, ok: 0, error, text: 'Failed to handle get_server_data - error: '+error.message}; }

	return result;
    
};

exports.toggle_enabled_state_of_site = async function(Q, socket, SITE, data = {}) {

	var result = {ok: 0, data: {}, error: null, id: '[si3]', text: ''};

	try {
    
		// TODO check if admin is logged in (if client has rights)
		result.ok = 1;
		result.text = 'Successfully toggled enabled.';

		let workers_result_raw 	= await C.process.EXECUTE_ON_MASTER({action: 'process.handlers.master.execute_on_all_workers', data: {message_for_workers: {action: 'process.handlers.worker.toggle_enabled_state_of_site', data}}});

		result.data.WORKERS		= C.process.get_final_text_of_worker_to_master_to_workers_action(workers_result_raw);

		// if data.return_event is set, this event will be emitted with result back to frontend (handled in socket.connector)

	} catch(error) { result = {...result, ok: 0, error, text: 'Failed to handle get_server_data - error: '+error.message}; }

	return result;
    
};

exports.shutdown_server = async function(Q, socket, SITE, data = {}) {

	var result = {ok: 0, data: {}, error: null, id: '[si4]', text: ''};

	try {
    
		// TODO check if admin is logged in (if client has rights)
		result.ok = 1;
		result.text = 'Server was successfully shutdown.';

		let master_result_raw 	= await C.process.EXECUTE_ON_MASTER({action: 'process.handlers.master.shutdown_slowly', data: data});

		// if data.return_event is set, this event will be emitted with result back to frontend (handled in socket.connector)

	} catch(error) { result = {...result, ok: 0, error, text: 'Failed to handle get_server_data - error: '+error.message}; }

	return result;
    
};
