
exports.init = function() {

	let fd = {}; // formatted data

	let now 				= V.moment().locale(WH.locale);

	fd.master = {};

	fd.master.pid 			= WH.SD.MASTER.PROCESSES.MASTER.pid;
	fd.master.ppid 			= WH.SD.MASTER.PROCESSES.MASTER.ppid;
	fd.master.uptime 		= A.content.processes.get_uptime(WH.SD.MASTER.PROCESSES.MASTER.uptime);
	fd.master.starttime 	= A.content.processes.get_starttime(now, WH.SD.MASTER.PROCESSES.MASTER.uptime);
	fd.master.cpu 			= A.content.processes.get_cpu_usage(WH.SD.MASTER.PROCESSES.MASTER.usage?.cpu);
	fd.master.ram 			= A.content.processes.get_ram_usage(WH.SD.MASTER.PROCESSES.MASTER.usage?.memory);
	fd.master.workers 		= WH.SD.MASTER.PROCESSES.MASTER.workers.length;

	fd.rethinkdb = {};

	fd.rethinkdb.pid 		= WH.SD.MASTER.PROCESSES.RETHINKDB.pid;
	fd.rethinkdb.spawnfile 	= WH.SD.MASTER.PROCESSES.RETHINKDB.spawnfile;
	fd.rethinkdb.connected 	= WH.SD.MASTER.PROCESSES.RETHINKDB.connected ? 'YES' : 'NO';
	fd.rethinkdb.killed 	= WH.SD.MASTER.PROCESSES.RETHINKDB.killed ? 'YES' : 'NO';

	_.forOwn(WH.SD.WORKERS, function(WD, WID) {

		let worker_name 	= 'worker_'+WID; // for use in DOM
		let worker_p_name 	= 'WORKER_'+WID; // for JS

		fd[worker_name] 			= {};
		fd[worker_name].pid 		= WD.PROCESSES[worker_p_name]?.pid;
		fd[worker_name].ppid 		= WD.PROCESSES[worker_p_name]?.ppid;
		fd[worker_name].connected 	= WD.PROCESSES[worker_p_name]?.connected ? 'YES' : 'NO';
		fd[worker_name].uptime 		= A.content.processes.get_uptime(WD.PROCESSES[worker_p_name]?.uptime);
		fd[worker_name].starttime 	= A.content.processes.get_starttime(now, WD.PROCESSES[worker_p_name]?.uptime);
		fd[worker_name].cpu 		= A.content.processes.get_cpu_usage(WD.PROCESSES[worker_p_name]?.usage?.cpu);
		fd[worker_name].ram 		= A.content.processes.get_ram_usage(WD.PROCESSES[worker_p_name]?.usage?.memory);

	});


	_.forOwn(fd, function(content_group, content_group_name) {

		_.forOwn(content_group, function(content, content_name) {

			let DOM_name = 'processes_'+content_group_name+'_'+content_name;

			if(DOM.sections_blocks.process_rows.content?.[DOM_name]) {

				DOM.sections_blocks.process_rows.content[DOM_name].innerHTML = content;
	
			}

		});

	});

}

exports.get_uptime = function(input_uptime) {

		input_uptime= input_uptime || 0;
	let uptime 		= Math.round(input_uptime*1000); // seconds to milliseconds
	let uptime_d	= V.moment.duration(uptime).locale(WH.locale);
	let uptime_f 	= uptime_d.humanize() + ' ('+uptime_d.hours()+':'+uptime_d.minutes()+':'+uptime_d.seconds()+')';

	return uptime_f;

}

exports.get_starttime = function(now, input_uptime) {

	input_uptime= input_uptime || 0;
let uptime 		= Math.round(input_uptime*1000); // seconds to milliseconds
let starttime 	= now.format('x') - uptime;
let starttime_d = V.moment(starttime).locale(WH.locale);
let starttime_f = starttime_d.format('LLL');

return starttime_f;

}

exports.get_cpu_usage = function(cpu_usage) {

		cpu_usage		= cpu_usage || {system: 0, user: 0}; // in microseconds -> transform to milliseconds (ms)
	let computed_usage 	= Math.round((cpu_usage.system + cpu_usage.user) / 1000) + ' ms';

	return computed_usage;

}

exports.get_ram_usage = function(ram_usage) {

	ram_usage		= ram_usage || {rss: 0, heapUsed: 0, heapTotal: 0, external: 0, arrayBuffers: 0}; // in bytes -> transform to MebiBytes
let computed_usage 	= (ram_usage.rss/(1024*1024)).toFixed(1) + ' MiB';

return computed_usage;

}

exports.init_logs = function() {

	let logs 		= WH.SD.MASTER.PROCESS_LOGS; // process logs at the time of page request ... the rest of logs will be sent via socket directly
	let unsorted 	= {};

	A.content.processes.create_process_log_DOM_bridge();

	// sort it via type and name
	_.forOwn(logs, function(log) {

		WH.PROCESS_LOGS[log.type] 				= WH.PROCESS_LOGS[log.type] || {};
		WH.PROCESS_LOGS[log.type][log.name] 	= WH.PROCESS_LOGS[log.type][log.name] || {};

		unsorted[log.type] 						= unsorted[log.type] || {};
		unsorted[log.type][log.name] 			= unsorted[log.type][log.name] || {};
		unsorted[log.type][log.name][log.id]	= log;

	});

	// SORT IT by time, descending, save the ordered logs into WH.PROCESS_LOGS
	_.forOwn(unsorted, function(logs_by_type, type_name) {

		_.forOwn(logs_by_type, function(logs_by_name, name) {

			let sorted = Object.keys(logs_by_name).sort().reverse();

			sorted.forEach(function(name_key) { 
				
				WH.PROCESS_LOGS[type_name][name][logs_by_name[name_key].id] = logs_by_name[name_key];
				A.content.processes.add_process_log_to_DOM(logs_by_name[name_key], 'append'); 
			
			});

		});

	});

}

exports.add_process_log_to_DOM = function(log, action) {

	action = action || 'prepend'; // append or prepend

	let log_DOM_path = _.get(WH.process_log_DOM_bridge, [log.type, log.name], '');

	if(log_DOM_path && DOM.sections_blocks.process_rows.logs[log_DOM_path]) {

		let DOM_parent = DOM.sections_blocks.process_rows.logs[log_DOM_path];

		let log_time_f 	= V.moment(log.time).locale(WH.locale).format('L LTS:SSS');
		let origin 		= log.origin === 'MASTER' ? 'MASTER' : 'WORKER '+log.worker_id;
		let log_text_ 	= log.data.text || JSON.stringify(log.data);
 		let log_text 	= '['+log_time_f+'][origin: '+origin+'] - <b>'+log.event+':</b> '+log_text_;

		let DOM_log = document.createElement('div')
			DOM_log.classList.add('log_row');
			DOM_log.innerHTML = log_text;

		let a = action === 'append' ? DOM_parent.append(DOM_log) : DOM_parent.prepend(DOM_log);

	}

}

exports.create_process_log_DOM_bridge = function() {

	let i = 1;
	let workers = WH.SD.MASTER.CONFIG.workers;
	let LOG_DOM_PATHS = {

		CHILD_PROCESS: {RETHINKDB: 'processes_rethinkdb_logs'},
		CLUSTER: {MASTER: 'processes_master_logs'},

	}

	for(i; i<=workers; i++) { LOG_DOM_PATHS.CLUSTER['WORKER_'+i] = 'processes_worker_'+i+'_logs'; }

	WH.process_log_DOM_bridge = LOG_DOM_PATHS;

}