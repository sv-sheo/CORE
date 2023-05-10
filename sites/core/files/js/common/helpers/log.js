
exports.time = function(text) {
    
	var now     = new Date().getTime();
	var time    = now - APPSTART;
	
	console.log('%c'+time+'ms %c'+text, 'color: blue; font-weight:bold', 'color: black; font-weight:normal');
	
}
	
exports.error = function(error, error_type) {
		
	var text    = '';
		text    = ((typeof error) === 'string') ? error : text;
		text    = error.message ? error.message : text;
		text    = error.error   ? error.error : text;
	
	error_type  = error_type || 'UNKNOWN ERROR';
	
	console.log('%c '+error_type+': '+text, 'color: crimson; font-weight:bold; font-size: 1.3em;');
	console.log(error);

}

exports.info = function(type='INFO', text='') {
	
	console.log('%c['+type+']%c '+text, 'color: blue; font-weight:bold', 'color: black; font-weight:normal');

}