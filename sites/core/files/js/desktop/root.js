
try {

	// load CSS to webpack
	require('./../../css/desktop/index.scss'); 

	global.APPSTART = new Date().getTime();
	global.IO_CLIENT= require("socket.io-client"); 
	global.M 		= require('./../common'); 	// common JS for all sheo apps
	global.A        = require('./app');
	global.V        = require('./vendor');
	global.E 		= new EventTarget(); 		// global custom events, 
	global._        = require("lodash");

	global.STATE 	= {};
	global.SOCKETS 	= {}; // all socket.io managers (of opened connections) ... usually only one
	global.DOM 		= {};
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

	// AFTER DOM LOADED
	A.other.ready
	.then(A.start) 
	.catch(function(e) { 

		e.type = e.type || 'bootup';

		M.log.error(e, e.type+' ERROR');

	});

} else {

	var error_type      	= !window.COMPATIBLE ? 'compatible' : 'loading';
	var error_object     	= window.COMPATIBLE_ERROR || LOADING_ERROR;

	console.log('ERROR ('+error_type+'): ', error_object);

}

// ERROR_TYPES = [compatible, loading, bootup, server]