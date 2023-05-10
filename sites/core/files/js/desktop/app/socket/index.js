
exports.log_socket_state_change = function(d) {

	if(d.state === 'connect') {

		M.log.info('SOCKET', d.namespace+' connected to '+d.socket_url+'.');

	}

	if(d.state === 'connect_error') {

		M.log.error(d.err, '[SOCKET] '+d.namespace+' failed to connect to '+d.socket_url+'.');

	}

	if(d.state === 'disconnect') {

		M.log.info('SOCKET', d.namespace+' disconnected from '+d.socket_url+'.');

	}

	if(d.state === 'reconnect_attempt') {

		M.log.info('SOCKET', d.namespace+' trying to reconnect to '+d.socket_url+'.');

	}

	if(d.state === 'reconnect') {

		M.log.info('SOCKET', d.namespace+' reconnected to '+d.socket_url+'.');

	}

}

exports.display_socket_status = function(d) {

	var DOM_status = document.getElementById('socket_status');

	// hide socket state box if socket is connected
	if(STATE.SOCKETS[d.namespace].state === 'connected') {

		DOM_status.style.display = 'none';
		DOM_status.innerHTML = '';

	} else {

		DOM_status.style.display = 'block';
		DOM_status.innerHTML = 'SOCKET.MAIN status: '+STATE.SOCKETS[d.namespace].state+(d.err ? ' - '+d.err.message : '');

	}

}