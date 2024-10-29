
exports.server = require('./server');
exports.processes = require('./processes');
exports.sites = require('./sites');

exports.init = function() {

	if(STATE.server_data_ok) {

		A.content.server.init();
		A.content.processes.init();
		A.content.processes.init_logs();

		A.content.sites.init();

	};

}