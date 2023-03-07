
try {

	// load CSS to webpack
	require('./../../css/desktop/index.scss'); 

	global.APPSTART = new Date().getTime();
	global.M 		= require('./../common'); 	// common JS for all sheo apps
	global.A        = require('./app');
	global.V        = require('./vendor');
	global._        = require("lodash");

	global.STATE 	= {};
	global.DOM 		= {};
	global.SOCKET   = false; // loaded after document.ready
	global.WH       = {}; // WAREHOUSE - for stuff that is used often, changed seldom - a.k.a content (in fact its just here so that STORE is not a bigass object)
	global.IDB      = {}; // indexedDB

	//global.PRELOAD_DATA 	- filled in HTML (script tag with JSON) - for basic data like language,theme etc
	global.SERVER_DATA 		= {}; // fetched after DOM & JS load === PRELOAD_DATA

	var LOADED              = true;
	var LOADING_ERROR       = '';

	M.log.time('Main script loaded.'); // or M.log.error

} catch(e) {

	var LOADED          = false;
	var LOADING_ERROR   = e; //FAILED TO LOAD MAIN SCRIPT

}

// fucking IE
if(window.COMPATIBLE && LOADED) {

	// AFTER DOM LOADED, BEFORE REACT
	A.other.ready.then(() => {

		//console.log('PRELOAD DATA', PRELOAD_DATA); // declared in HTML
		// catch any server errors from preload_data
		if(PRELOAD_DATA.error) {

			var server_error 		= new Error(PRELOAD_DATA.error);
				server_error.type 	= 'server';
			throw server_error;

		}

		return M.indexedDB.connect();

	// IndexDB started, proceed to CONNECT SOCKET
	}).then(function(IndexedDB) {

		M.log.time('IndexedDB started.');

		IDB = IndexedDB; // populates SET and GET methods (async)
		// IDB.SET(name, value).then(callback)
		// IDB.GET(name).then(function(result) {})

		return M.socket.connect(); // errors are caught at the end
		//var tt = SOCKET.execute('ticker', {lala: 'ahoj'}, {return: 1, timeout: 10}).then().catch();

	// SOCKET CONNECTED, get admin server data
	}).then(function(result) {

		M.log.time(result.text);

		return SOCKET.execute('get_server_data', {first_call: true}, {return: 1, timeout: 30});

	// SETUP INITIAL STATE
	}).then(function(result) { 

		M.log.time(result.text);

		A.other.setup_initial_state();
		A.other.populate_WH();
		A.other.sort_first_server_data(result);

		return {text: 'Set up state and populated warehouse.'}

	// run app
	}).then(function(result) {

		M.log.time(result.text);

		A.start();

	// ERROR    
	}).catch(function(e) { 

		e.type 		= e.type || 'bootup';

		console.log('ERROR ('+e.type+'): ', e);

	});

} else {

	var error_type      	= !window.COMPATIBLE ? 'compatible' : 'loading';
	var error_object     	= window.COMPATIBLE_ERROR || LOADING_ERROR;

	console.log('ERROR ('+error_type+'): ', error_object);

}

// ERROR_TYPES = [compatible, loading, bootup]