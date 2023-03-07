
exports.common 		= require('../../common');
exports.other 		= require('./other');
exports.handlers	= require('./handlers');
exports.alert		= require('./alert');
exports.menu		= require('./menu');
exports.router		= require('./router');
exports.DOM			= require('./DOM');
exports.content		= require('./content');

exports.start 		= async function() {
	
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

}