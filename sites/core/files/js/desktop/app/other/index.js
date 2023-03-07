
exports.setup_initial_state = function() {

	STATE.section 			= 'server'; // default section

	STATE.server_data_ok 	= 0;

	//console.log(SERVER_DATA);


}

exports.populate_WH = function() {

	WH.currencies   	= PRELOAD_DATA.currencies;
	WH.languages    	= PRELOAD_DATA.languages;
	//WH.language     	= localStorage.language || PRELOAD_DATA.language || window.navigator.language;
	WH.language     	= 'cz';
	WH.request_id   	= PRELOAD_DATA.request_id;
	WH.HOST         	= PRELOAD_DATA.HOST;
	WH.alerts       	= PRELOAD_DATA.alerts;

	WH.locales_list 	= {cz: 'cs-CZ', en: 'en-US', de: 'de-DE'};
	WH.locale 			= WH.locales_list[WH.language] || WH.locales_list[WH.languages.default] || WH.locales_list['en'];

	WH.other        	= WH.other || {};

	WH.PROCESS_LOGS 	= {}; // will be populated during processes.init_logs()

	WH.sections 		= {
						server:			{name: 'server', path: ''}, 
						processes: 		{name: 'processes', path: 'processes'}, 
						sub_servers: 	{name: 'sub_servers', path: 'sub_servers'}, 
						sites: 			{name: 'sites', path: 'sites'}, 
						sockets: 		{name: 'sockets', path: 'sockets'}, 
					};


}

exports.ready = new Promise((resolve, reject) => {
    
    document.onreadystatechange = function() {

        if(document.readyState === 'interactive') {
         
            M.log.time('DOM loaded.');

			SERVER_DATA = PRELOAD_DATA || {}; // should be in HTML

            resolve(); // script declaring in html
            
        }
        
        if(document.readyState === 'complete') {
         
            M.log.time('PAGE loaded. (synchronous JS, CSS, IMAGES)');
            
        }
        
    };
    
});

exports.sort_first_server_data = function(sd={}) {

	STATE.server_data_ok = 0;

	if(sd.ok) {

		WH.SD = {}; // server data

		let oks 	= {MASTER: 0, WORKERS: 0};
		let ers 	= [];
		let errors	= [];

		let md 	= sd.data?.MASTER || {}; // master data
		let wsd	= sd.data?.WORKERS || {}; // workers data

		if(md.ok) {

			oks.MASTER 		= 1;
			WH.SD.MASTER 	= md.data;

		} else { ers.push(md?.id+' '+md?.text); errors.push(md?.error); }

		if(wsd.ok) {

			let workers_count 	= 0;
			let workers_ok 		= 0;

			WH.SD.WORKERS 		= {};

			// get data from each workers
			_.forOwn(wsd.results, function(wd, w_id) {

				workers_count++;

				w_id = parseInt(w_id);

				if(w_id && wd.ok) {

					if(wd?.data?.message) delete wd.data.message;

					WH.SD.WORKERS[w_id] = wd.data;

					workers_ok++;

				} else { ers.push(wd?.id+' '+wd?.text); errors.push(wd?.error); }

			}); 

			if(workers_count === workers_ok) oks.WORKERS = 1;

		} else { ers.push(wsd?.id+' '+wsd?.text); errors.push(wsd?.error); }

		if(oks.MASTER && oks.WORKERS) { 

			STATE.server_data_ok = 1;

		} else { alert(ers.join(' | ')); console.log('sort_first_server_data', errors); }

	} else { alert(sd.text); }

}