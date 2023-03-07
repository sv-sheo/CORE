
exports.change_ordering = function ({column, section, filter, set_filter}, e) {

	var new_filter 		= {...filter};
	var ordering 		= new_filter.__ORDER_BY[section] || {};
	var mode 			= e.ctrlKey ? 'cancel' : 'switch';
	var direction_switch= {asc: 'desc', desc: 'asc'}; 
	var direction 		= direction_switch[ordering.direction] || 'asc'; // default ascending
		direction 		= mode === 'switch' ? direction : '';
		column 			= mode === 'switch' ? column : '';

		ordering.column 	= column;
		ordering.direction 	= direction;

		new_filter.__ORDER_BY[section] = ordering;

	set_filter(new_filter);

}