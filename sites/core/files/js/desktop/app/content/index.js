
exports.server = require('./server');
exports.processes = require('./processes');

exports.init = function() {

	if(STATE.server_data_ok) {

		A.content.server.init();
		A.content.processes.init();
		A.content.processes.init_logs();

	};

}