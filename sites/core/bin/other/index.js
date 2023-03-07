
let rr = require.resolve;

exports.initial_state   	= C.helper.force_require(rr('./initial_state'));
exports.register_partials   = C.helper.force_require(rr('./register_partials'));
exports.pre   				= C.helper.force_require(rr('./pre'));

exports.reload_site = async function(SITE={}, data={}) {

	var result = {ok: 0, id: '[fe1]', text: '', data: {}, error: null};

	try {

		if(SITE) {

			console.log('Executing reload site on worker '+C.server.worker_id);

			let load_args   = {site: SITE.name, site_root: SITE.root, log: true, config: SITE.config};

			let BIN         = await C.sites.load_site_bin       (load_args);
			let handlers    = await C.sites.load_site_handlers  (load_args);
			let views       = await C.sites.load_site_views     (load_args);

			if(BIN.ok)      Object.assign(SITE, BIN.data);
			if(handlers.ok) Object.assign(SITE.handlers, handlers.data);
			if(views.ok) 	Object.assign(SITE.views, views.data);
			
			SITE.other.register_partials.main(SITE.views.partials);
			//SITE.other.register_partials.admin(SITE.views.admin.partials);

			result.data.BIN 	 = M._.omit(BIN, ['data']);
			result.data.handlers = M._.omit(handlers, ['data']);
			result.data.views 	 = M._.omit(views, ['data']);

			if(BIN.ok && handlers.ok && views.ok) {

				result = {...result, ok: 1, id: '[fi1]', text: 'Successfully reloaded site ['+SITE.name+'] on worker '+C.server.worker_id+'.'};

			} else { result.text = 'Error during SITE.other.reload_site ('+SITE?.name+') - some steps of site reload failed: \r\n'+BIN.text+'\r\n'+handlers.text+'\r\n'+views.text; }

		} else { result.text = 'Error during SITE.other.reload_site ('+SITE?.name+') - invalid SITE.'; }

	} catch(error) { result = {...result, error: M.util.inspect(error), text: 'Unknown error during SITE.other.reload_site ('+SITE?.name+') - '+error?.message}; }

	return result;

}

// get only the list of subservers for blank HTML generation
exports.get_sub_servers = function() {

	var sub_servers = {};

	sub_servers.MASTER = {SOCKET_HANDSHAKE_SERVER: 1};
	
	var worker_subservers = {}

	// remove proxy server (not a running server) and workers process
	M._.forOwn(PROCESSES, function(process_, p_name) {

		if(p_name !== 'PROXY_SERVER' && p_name !== 'PROXY_SERVER_SECURE' && 'HTTPS_SERVERS' && p_name !== ('WORKER_'+M.cluster?.worker?.id)) {

			worker_subservers[p_name] = 1;

		}

	 });

	// break HTTPS server into flat object
	M._.forOwn(PROCESSES.HTTPS_SERVERS, function(https_server, https_server_name) {

		worker_subservers['HTTPS_SERVER_'+https_server_name] = 1;

	});

	var i = 1;

	for(i; i<= CONFIG.core.workers; i++) {

		sub_servers['WORKER_'+i] = worker_subservers;

	}

	return sub_servers;

}