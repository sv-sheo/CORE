
exports.init = function() {

	DOM.sections = A.DOM.html_collection_to_keyed_object(document.getElementsByClassName('section'));

	DOM.menu = {};

	DOM.menu.links = A.DOM.html_collection_to_keyed_object(document.getElementsByClassName('mm_menu_link'));

	DOM.sections_blocks = {};
	DOM.sections_blocks.rows = {};
	DOM.sections_blocks.rows.contents 	= A.DOM.html_collection_to_keyed_object(document.getElementsByClassName('sbc_row_content'));
	DOM.sections_blocks.headers 		= A.DOM.html_collection_to_keyed_object(document.getElementsByClassName('sb_header'));

	DOM.sections_blocks.process_rows = {};
	DOM.sections_blocks.process_rows.content = A.DOM.html_collection_to_keyed_object(document.getElementsByClassName('sprlc_row_content'));
	DOM.sections_blocks.process_rows.logs = A.DOM.html_collection_to_keyed_object(document.getElementsByClassName('log_row_container'));

}

exports.html_collection_to_keyed_object = function(html_collection=[]) {

	var keyed_object = {};

	_.forEach(html_collection, function(element) { 
	
		if(element.dataset.key) keyed_object[element.dataset.key] = element;
	
	});

	return keyed_object;

}