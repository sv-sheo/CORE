

exports.init = function() {

	// hide all sections
	_.forOwn(DOM.sections, function(section_DOM, section_name) { section_DOM.style.display = 'none'; })

	// extract base_url from current url (in case of using IP access)
	var base_url = SERVER_DATA.base_url || '/';
	var true_url = window.location.pathname.replace(base_url, '');

	var section = WH.sections[true_url];

	if(section) {

		DOM.sections[section.name].style.display = 'block';
		DOM.menu.links[section.name].classList.add('active');

	} else { A.router.go_to(SERVER_DATA.base_url); }



}

exports.go_to = function(path='/') {

	var base_url = SERVER_DATA.base_url || '/';
	var true_url = path.replace(base_url, '');

	var section = WH.sections[true_url] || WH.sections.server;

	window.history.pushState("", "", base_url+section.path);

	// hide all sections
	_.forOwn(DOM.sections, function(section_DOM, section_name) { section_DOM.style.display = 'none'; DOM.menu.links[section_name].classList.remove('active'); })

	DOM.sections[section.name].style.display = 'block';
	DOM.menu.links[section.name].classList.add('active');

	console.log('going to '+section.name);

}