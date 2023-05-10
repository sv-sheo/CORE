
exports.HANDLE_SOCKET_STATE_CHANGE = function(e) {

	try {

		var d 			= e.detail;
		var state_switch= {connect: 'connected', connect_error: 'failed', disconnect: 'disconnected', reconnect_attempt: 'reconnecting', reconnect: 'connected'};
		var socket_state= STATE.SOCKETS[d.namespace]
		var new_state 	= state_switch[d.state];
		var old_state 	= socket_state.state;

		socket_state.state = new_state;
		
		// fulfill connection_promise on first response (it will be either connect or connect_error)
		if( !socket_state.first_response ) {

			if(d.state === 'connect' || d.state === 'connect_error') {

				socket_state.first_response = d.state;

				if(d.state === 'connect') 		{ socket_state.connection_resolve({ok: 1}); } // must resolve with truthy value
				if(d.state === 'connect_error') { socket_state.connection_resolve({ok: 0, error: d.err, text: (d.err?.message || 'Unknown socket connection error.'), data: (d.err?.data || {id:'[fe9]'})}); }

				if(socket_state.connection_timeout) clearTimeout(socket_state.connection_timeout); // the sockt would be destroyed otherwise

			}

		}

		// namespace specific handlers
		if(d.namespace === 'MAIN') {

			A.socket.log_socket_state_change(d);

			A.socket.display_socket_status(d);

		};

	} catch(error) { M.log.error(error, 'HANDLE_SOCKET_STATE_CHANGE ERROR'); }

}