// MUST EXPORT a PROMISE RETURNING FUNCTION
// PROMISE SHOULD BE RESOVLED WITH OBJECT SHAPED LIKE THIS: {ok: 0/1, data: {}, error: {id: '[eXX]', text: 'SOME ERROR'}}

exports.test = function(message) {

	return new Promise(function(resolve, reject) {

		setTimeout(function() { console.log('TEST MASTER HANDLER - WORKER ID: ' + message.worker_id); resolve('haha'); }, 1000);

	});

}

exports.init_worker = async function(message) {

    var result = {ok: 1, id: '', text: '', data: {}, error: null};

    try {

        C.bootup.start_time = new Date(message.data.start_time); // worker starts whole new script, with new start time, get start time of master

        let bootup_sequence = [

            C.logger.get_bootup_log_file.args(C.server.worker_id),
            C.server.load_certificates,
            C.server.connect_process_to_DB,
            C.socket.setup_worker,          // set-ups socket.io server on workers and adapts them to the main socket.io server on Master, sites are connected in site.load
            C.sites.load_all,               // loads sites specified in .env SITES - TO LOAD property, fills global S with loaded sites
            C.sites.load_web_admin,         // default site name of admin is core, if web admin is enabled in config (.env), it will be loaded
            C.server.create_http,           // create http server, route sites by host, check whether site has ssl certificate, if yes, proxy to https 
            C.server.create_https,          // create https server, route sites by host, if site doesnt have certificate, proxy to http
            C.mail.setup_core,              // setup mailer for core server (if its in a config) ... sites have their mail setup in site.load

            //C.server.create_socket_io.args(CONFIG.core.socket.secure) // fills IO with socket.io server (creates https server returning handshake on request) (argument - create HTTPS (true) or HTTP (false) handshake server)
        ];

        // init only one socket.io server (on worker 1) // fills IO with socket.io server (creates https server returning handshake on request) (argument - create HTTPS (true) or HTTP (false) handshake server) 
        //if(message.worker_id === 1) bootup_sequence.push(C.server.create_socket_io);
        
        // finish booting up system, now for every worker separately
        result = await C.promise.chain(bootup_sequence);

        // extract previous steps from each step and make it flat into result.data.steps
        var steps_by_id     = {'[i13]': 'create_socket_io', '[i10]': 'create_http', '[i11]': 'create_https', '[i22]': 'C_sites_load_all', '[i24]': 'connect_process_to_DB', '[i26]': 'get_bootup_log_file', '[i27]': 'load_web_admin', '[i41]': 'load_certificates', '[i42]': 'mail_setup_core', '[i13.1]': 'socket_setup_worker'};
        result.data.steps   = C.server.extract_previous_steps(result, steps_by_id);

        // save process DB connection of this worker
        DBP = result.data.steps?.connect_process_to_DB?.data;

        C.logger.bootup_step({id: '[i6]', text: 'Successfully initialized worker '+message.worker_id+'.'});

    } catch(error) { result = {ok: 0, id: '[e51]', text: 'Unknown error while iniatilizing worker '+C.server.worker_id+': '+error.message, data: {}, error } };

    if( !result.ok ) C.logger.bootup_step({id: result.id, err_text: result.text, err: result.error});

    return result;
    
}

exports.shutdown_worker = async function(message={}) {
    
    C.server.shutdown_worker(message?.data);
    
}

exports.execute_site_method = async function(message={}) {

    var result = {ok: 0, id: '[e84]', text: '', data: {message}, error: null};

    try {

        var method_ = message?.data?.method;
        var data    = message?.data?.data;
        var site    = message?.data?.site;
        var SITE    = S[site];
        var method  = M._.get(SITE, method_, null);

        if(method && M._.isFunction(method)) {

            result = await method(SITE, data);

        } else { result.text = 'Failed to execute site method - invalid site method.'; }

    } catch(error) { result = {...result, error: M.util.inspect(error), text: 'Failed to execute site method - '+error?.message}; }

    return result;

}

exports.update_shadow_table = async function(message={}) {

    var result = {ok: 1, id: '[i56]', text: 'Shadow not to be updated', data: {}, error: null};

    try {

        var db_name         = message?.data?.db_name || '';
        var table_name      = message?.data?.table_name || '';

        result = await C.DB.update_shadow_on_worker({db_name, table_name});

    } catch(error) { result = {...result, ok: 0, id: '[e73]', error, text: 'Unknown update shadow error: '+error.message }; }

    return result;

}

exports.send_process_event_log_to_core_admin = async function(message={}) {

    var result  = {ok: 0, id: '[e92]', text: '', data: {message}, error: null};

    try {

        var log = message.data?.log;

        // first check if admin site is enabled and running
        if(CONFIG.core.admin?.on) {

            var admin_site_name = CONFIG.core.admin?.name || '';

            if(admin_site_name && STATE.sites.loaded?.[admin_site_name] && S[admin_site_name] && S[admin_site_name]?.STATE?.loaded) {

                // now check if there is a socket connection to this site at the moment
                let SITE                        = S[admin_site_name];
                var admin_site_socket_enabled   = SITE?.config?.socket?.connect_site;
                var admin_site_namespace        = SITE?.config?.socket?.namespace;

                if(admin_site_socket_enabled && IO && IO._nsps) {

                    var IO_nsp_of_admin = IO._nsps.get(admin_site_namespace);

                    if(IO_nsp_of_admin) {

                        // finally, get all current connection to admin socket
                        var current_connections = IO_nsp_of_admin.sockets; // = Map ... more people might be connected to admin on different places (browsers) at the same time

                        current_connections.forEach(function(conn_socket, conn_id) {

                            conn_socket.emit('process_event_log', log);

                        });

                        result = {...result, ok: 1, text: 'Successfully sent process event log to admin sockets.'};

                    } else { result.text = 'Core admin namespace not found.'; }

                } else { result.text = 'Core admin socket is not enabled or the IO is invalid'; }

            } else { result.text = 'Core admin site not loaded.'; }

        } else { result.text = 'Core admin site not enabled.'; }

    } catch(error) { result = {...result, error, text: 'Unknown error during send_process_event_log_to_core_admin: '+error?.message}}

    return result;

}

// for core admin site
// get all running processes, open requests, socket connections etc
exports.get_running_stuff = async function(message={}) {

    var result  = {ok: 0, id: '[e87]', text: '', data: {message}, error: null};

    try {

        console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAA get_running_stuff on WORKER', message.data);

        result.ok   = 1;
        result.text = 'Got running stuff on WORKER '+M.cluster?.worker?.id;

        let data    = message?.data || {};

        result.data.STATE       = C.process.admin.get_process_state(data);
        result.data.PROCESSES   = C.process.admin.get_process_data(data);
        result.data.REQUESTS    = C.process.admin.get_requests(data);
        result.data.SITES       = C.process.admin.get_sites_data(data);
        result.data.SOCKETS     = C.process.admin.get_sockets_data(data);

        // make sure there is no Null or undefined in result (... otherwise the process.send will throw an error)
        C.helper.deep_iterate(result.data, function(val, key, full_path) { if(val === null || val === undefined) M._.set(result.data, full_path, ''); });

    } catch(error) { result = {...result, ok: 0, error, text: 'Unknown error during relay_to_the_rest_of_the_workers - '+error?.message}; }

    return result;

}
