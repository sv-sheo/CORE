
exports.init = function() {

	_.forOwn(DOM.menu.links, function(link_DOM, link_name) {

		link_DOM.addEventListener('click', function(e) { e.preventDefault(); A.router.go_to(link_name); })


	});

}