
exports.get_file_path_from_params = function({params={}}={}) {

	// first extract all <p__> params (parts of file path) out of params object
	var file_path_regex 	= /^p\d{1,3}$/; // matches only a string starting with "p" followed by 1-3 digits (e.g.: p1, p12, p123)
	var is_parent_directory	= /\.\.\//; 	// some/file/../path is invalid ... forbid parent directories for security reasons - the "../" params will be ignored
	var valid_path_parts	= {};
	var ordered_path_parts	= {};
	var highest_path_part 	= 0;
	var is_private 			= false; 	// if any of the path_parts === private --> forbid access to the file
	var file_path_array		= [];		// ['a', 'b', 'c', 'img.png'];
	var file_path 			= ''; 		// 'a/b/c/img.png'
	var i 					= 1;

	Object.keys(params).forEach(function(param_name) {

		if(file_path_regex.test(param_name)) {

			var param_value = params[param_name];

			// validate parm value
			if( !is_parent_directory.test(param_value)) { // "../" will be ignored

				valid_path_parts[param_name] 	= params[param_name];
				current_path_height				= parseInt(param_name.slice(1)); // get the number of the p___ param_name
				highest_path_part 				= highest_path_part < current_path_height ? current_path_height : highest_path_part;

				if(param_name === 'private') is_private = true;

			}

		}

	});
	
	// order extracted filepath params and build file_path
	for(i = 1; i <= highest_path_part; i++) {

		if(valid_path_parts['p'+i]) {
			
			ordered_path_parts['p'+i] = valid_path_parts['p'+i];

			file_path_array.push(valid_path_parts['p'+i]);

		}

	}

	file_path = M.path.join(...file_path_array);

	var result = {file_path, path_parts: ordered_path_parts, is_private};

	return result;

}