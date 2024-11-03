
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

// taken from  https://stackoverflow.com/questions/494143/creating-a-new-dom-element-from-an-html-string-using-built-in-dom-methods-or-pro
/**
 * @param {String} HTML representing a single element.
 * @param {Boolean} flag representing whether or not to trim input whitespace, defaults to true.
 * @return {Element | HTMLCollection | null}
 */
exports.create_element_from_string = function (html, trim = true) {

	// Process the HTML string.
	html = trim ? html.trim() : html;
	if (!html) return null;
	
	// Then set up a new template element.
	const template = document.createElement('template');
	template.innerHTML = html;
	const result = template.content.children;
	
	// Then return either an HTMLElement or HTMLCollection,
	// based on whether the input HTML had one or more roots.
	if (result.length === 1) return result[0];
	return result;
	  
}

exports.remove 	= function(element) 		{ if(element && element.parentNode) element.parentNode.removeChild(element); }