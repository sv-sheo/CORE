
exports.sites = {

	loaded: 		{},
	connected: 		{},

};

exports.certificates = {

	https: false, // will be loaded after C.server.load_certificates is executed ... {key: '...', crt: '...'}

}

exports.mailers = {} // after each C.mail.setup a new mail transporter will be stored here

exports.socket = {

	loaded_on_master: false,
	loaded_on_worker: false,
	connected_namespaces: {}, // {core: 'core', ...} // filled in C.socket.connect_site

}