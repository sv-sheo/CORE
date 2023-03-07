
exports.get_request_log_type_config_by_hook = function(conf = {/* contents of .conf file */}) {

	var log_type_config_by_hook = {

		main:       {

			file:   conf.logs_request_main_file     || process.env.logs_request_main_file       || 'full', // full, basic, bare, none
			db:     conf.logs_request_main_db       || process.env.logs_request_main_db         || 'full',
			console:conf.logs_request_main_console  || process.env.logs_request_main_console    || 'full', // full, basic, none

		},
		sub:       {

			file:   conf.logs_request_sub_file      || process.env.logs_request_sub_file        || 'basic',
			db:     conf.logs_request_sub_db        || process.env.logs_request_sub_db          || 'basic',
			console:conf.logs_request_sub_console   || process.env.logs_request_sub_console     || 'basic',

		},
		none:       {

			file:   conf.logs_request_none_file     || process.env.logs_request_none_file       || 'none',
			db:     conf.logs_request_none_db       || process.env.logs_request_none_db         || 'bare',
			console:conf.logs_request_none_console  || process.env.logs_request_none_console    || 'none',

		},
		error:       {

			file:   conf.logs_request_error_file    || process.env.logs_request_error_file      || 'full',
			db:     conf.logs_request_error_db      || process.env.logs_request_error_db        || 'full',
			console:conf.logs_request_error_console || process.env.logs_request_error_console   || 'full',

		},

	}

	return log_type_config_by_hook;

}