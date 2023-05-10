
// logs

// init
C.bootup.logs = CONFIG.core.logs; // move to C for dynamic extending

// creates or gets writeStream bootup log file (e.g. ./core/logs/2016_01_31_00:00:00.txt)
// puts writes stream in C.bootup.logs.log
// return promise
exports.get_bootup_log_file = async function(worker_id) {

    var result      = {ok: 0, data: {}, id: '[i3]', text: '', error: null};
    var error_text  = worker_id ? 'Failed to get bootup log file for worker ' + worker_id + '.' : 'Failed to create bootup log file write stream.';

    try {

        C.bootup.logs.log_file  = 'bootup/' + M.moment(C.bootup.start_time).format('YYYY_MM_DD-HH;mm;ss')+'.log';   // 2016_01_31-00;00;00.log
        C.bootup.logs.log_path = M.path.join(C.bootup.logs.path, C.bootup.logs.log_file);                           // ./logs/bootup/2016_01_31-00;00;00.log
    
        var bootup_log = M.fs.createWriteStream(C.bootup.logs.log_path, {flags: 'a'}); // returns a fs.WriteStream

        if(bootup_log) {

            C.bootup.logs.log   = bootup_log; // save the log file stream to global variable
            result.text         = worker_id ? 'Got bootup log file for worker '+worker_id+'.' : 'Required Core and initialized logger.';
            result              = await C.logger.bootup_step({ id: result.id, text: result.text}); // must resolve with {ok: 0, data: {}, error: null};
            result.data         = {...result.data, previous_step: {data: {}}}// this is first method in chain, create default previous_step

        } else {

            result.id       = '[e2.1]';
            result.text     = error_text;
            result.error    = new Error(result.text); // error will be logged at the end of the promise chain in index.js

        }

    } catch(error) { result.id = '[e2]'; result.text = error_text+' - unknown error: '+error.message; result.error = error; }

    return result;
    
};

exports.bootup_step = async function(step) {

    // step = { id: '[i1]', text: 'some text', err_text: '', err: Error} // id - always, pnly text or error at once
    var result  = {ok: 0, data: {}, id:'[i26]', text:'', error: null};

    try {

        step            = step      || {id: '[i0]'};
        step.id         = step.id   || '';
        step.site       = step.site || '';
        step.text       = step.text || '';
        step.err_text   = step.err_text || step.text || '';

        var now         = new Date();
        var elapsed     = now - C.bootup.start_time;
        var br          = '\r\n';
        var pid         = M.cluster.isMaster ? '[MASTER]' : '[W'+C.server.worker_id+']';
        var site        = step.site ? '['+step.site+']' : '';
        var step_styles = {'[MASTER]': 'bold', '[W1]': 'blue', '[W2]': 'magenta', '[W3]': 'cyan', '[W4]': 'yellow', 'error': 'bold,red'};
        var step_style  = step.err ? step_styles['error'] : (step_styles[pid] || '');
        var step_content= step.err ? ('[ERROR] ' + br + step.err_text + br + M.util.inspect(step.err) + br + br) : ( step.text + br );

        var step_message = '[' + elapsed + 'ms]' + step.id + pid + site + ' ' + step_content;

        console.log(ANSI(step_style, step_message));

        if (C.bootup.logs.log) {

            var write_promise = new Promise((resolve, reject) => {

                C.bootup.logs.log.write(step_message, function(err) {

                    if(err) {   

                        var err_id      = '[e4.3]';
                        var err_text    = 'Failed to write to bootup log file (step '+step.id+') - unknown error: '+err.message;
                        console.log(ANSI('bold,red', err_id + ' ' + err_text));
                        
                        resolve({ok: 0, data: {step}, id: err_id, text: err_text, error: err}); 
                    
                    } else { resolve({ok: 1, data: {step}, id: result.id, text: 'Successfully logged bootup step.', error: null}); }

                });

            });

            result = await write_promise;

        } else {

            result.id           = '[e4.2]';
            result.data.step    = step;
            result.text         = 'Empty bootup log file write stream - could not log step '+step.id;
            result.error        = new Error('Empty bootup log file write stream - could not log step '+step.id);

            console.log(ANSI('bold,red', result.id + ' '+result.text));

        }

    } catch(error) { 
        
        result.id           = '[e4]';
        result.data.step    = step;
        result.data.text    = 'Could not log bootup step - unknown error: '+error.message; 
        result.error        = error; 
        
        console.log(ANSI('bold,red', result.id + ' '+result.text)); 
    
    }

    return result;

};

// log error that occured during MASTER<->WORKER communication
exports.catch_process_error = function(err) {
    
    var time    = new Date();
    var TIME    = '[' + time.getDate() + '. ' + (time.getMonth() + 1) + '. ' + time.getFullYear() + ' ' + time.getHours() + ':' + time.getMinutes() + ':' +time.getSeconds() + '.' + time.getMilliseconds() + ']';
    var file    = time.getFullYear() + '_' + (time.getMonth() + 1) + '_' + time.getDate();
    var process_= M.cluster.isMaster ? '[MASTER]' : '[W'+C.server.worker_id+']';
    var separator='________________________________________';
    var error   = '\r\n' + TIME + '\r\nPROCESS ERROR:\r\n' + M.util.inspect(err) + '\r\n';
        error  += separator + separator + '\r\n';
    
    M.fs.appendFileSync( CONFIG.core.logs.path + 'error/' + file, error);
    
    console.log(ANSI('bold,red', separator + '\r\n\r\n ' + process_ + ' CAUGHT AND LOGGED PROCESS ERROR \r\n' + separator + '\r\n') + M.util.inspect(err));

} 

// log all unhandled errors into console and db, do not expect any result (might fail)
exports.catch_unknown_runtime_error = function(data={}) {

    try {

        var now         = M.moment();
        var time        = now.format('YYYY/MM/DD - HH:mm:ss');
        var file_name   = now.format('YYYY_M_D')+'.log';
        var file_path   = M.path.join(CONFIG.core?.logs?.path, 'error', file_name);
        var worker      = C.server.worker_id ? '[W'+C.server.worker_id+']' : '[MASTER]';
        var id          = now.format('x')+'_'+C.helper.random_alpha_numeric(3);
        var id_         = data.id || '[e71]';
        var text        = data.text || ''
        var error       = data.error || {message: 'Unknown error.'};
        var data_       = data.data || '';
        var db_data     = {time, id, id_, text, error: M.util.inspect(error)};

        var log_text    = '\r\n____________________\r\n ['+time+']'+worker+'['+id+'] Caught runtime error: '+text+'\r\nERROR: \r\n'+M.util.inspect(error)+'\r\nDATA: \r\n'+M.util.inspect(data)+'__________________\r\n';

        var console_result  = console.log(C.logger.ANSI('red,bold', log_text));
        var file_result     = M.fs.appendFileSync( file_path, log_text );
        var db_result       = (typeof DBP !== 'undefined') ? DB.SET(DBP, 'errors', db_data) : null; // do not wait for result

    } catch(error) { console.log('____________\r\n [e70] Failed to catch unknown runtime error: '+error.message+'\r\n_______________ DATA: \r\n'+M.util.inspect(data)+'\r\n____________'); }

}

// log something into console with timestamp etc, do not expect any result (might fail)
exports.runtime_log = function(data={}) {

    try {

        var time        = M.moment().format('YYYY/MM/DD - HH:mm:ss');
        var worker      = C.server.worker_id ? '[W'+C.server.worker_id+']' : '[MASTER]';
        var id          = data.id || '[i48]';
        var text        = data.text || ''

        var log_text    = '['+time+']'+worker+'['+id+'] '+text

        console.log(C.logger.ANSI('yellow', log_text));


    } catch(error) { console.log('[i48.1] Failed to make a runtime log - unknown error: '+error.message); }

}

// REQUEST
exports.request = {};

// must return a promise, go through /site/logs/YYYY/mm/dd and create any dir that doesnt exist
exports.request.get_request_log_path = async function(start_time, site_name) {
    
    var log_result = {ok: 0, data: {}, id: '', text: '', error: null};

    try {

        var SITE        = S[site_name] || null; // if SITE is unknown, use core logs directory
        var start_moment= M.moment(start_time);
    
        // first check if whole request log dir structure already exists (its created only on first request of the day)
        var YYYY_dir        = start_moment.format('YYYY');
        var MM_dir          = start_moment.format('MM');
        var DD_dir          = start_moment.format('DD');
        var logs_path       = (SITE && SITE.config) ? M.path.join(SITE.config.root, SITE.config.logs.path) : M.path.join(CONFIG.core.root, CONFIG.core.logs.path, CONFIG.core.logs.request.path);
        var logs_YYYY_path  = M.path.join(logs_path, YYYY_dir);
        var logs_MM_path    = M.path.join(logs_YYYY_path, MM_dir);
        var log_full_path   = M.path.join(logs_MM_path, DD_dir);

        // helper functions
        // returns stats if path exists, otherwise returns null
        var check_log_dir_part  =   async function(path) { try { return await M.fs.stat_async(path); } catch(error) { return null; } }
        var create_log_dir_part =   async function(path) { try { return await M.fs.mkdir_async(path);} catch(error) { return Promise.reject(error); } }

        // first check if full log path exists, if yes, return it and do not bother with the rest
        var log_full_path_exists = await check_log_dir_part(log_full_path);

        if(log_full_path_exists) {

            log_result = {ok: 1, data: {path: log_full_path}, id: '[i32]', text: 'Got logs path.', error: null };

        // log path doesnt exist, create needed directories
        } else {

            // BASE LOGS PATH
            var logs_path_exists = await check_log_dir_part(logs_path);
            if( !logs_path_exists ) var log_path_created = await create_log_dir_part(logs_path); // if theres an error here, it will caught in catch() at the end

            // YYYY DIR
            var logs_YYYY_path_exists = await check_log_dir_part(logs_YYYY_path);
            if( !logs_YYYY_path_exists ) var log_YYYY_path_created = await create_log_dir_part(logs_YYYY_path);

            // MM DIR
            var logs_MM_path_exists = await check_log_dir_part(logs_MM_path);
            if( !logs_MM_path_exists ) var log_MM_path_created = await create_log_dir_part(logs_MM_path);

            // DD DIR
            var log_full_path_created = await create_log_dir_part(log_full_path);

            log_result = {ok: 1, data: {path: log_full_path}, id: '[i32]', text: 'Got logs path.', error: null };

        }
        
    } catch(error) { log_result = {ok: 0, id: '[e42]', data: {}, error, text: 'Failed to get request log path - unknown error: '+error.message}; }

    return log_result;
    
}

// log a successful request into access log file, must return a promise
exports.request.log_access = async function({Q, s, request_result={}}={}) {
    
    var log_result  = {ok: 0, data: {}, id: '', text: '', error: null};

    try {

        var SITE                = S[Q.site];
        var log_type            = C.request.get_log_type(SITE.name, Q.hook, 'file');
        var time_string         = M.moment(Q.times.start).format('HH:mm:ss.SSS');
        var request_duration    = Q.times.handled - Q.times.start;
        var from_ip             = Q.from_ip ? 'YES' : 'NO';
        var is_crawler          = Q.is_crawler ? 'YES' : 'NO';
        var pid                 = '[W'+C.server.worker_id+']';

        var log_text            = '';

        // file log only if log_type = full
        if(log_type === 'full') {

            log_text = '\r\n';
            log_text+= '[ID '+Q.id+']['+time_string+']['+request_duration+'ms]'+pid+'['+Q.hook+'][' + Q.site + '][' + Q.method + '] '+ Q.true_host + Q.true_url + '\r\n';
            log_text+= 'Protocol: ' + Q.protocol + '\r\n';
            log_text+= 'Client IP: ' + Q.client_ip + '\r\n';
            log_text+= 'From server IP: ' + from_ip + '\r\n';
            log_text+= 'Is Crawler: ' + is_crawler + '\r\n';
            log_text+= 'USER AGENT: ' + M.util.inspect(Q.user_agent) + '\r\n';
            log_text+= 'QUERY: ' + M.util.inspect(Q.query) + '\r\n';
            log_text+= 'PARAMS: ' + M.util.inspect(Q.params) + '\r\n';
            log_text+= 'COOKIES: ' + M.util.inspect(Q.cookies) + '\r\n';
            log_text+= 'RESPONSE: ' + M.util.inspect(s.result) + '\r\n';
            log_text+= 'RESULT: ' + M.util.inspect(request_result) + '\r\n';
            log_text+= '_______________________________________________________________________________________________________\r\n';

        } else if(log_type === 'basic') {

            var response_code   = M._.get(s, ['result', 'code'], '000');
            var req_result_text = M._.get(request_result, 'ok ', '') + M._.get(request_result, 'text ', '');

            log_text = '\r\n';
            log_text+= '[ID '+Q.id+']['+time_string+']['+request_duration+'ms]'+pid+'['+Q.hook+'][' + Q.site + '][' + Q.method + '] '+ Q.true_host + Q.true_url + '\r\n';
            log_text+= 'Protocol: ' + Q.protocol + '\r\n';
            log_text+= 'Client IP: ' + Q.client_ip + '\r\n';
            log_text+= 'Is Crawler: ' + is_crawler + '\r\n';
            log_text+= 'USER AGENT: ' + Q.headers['user-agent'] + '\r\n';
            log_text+= 'RESPONSE: ' + response_code + '\r\n';
            log_text+= 'RESULT OK: ' + req_result_text + '\r\n';
            log_text+= '_______________________________________________________________________________________________________\r\n';

        } else if(log_type === 'bare') {

            log_text = '\r\n';
            log_text+= '[ID '+Q.id+']['+time_string+']['+request_duration+'ms]'+pid+'['+Q.hook+'][' + Q.site + '][' + Q.method + '] '+ Q.true_host + Q.true_url + '\r\n';
            log_text+= '_______________________________________________________________________________________________________\r\n';

        // log_type = none or other
        } else { log_text = ''; }

        if(log_text) {

            // first get logs dir (site logs dir if SITE exists, core logs dir otherwise)
            var log_path     = await C.logger.request.get_request_log_path(Q.times.start, SITE.name);

            if(log_path.ok) {

                var logged  = await M.fs.append_file_async(M.path.join(log_path.data.path, 'access.log'), log_text); // if theres an error in append_file, it will be caught in catch() at the end

                log_result = {ok: 1, id: '[i37.1]', data: {}, error: null, text: 'Successfully logged request into access log file.'};

            } else { log_result = log_path; }

        } else { log_result = {...log_result, ok: 1, id: '[i37]', text: 'Request not to be logged in file.'};}

    } catch(error) { log_result = {ok: 0, id: '[e19]', error, text: 'Failed to log reqest into log file - unknown error: '+error.message}; }

    return log_result; 
        
}

// logs request error into .log file, must return a promise
exports.request.log_error = async function({Q, s, request_result={}}={}) {
    
    var log_result = {ok: 0, data: {}, id: '', text: '', error: null};

    try {

        var SITE            = S[Q.site] || null;
        var site_name       = M._.get(SITE, 'name', '');
        var log_type        = C.request.get_log_type(site_name, 'error', 'file');
        var now             = C.helper.now();
        var start_time      = Q.times?.start || now;
        var time_string     = M.moment(start_time).format('HH:mm:ss.SSS');
        var request_duration= now - start_time;
        var pid             = '[W'+C.server.worker_id+']';

        var log_text        = '';

        // first determine whether the request had been initialized or not
        if(Q.id && SITE && SITE.name && SITE.config) {

            if(log_type === 'full') {

                log_text = '\r\n';
                log_text+= '[ID '+Q.id+']['+time_string+']['+request_duration+'ms]'+pid+'['+Q.hook+'][' + Q.site + '][' + Q.method + '] '+ Q.true_host + Q.true_url + '\r\n';
                log_text+= 'Protocol: ' + Q.protocol + '\r\n';
                log_text+= 'Client IP: ' + Q.client_ip + '\r\n';
                log_text+= 'From server IP: ' + (Q.from_ip ? 'YES' : 'NO') + '\r\n';
                log_text+= 'Is Crawler: ' + (Q.is_crawler ? 'YES' : 'NO') + '\r\n';
                log_text+= 'USER AGENT: ' + M.util.inspect(Q.user_agent) + '\r\n';
                log_text+= 'QUERY: ' + M.util.inspect(Q.query) + '\r\n';
                log_text+= 'PARAMS: ' + M.util.inspect(Q.params) + '\r\n';
                log_text+= 'COOKIES: ' + M.util.inspect(Q.cookies) + '\r\n';
                log_text+= 'RESPONSE: ' + M.util.inspect(s.result) + '\r\n';
                log_text+= 'ERROR:\r\n';
                log_text+= 'RESULT: ' + M.util.inspect(request_result) + '\r\n';
                log_text+= '_______________________________________________________________________________________________________\r\n';

            } else if(log_type === 'basic') {

                var response_code   = M._.get(s, ['result', 'code'], '000');

                log_text = '\r\n';
                log_text+= '[ID '+Q.id+']['+time_string+']['+request_duration+'ms]'+pid+'['+Q.hook+'][' + Q.site + '][' + Q.method + '] '+ Q.true_host + Q.true_url + '\r\n';
                log_text+= 'Protocol: ' + Q.protocol + '\r\n';
                log_text+= 'Client IP: ' + Q.client_ip + '\r\n';
                log_text+= 'Is Crawler: ' + is_crawler + '\r\n';
                log_text+= 'USER AGENT: ' + Q.headers['user-agent'] + '\r\n';
                log_text+= 'RESPONSE: ' + response_code + '\r\n';
                log_text+= 'ERROR:\r\n';
                log_text+= 'RESULT: ' + M.util.inspect(request_result) + '\r\n';
                log_text+= '_______________________________________________________________________________________________________\r\n';

            } else if(log_type === 'bare') {

                log_text = '\r\n';
                log_text+= '[ID '+Q.id+']['+time_string+']['+request_duration+'ms]'+pid+'['+Q.hook+'][' + Q.site + '][' + Q.method + '] '+ Q.true_host + Q.true_url + '\r\n';
                log_text+= 'Client IP: ' + Q.client_ip + '\r\n';
                log_text+= 'RESULT: ' + M.util.inspect(request_result) + '\r\n';
                log_text+= '_______________________________________________________________________________________________________\r\n';

            } else { log_text = ''; }
            
        // request had not been initialized
        } else {

            if(log_type === 'full' || log_type === 'basic') {
            
                var client_IP       = Q.headers['x-forwarded-for'] || Q.connection.remoteAddress || '';
                var ua              = Q.headers['user-agent'];
                var response_code   = M._.get(s, ['result', 'code'], '000');
                
                log_text = '\r\n';
                log_text+= '['+time_string+']'+pid+'['+site_name+']['+Q.method+']['+response_code+'] ' + Q.headers.host + Q.url + '\r\n';
                log_text+= 'Protocol: ' + Q.protocol + '\r\n';
                log_text+= 'CLIENT IP: ' + client_IP + '\r\n';
                log_text+= 'USER AGENT: ' + ua + '\r\n';
                log_text+= 'FULL HEADERS: ' + M.util.inspect(Q.headers) + '\r\n';
                log_text+= 'RESPONSE: ' + M.util.inspect(s.result) + '\r\n';
                log_text+= 'ERROR:\r\n';
                log_text+= 'RESULT: ' + M.util.inspect(request_result) + '\r\n';
                log_text+= '_______________________________________________________________________________________________________\r\n';

            } else if(log_type === 'bare') {

                var response_code   = M._.get(s, ['result', 'code'], '000');

                log_text = '\r\n';
                log_text+= '['+time_string+']'+pid+'['+site_name+']['+Q.method+']['+response_code+'] ' + Q.headers.host + Q.url + '\r\n';
                log_text+= 'RESULT: ' + M.util.inspect(request_result) + '\r\n';
                log_text+= '_______________________________________________________________________________________________________\r\n';

            } else { log_text = ''; }
            
        }
        
        if(log_text) {

            // first get logs dir (site logs dir if SITE exists, core logs dir otherwise)
            var log_path     = await C.logger.request.get_request_log_path(start_time, site_name);

            if(log_path.ok) {

                var logged  = await M.fs.append_file_async(M.path.join(log_path.data.path, 'error.log'), log_text); // if theres an error in append_file, it will be caught in catch() at the end

                log_result = {ok: 1, id: '[i28]', data: {}, error: null, text: 'Successfully logged request error into log file.'};

            } else { log_result = log_path; }

        } else { log_result = {...log_result, ok: 1, id: '[i29]', text: 'Request error not to be logged in file.'}; }

    } catch(error) { log_result = {ok: 0, id: '[e18]', error, text: 'Failed to log reqest error into log file - unknown error: '+error.message}; }

    return log_result;
    
}

exports.request.log_to_console = async function({Q, s, request_result={}}={}) {

    var log_result = {ok: 1, data: {}, id: '[i30]', text: 'Logged to console.', error: null};

    try {

        var SITE        = S[Q.site] || null;
        var site_name   = M._.get(SITE, 'name', '');
        var hook        = Q.hook || 'error';
        var log_type    = C.request.get_log_type(site_name, hook, 'console');
        var pid         = '[W'+C.server.worker_id+']';
        var now         = C.helper.now();
        var start_time  = Q?.times?.start || now;
        var handled_time= Q?.times?.handled || now;
        var time_text   = M.moment(start_time).format('DD.MM.YYYY_HH:mm:ss');
        var duration_time= (handled_time - start_time);
        var log_text    = ''; 
        var outcome     = request_result.ok ? 'SUCCESS' : 'ERROR';
        var error_text  = request_result.text || (request_result.error ? request_result.error.message : 'Unknown error');
            error_text  = request_result.ok ? '' : error_text;
        var full_error  = request_result.error ? '\r\n'+M.util.inspect(request_result.error) : '';

        if(log_type === 'full' || log_type === 'basic' || log_type === 'bare') {

            // request has been initialized
            if(Q.id && SITE) {

                    log_text    =  outcome+' ['+Q.hook.toUpperCase()+']['+request_result.id+']'+pid+'['+Q.id+']['+Q.site+']['+Q.country+']['+Q.language+']['+Q.client_ip+']['+time_text+']['+duration_time+'ms] '+Q.true_host+Q.true_url+' '+error_text+full_error;

            } else {

                var client_ip   = Q.headers['x-forwarded-for'] || Q.connection.remoteAddress;
                    outcome     = 'ERROR';
                    log_text    = 'ERROR [ ERROR ]['+request_result.id+']'+pid+'['+site_name+']['+client_ip+']['+time_text+'] '+Q.headers.host+Q.url+' (ERROR:  '+error_text+')'+full_error;

            }

        } else { log_text = ''; }

        if(log_text) {

            var log_style = outcome === 'ERROR' ? 'bold,red' : '';

            console.log(C.logger.ANSI(log_style, log_text));

        } else { log_result.text = 'Not to be logged in the console.'; }

    } catch(error) { 
        
        log_result = {...log_result, id: '[e65]', error, data: {Q, request_result}, text: 'Failed to log request to console - unknown error: '+error.message}; 

        console.log( C.logger.ANSI('bold,red', log_result.id+' ERROR - '+log_result.text+'\r\n'+M.util.inspect(error)) );
    
    }

    return log_result;

}


// SHUTDOWN

exports.shutdown = {};

exports.shutdown.create_log_file = function(trigger = '') {
    
    var shutdown_moment     = M.moment();
    var shutdown_log_dir    = M.path.join(C.bootup.logs.path, 'shutdown');
    var shutdown_log_name   = shutdown_moment.format('YYYY_MM_DD-HH_mm_ss')+'.log';
    var shutdown_log_path   = M.path.join(shutdown_log_dir, shutdown_log_name);  // ./core/logs/shutdown/2016_01_31-00;00;00.log
    
    var text                = '[' + shutdown_moment.format() + '][triggered by ' + trigger + ']\r\n';

    // create shutdown folder if it doesnt exist
    if(!M.fs.existsSync(shutdown_log_dir)) M.fs.mkdirSync(shutdown_log_dir);
    
    M.fs.appendFileSync(shutdown_log_path, text);
    
    return shutdown_log_path;
    
}

exports.ANSI_CODES = {

    // alternative to chalk.js
    // https://blog.logrocket.com/using-console-colors-node-js/
    // https://gist.github.com/abritinthebay/d80eb99b2726c83feb0d97eab95206c4
    // https://www.codegrepper.com/code-examples/javascript/nodejs+console.log+bold
    // codes to make console.log colorful and bold etc

    reset:      '\x1b[0m',
    bold:       '\x1b[1m',  // bold (also called bright)
    dim:        '\x1b[2m',  // opposite of bold, not supported
    cursive:    '\x1b[3m',  // not supported
    underscore: '\x1b[4m',  // not supported
    blink:      '\x1b[5m',
    reverse:    '\x1b[7m',
    hidden:     '\x1b[8m',

    black:      '\x1b[30m',
    red:        '\x1b[31m',
    green:      '\x1b[32m',
    yellow:     '\x1b[33m',
    blue:       '\x1b[34m',
    magenta:    '\x1b[35m',
    cyan:       '\x1b[36m',
    white:      '\x1b[37m',

    bg_black:    '\x1b[40m',
    bg_red:      '\x1b[41m',
    bg_green:    '\x1b[42m',
    bg_yellow:   '\x1b[43m',
    bg_blue:     '\x1b[44m',
    bg_magenta:  '\x1b[45m',
    bg_cyan:     '\x1b[46m',
    bg_white:    '\x1b[47m',


}

// style console.log output
function ANSI(styles, string) {

    // first convert styles into an array
    if( !M._.isArray(styles) ) { 

        // if its not array, it must be a string (comma separated), anything else will be ignored
        if(M._.isString(styles)) { 
            
            styles = styles.split(',');

        } else {

            styles = [];

        }

    }

    var added_style = false;
    var style_code  = '';
    var reset_code  = C.logger.ANSI_CODES['reset'];

    // now modify the string
    styles.forEach(function(style_name) {

        style_code = C.logger.ANSI_CODES[style_name];

        if(style_code) {

            string      = style_code + string;
            added_style = true;

        }

    });

    // if some style was added, add reset code at the end
    if(added_style) string = string + reset_code;

    return string;


}

exports.ANSI = ANSI;
