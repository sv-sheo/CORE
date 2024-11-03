
exports.NAME 		= 'core';

exports.common 		= require('../../common');
exports.other 		= require('./other');
exports.handlers	= require('./handlers');
exports.alert		= require('./alert');
exports.menu		= require('./menu');
exports.router		= require('./router');
exports.DOM			= require('./DOM');
exports.content		= require('./content');
exports.events		= require('./events');
exports.socket		= require('./socket');

exports.start 		= async function() {

		// declared in HTML; catch any server errors from preload_data
		if(PRELOAD_DATA.error) {

			var server_error 		= new Error(PRELOAD_DATA.error);
				server_error.type 	= 'server';
			throw server_error;

		}

		A.events.init_custom_events();

		IDB = await M.indexedDB.connect();
		// IDB.SET(name, value).then(callback)
		// IDB.GET(name).then(function(result) {})

		var loading_box 		= document.getElementById('ls_box');
		var loading_screen 		= document.getElementById('loading_screen');

		loading_box.innerHTML 	= 'Loading - connecting to socket...';

		var socket_created 		= await M.socket.create('MAIN'); // create the main socket connection and save it to SOCKETS.MAIN // use M.socket.destroy('MAIN') to disconnect cleanly
		var socket_error 		= null;
		var loading_box_text 	= '';

		if( socket_created.ok) {

			var socket_initialized 	= await M.socket.listen_once('MAIN', 'INIT');

			if(socket_initialized.ok) {

				// fetch server data
				var fetch_server_data = await M.socket.execute('MAIN', 'get_server_data', {first_call: true}, {return: true, timeout: 30});

				if(fetch_server_data.ok) {

					loading_screen.style.display = 'none';

					A.other.setup_initial_state();
					A.other.populate_WH();
					A.other.sort_first_server_data(fetch_server_data);

					A.DOM.init();
					A.router.init();
					A.menu.init();
					A.content.init();
					A.alert.init();

				} else { socket_error = fetch_server_data; loading_box_text = 'Failed to fetch server data.'; }

			} else { socket_error = socket_initialized; loading_box_text = 'Failed to initialize socket.'; }

		} else { socket_error = socket_created; loading_box_text = 'Failed to connect to socket.' }
		
		if( socket_error ) { 
			
			loading_box.innerHTML = loading_box_text+'<br>'+socket_error.text
			M.log.error(socket_error, 'APP START ERROR');

		}

		M.log.time('App started.');

}

/*exports.start 		= async function() {
	
	try { 


		SOCKET.on('process_event_log', function(log_data) {

			//console.log('WTFFFFFFFFFFFFFFFFFFFFFFFFFFFF IT WORKSSSSSSS', log_data);

			if(log_data && log_data.id && log_data.type && log_data.name) {

				WH.PROCESS_LOGS[log_data.type][log_data.name][log_data.id] = log_data;
				A.content.processes.add_process_log_to_DOM(log_data); 

			}

		});

		A.DOM.init();
		A.router.init();
		A.menu.init();
		A.content.init();


	} catch(error) { console.log('APP.start ERROR', error); }

}*/