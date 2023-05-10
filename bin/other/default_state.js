
exports.sites = {

	loaded: 		{}, // sites loaded in nodeJS
	connected: 		{}, // sites connected to DB
	enabled: 		{}, // sites that are turned on (accepting requests)

};

exports.certificates = {

	https: false, // will be loaded after C.server.load_certificates is executed ... {key: '...', crt: '...'}

}

exports.mailers = {} // after each C.mail.setup a new mail transporter will be stored here

exports.socket = {

	running_servers: {}, 			// {REGULAR: 'REGULAR', ...} // filled in C.socket.create_servers
	listening_to_namespaces: {},	// filled in C.socket.bind_site_listener  // { "/opajda": {sites: ['opajda']}, "/opajda_admin": {sites: ['opajda', 'sheo', '<site_name']} } for example

}