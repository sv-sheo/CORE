
exports.init = function() {

	let fd = {}; // formatted data

	let now 				= V.moment().locale(WH.locale);
	let server_uptime 		= WH.SD.MASTER.PROCESSES.MASTER.uptime*1000; // in seconds with 3 decimals
	let server_uptime_d 	= V.moment.duration(server_uptime).locale(WH.locale);
	let server_starttime	= now.format('x') - server_uptime;
	let server_starttime_d	= V.moment(server_starttime).locale(WH.locale);
	let machine_uptime 		= WH.SD.MASTER.OS.uptime*1000;
	let machine_uptime_d 	= V.moment.duration(machine_uptime).locale(WH.locale);
	let machine_starttime 	= now.format('x') - machine_uptime;
	let machine_starttime_d	= V.moment(machine_starttime).locale(WH.locale);

	let sites 				= WH.SD.WORKERS?.[1]?.SITES || {};
	let sites_all			= Object.keys(sites);
	let sites_loaded		= [];
							_.forOwn(sites, function(site) { if(site.STATE.loaded) sites_loaded.push(site.name); });

	fd.server_uptime 		= server_uptime_d.humanize() + ' ('+server_uptime_d.hours()+':'+server_uptime_d.minutes()+':'+server_uptime_d.seconds()+')';
	fd.server_starttime 	= server_starttime_d.format('LLL');
	fd.server_public_ip 	= WH.SD.MASTER.STATE.server_IP?.ipv4;
	fd.server_workers 		= WH.SD.MASTER.CONFIG.workers;
	fd.server_sites 		= sites_loaded.length+'/'+sites_all.length+'<br>('+sites_loaded.join(', ')+' / '+sites_all.join(', ')+')';

	fd.server_machine 				= WH.SD.MASTER.OS.machine + '.'+WH.SD.MASTER.OS.version;
	fd.server_machine_user 			= WH.SD.MASTER.OS.hostname;
	fd.server_machine_uptime		= machine_uptime_d.humanize() + ' ('+machine_uptime_d.hours()+':'+machine_uptime_d.minutes()+':'+machine_uptime_d.seconds()+')';
	fd.server_machine_starttime		= machine_starttime_d.format('LLL');
	fd.server_type					= WH.SD.MASTER.OS.type;
	fd.server_platform				= WH.SD.MASTER.OS.platform;
	fd.server_architecture			= WH.SD.MASTER.OS.arch;

	fd.server_environment			= WH.SD.MASTER.CONFIG.ENVIRONMENT;
	fd.server_ip					= WH.SD.MASTER.CONFIG.server_ip;
	fd.server_root					= WH.SD.MASTER.CONFIG.root;
	fd.server_node					= 'Node.JS: '+WH.SD.MASTER.PROCESSES.MASTER?.version+'<br>(V8 version '+WH.SD.MASTER.PROCESSES.MASTER?.versions?.v8+')';

										// for disk usage, use https://www.npmjs.com/package/diskusage
										// on windows, loadavg is 0, for precise calculations, use https://www.npmjs.com/package/node-os-utils or take inspiration from it
										// dont forget to add network stats
	fd.server_cpu_usage				= WH.SD.MASTER.OS.loadavg[0].toFixed(0)+' % (1 minute average)'; // [1 min average, 5 min average, 15 min average]
	fd.server_ram					= (WH.SD.MASTER.OS.totalmem/(1024*1024*1024)).toFixed(2)+' GiB'; // gibybytes
	fd.server_ram_usage				= ((WH.SD.MASTER.OS.totalmem-WH.SD.MASTER.OS.freemem)/(1024*1024*1024)).toFixed(2)+' GiB';
	fd.server_qps					= '0';

	fd.server_admin_on				= WH.SD.MASTER.CONFIG.admin?.on ? 'YES' : 'NO';
	fd.server_admin_site_name		= WH.SD.MASTER.CONFIG.admin?.name;
	fd.server_admin_site_path		= WH.SD.MASTER.CONFIG.admin?.path;

	fd.server_db_type				= WH.SD.MASTER.CONFIG.db?.type;
	fd.server_db_address			= WH.SD.MASTER.CONFIG.db.host+':'+WH.SD.MASTER.CONFIG.db.port;
	fd.server_db_user				= WH.SD.MASTER.CONFIG.db.user;
	fd.server_db_admin_db			= WH.SD.MASTER.CONFIG.db.db;

	fd.server_socket_on				= WH.SD.MASTER.CONFIG.socket.enabled ? 'ENABLED' : 'DISABLED';
	fd.server_socket_host			= WH.SD.MASTER.CONFIG.socket.host+':'+WH.SD.MASTER.CONFIG.socket.port;
	fd.server_socket_secure 		= WH.SD.MASTER.CONFIG.socket.secure ? 'YES' : 'NO';
	fd.server_socket_connections 	= 0;

	fd.server_secure				= WH.SD.MASTER.CONFIG.https ? 'YES' : 'NO';
	fd.server_mailer				= WH.SD.MASTER.CONFIG.mailer?.enabled ? 'ON ('+WH.SD.MASTER.CONFIG.mailer?.host+':'+WH.SD.MASTER.CONFIG.mailer?.port+'@'+WH.SD.MASTER.CONFIG.mailer?.user+' '+(WH.SD.MASTER.CONFIG.mailer?.secure ? '(secure)':'')+')' : 'DISABLED';
	fd.server_request_timeout 		= WH.SD.MASTER.CONFIG.request?.timeout ? WH.SD.MASTER.CONFIG.request.timeout+' seconds' : 'none';
	fd.server_files_temp_dir 		= WH.SD.MASTER.CONFIG.files?.temp_dir;
	fd.server_files_max_size 		= WH.SD.MASTER.CONFIG.files?.max_size+' MiB';
	fd.server_shutdown_timeout 		= WH.SD.MASTER.CONFIG.shutdown_timeout ? WH.SD.MASTER.CONFIG.shutdown_timeout+' seconds' : 'none';

	_.forOwn(fd, function(content, content_name) {

		if(DOM.sections_blocks.rows.contents?.[content_name]) {

			DOM.sections_blocks.rows.contents[content_name].innerHTML = content;

		}

	});

	DOM.sections_blocks.headers['server_machine_header'].innerHTML = 'MACHINE ('+WH.SD.MASTER.CONFIG.machine+')';

	let shutdown_button = DOM.sections_blocks.rows.contents['server_shutdown_button'].querySelector("button");
		shutdown_button.addEventListener('click', async function(e) { 
			
			let res = await M.socket.execute('MAIN', 'shutdown_server', {trigger: 'SERVER SHUTDOWN BUTTON'}, {return: false});
		
		});

	let email_button = DOM.sections_blocks.rows.contents['server_test_mail_button'].querySelector("button");
	email_button.addEventListener('click', async function(e) { 
		
		let res = await M.socket.execute('MAIN', 'send_test_email', {text: 'LALALA MAIL TEST HAHAHA'}, {return: true, timeout: 15});

		console.log('EEEEEEEEEE', res)
	
	});


}