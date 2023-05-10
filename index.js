
// capture moment of server initialization (bootup)
var now = new Date();

// setting up neccesarry globals (for fast access) - !! these must be THE ONLY GLOBALS
global.M    = {};   // modules - external functionality - node core modules,  third party modules (my modules are in core)
global.S    = {};   // sites - system, opajda ...
global.C    = {};   // core - base functionality
global.R    = {};   // ={ current = request list (all sites) (only valid requests - those that get to site handler initiation); by_server: { ... only basic data } }
global.B    = {};   // BIN - overflow variable
global.DB;          // RethinkDB handle, DB connections and shadow moved to S (S[site_name].DB = {connection: <>, shadow: {}, NAME: '', ...}) ... for sites .... for processes its in DBP
global.DBP;         // DB data of PROCESS connection ... result.data of connect_site_to_DB() method = {connection: <>, shadow: {}, NAME: '', ...}
global.IO   = {};   // socket.io ... will be populated upon ws server creation (S.socket.create_server) ... { SERVERS: {}, CONNECTIONS: {} }

global.STATE    = {}; // contains certificates, mailers and other fungible stuff
global.CONFIG   = {};
global.PROCESSES= {}; // contains all child processes or pending operations (server.listen()) that are to be closed before shutdown of a server

// create system.bootup - store for bootup info
C.bootup = { start_time: now };

// catch uncaughts errors and warnings - needs to be BEFORE requiring core, to catch syntax errors
var catch_error = require('./bin/catch_error');
process.on('uncaughtException', catch_error);
process.on('unhandledRejection', catch_error);
//process.on('warning', catch_error);

// fill globals C, M, DB, STATE
require('./bin/assemble');

if( M.cluster.isMaster) { // in nodeJS 16, isMaster is deprecated, replaced by isPrimary
    
    // globals are DIFFERENT from those in workers
    C.server.worker_id  = 0; // master has no worker id
    PROCESSES.MASTER    = process;
    // PROCESSES.WORKERS are declared in C.server.create_workers

    C.process.bind_process_event_listeners('MASTER', 'PROCESS');
    C.process.bind_cluster_event_listeners();

    process.on('message', function(message) { console.log('MASTER HANDLING MESSAGE', M.cluster.isPrimary, message); })

    //boot up system
    C.promise.chain([

        C.logger.get_bootup_log_file.args(C.server.worker_id),
        C.DB.bootup,
        C.server.connect_process_to_DB,
        C.server.load_certificates,
        //C.socket.create_master_server,  // DEPRECATED create master socket.io server
        C.socket.setup_socket_on_master,
        C.server.create_workers,        // resolve with succesfully starting to listen to workers
        C.server.init_workers,          // resolves after all workers were inited (Promise.parallel)
        C.mail.setup_core,              // setup mailer for core server (if its in a config) ... sites have their mail setup in site.load
    
    ]).then(function(result) {

        // extract previous steps from each step and make it flat into result.data.steps
        var steps_by_id     = {'[i4]': 'DB_bootup', '[i20]': 'create_workers', '[i11]': 'init_workers', '[i22]': 'C_sites_load_all', '[i24]': 'connect_process_to_DB', '[i26]': 'get_bootup_log_file', '[i41]': 'load_certificates', '[i42]': 'mail_setup_core'};
        result.data.steps   = C.server.extract_previous_steps(result, steps_by_id);

        if(result.ok) {

            DBP = result.data.steps?.connect_process_to_DB?.data; // !! IMPORTANT, DO NOT REMOVE

            C.helper.get_server_IP().then(function(server_IP) { STATE.server_IP = server_IP; });

            /*let options =   { 
                                from:       {name: 'opajda.cz', address: 'info@opajda.cz'},              
                                to:         [{name: 'sheo', address: 'stipav@seznam.cz'}, {name: 'sheo2', address: 'stepan.vetesnik@gmail.com'}],
                                subject:    'ŽÁDOST O REZERVACI na Opajdě',                                     
                                text:       '<!DOCTYPE html><html><head></head><body>ahooooooj</body></html>', 
                                html:       '<!DOCTYPE html><html><head></head><body>ahooooooj</body></html>' 
                            };

            C.mail.send('__CORE__', options).then((res)=>{}).catch((e)=>{});*/

        //console.log('______________ OS CPUs: ', M.os.cpus());
           // var test = C.sites.load_site({name: 'core', path: './sites/core/'}).then(function(tres) { console.log('TEST RESULT', tres)}).catch(function(error) { console.log('TEST ERROR', error)});

            //return {ok: 1, data: {}, error: null};

            //var testt = C.process.EXECUTE_ON_WORKERS([1], {action: 'process.handlers.worker.test', data: {ahoj: 'lala'}}).then(function(res) {});

            // setting up shutdown
            /*setTimeout(function() {

                console.log('_________________________________________ STARTING SHUTDOWN_______________________________');

                setTimeout(function() { 

                    console.log('_______________________________________ KILL FAILED, EXITING... ________________________________');
                    process.exit(0);  // 0 = success code, > 0 = failure codes ... https://nodejs.org/api/process.html#process_exit_codes
                
                }, 20000);  	// just in case, set 10s timeout to exit immediately


				process.kill(process.pid); 								// send kill signal, try to exit gracefully

            }, 20000);*/

            /*setTimeout(() => {

                setInterval(()=> {

                    console.log('wwwwwwwwwwwwwwwwwwwwwwwwww '+M.util.inspect(M.cluster.workers, true, 1));

                }, 5000);

            }, 15000);*/

            // EXAMPLE
            //return C.process.EXECUTE_ON_WORKERS([1,2,3], {action: 'process.handlers.worker.test', data: {ahoj: 'lala'}})

                            //.then(function(result) { /*console.log('EXECUTE ON WORKERS RESULT: ', result);*/ return {ok: 1, data: {}, error: null}; })
                            //.catch(function(error) { /*console.log('EXECUTE ON WORKERS ERROR: ', error);*/ return {ok: 1, data: {}, error: null}; })
                            return {ok: 1, data: {}, error: null}

        } else { return result; }

    }).then(end_chain).catch(catch_chain);
    
} else if(M.cluster.isWorker) {
    
    // globals are DIFFERENT from those in master
    let worker          = M.cluster.worker;
    let wid             = worker.id;
    let w_name          = 'WORKER_'+wid;
    
    C.server.worker_id  = wid;
    C.server.process_id = worker.process.pid; // == process.pid (in this block)

    PROCESSES[w_name]   = process; // == M.cluster.worker.process (in this block)

    // wait for message from MASTER to initialize this worker
    process.on('message',  C.process.MAKE_WORKER_LISTEN_TO_MASTER);

    C.process.bind_process_event_listeners(w_name, 'PROCESS');
    
}

function catch_chain(error) { 
    
    C.logger.bootup_step({id: '[e17]', err_text: 'UNKNOWN ERROR DURING BOOTUP: '+error.message, err: error});
    console.log(C.logger.ANSI('bold,red', '\r\nCORE webserver failed to bootup.\r\n'));
    process.kill(process.pid); setTimeout(()=>{ process.exit(0); }, 1000); // quit everything gracefully, after 1 second forcefully 

}

function end_chain(result)  { 
    
    if (result.ok) {    C.logger.bootup_step({id: '[i9]', text: 'Bootup chain ended. CORE webserver is up and running.'}); }
    else {              
        
        var id   = result.id    || '[e47]';
        var text = result.text  || 'Unknown step result.';

        C.logger.bootup_step({id, err_text: text, err: (result.error || new Error(text))}); 

        console.log(C.logger.ANSI('bold,red', '\r\nCORE webserver failed to bootup.\r\n')); 

        process.kill(process.pid); setTimeout(()=>{ process.exit(0); }, 1000); // quit everything gracefully, after 1 second forcefully 
    
    }

}