

// MUST EXPORT a PROMISE RETURNING FUNCTION
// PROMISE SHOULD BE RESOVLED WITH OBJECT SHAPED LIKE THIS: {ok: 0/1, data: {}, error: {id: '[eXX]', text: 'SOME ERROR'}}

exports.test = function(message) {

	console.log('send action to execute on master test', message);

}

exports.execute_on_all_workers = async function(message={}) {

	var message_for_workers = message?.data?.message_for_workers || {};

	return await C.process.EXECUTE_ON_WORKERS('all', message_for_workers);

}

exports.relay_to_the_rest_of_the_workers = async function(message={}) {

    var result  = {ok: 0, id: '[e83]', text: '', data: {message}, error: null};
    var wid     = message?.worker_id || false;

    try {

        if(wid) {

            var message_for_workers = message?.data?.message_for_workers || null;
            var workers_to_relay_to = [];
            var all_worker_keys     = Object.keys(M.cluster.workers);

            all_worker_keys.forEach(function(wid_) { if(parseInt(wid_) !== wid) workers_to_relay_to.push(parseInt(wid_)); });

            if(message_for_workers) {

                if(workers_to_relay_to.length) {

                    result = await C.process.EXECUTE_ON_WORKERS(workers_to_relay_to, message_for_workers);

                } else { result = {...result, ok: 1, text: 'relay_to_the_rest_of_the_workers - no workers to relay to.'}}

            } else { result = {...result, text: 'Error during relay_to_the_rest_of_the_workers - invalid message for workers.'}}

        } else { result = {...result, text: 'Error during relay_to_the_rest_of_the_workers - invalid initial worker.'}}

    } catch(error) { result = {...result, error, text: 'Unknown error during relay_to_the_rest_of_the_workers - '+error?.message}}

    return result;

}

exports.shutdown = async function(message={}) {
    
    C.server.shutdown(message?.data);
    
}

exports.shutdown_slowly = async function(message={}) {
    
    C.server.shutdown_slowly(message?.data);
    
}

// get all running processes, open requests, socket connections etc
exports.get_running_stuff = async function(message={}) {

    var result  = {ok: 0, id: '[e86]', text: '', data: {}, error: null};

    try {

        console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAA get_running_stuff on MASTER', message.data);

        result.ok   = 1;
        result.text = 'Got running stuff on MASTER';

        let data    = message?.data || {};

        result.data.STATE       = C.process.admin.get_process_state(data);
        result.data.CONFIG      = C.process.admin.get_process_config(data);
        result.data.PROCESSES   = C.process.admin.get_process_data(data);
        result.data.OS          = C.process.admin.get_os_data(data);
        result.data.REQUESTS    = C.process.admin.get_requests(data);
        result.data.SITES       = C.process.admin.get_sites_data(data);
        // result.data.SOCKETS     = C.process.admin.get_sockets_data(data); // should be called only on workers

        result.data.PROCESS_LOGS = await C.process.admin.get_process_logs(data);

        // make sure there is no Null or undefined in result (... otherwise the process.send will throw an error)
        C.helper.deep_iterate(result.data, function(val, key, full_path) { if(val === null || val === undefined) M._.set(result.data, full_path, ''); });

    } catch(error) { result = {...result, ok: 0, error, text: 'Unknown error during relay_to_the_rest_of_the_workers - '+error?.message}}

    return result;

}