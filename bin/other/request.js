
// extend request object with site, host, IP, user agent, request type, QUERY etc...
exports.init = async function(Q) {
console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAaa')
    Q.times         = {start: C.helper.now()};
    Q.id            = Q.times.start + '_' + Math.floor(Math.random() * 1000);  
    Q.client_ip     = Q.headers['x-forwarded-for'] || Q.connection.remoteAddress;
    Q.user_agent    = M.user_agent(Q.headers['user-agent']) || {device: {}};
    Q.is_crawler    = /bot|crawl|slurp|spider/i.test(Q.headers['user-agent']); 
    Q.cookies       = {};
    Q.post          = Promise.resolve({}); // by default empty object
    Q.method        = Q.method.toLowerCase();
    Q.hook          = 'main';   // main | sub | none | error (set only internally in C.request.handle_error)
    
    // Q.site, Q.host, true_host, url & true_url are determined in C.request.handle before initialization
    var SITE        = S[Q.site]; // get SITE object 

    // place to operate with data during handling request
    Q.data          = {}; // handler data to pass in promise chain
    Q.frontend      = {}; // data to send to frontend (default states etc)
    //Q.html          = {}; // object containing parts of compiled handlebars ..... Q.data.html used instead
    Q.site_is_valid = (Q.site && S[Q.site] && S[Q.site].config && STATE.sites.loaded[Q.site]) ? true : false;// check if site is valid
    Q.is_https      = (Q.site_is_valid && S[Q.site].config.is_https);                                        // check if its https
    Q.port          = (Q.is_https ? SITE.config.https_port : SITE.config.port) || 80; // 80 for non-HTTPS, 844X for HTTPS
    Q.protocol      = Q.is_https ? 'https' : 'http';
    Q.DB            = SITE.DB.NAME || '';  // shortcut for DB querries
    Q.base_url      = M._.get(SITE, 'config.base_url', '/'); // BASE URL - MUST START and END with '/'  ... or be === '/'

    if(Q.from_ip) Q.base_url = '/'+Q.host+Q.base_url; // prepend sitename host to base_url if accessing via IP

    // DEVICE SIZE - desktop x handheld - defaults to desktop
    var ua_type                 = Q.user_agent.device.type;
    var device_types            = {desktop: 'desktop', mobile: 'handheld', wearable: 'handheld', tablet: 'handheld'};
    Q.user_agent.device.size    = device_types[ua_type] ||'desktop'; // desktop || handheld
    
    Q.data.HOST         = Q.protocol + '://' + Q.true_host + Q.base_url; // generate TRUE HOST string for file linking in templates
    Q.frontend.HOST     = Q.data.HOST;

    // QUERY
    Q.query             = C.request.parse_querystring(Q.url);
    
    // PRQI - PARENT REQUEST ID - check if its a sub request - if it has parent request id (prqi), it is a sub request (for example a JS script of a page)
    Q.parent_request_id = Q.query['prqi'] || Q.query['parent_request_id'] || '';
    
    if(Q.parent_request_id) Q.hook = 'sub';

    // COOKIES
    Q.cookies   = C.request.parse_cookies(Q.headers.cookie, SITE.config.code_geass);
    
    // COUNTRY - possible values viz http://www.ip2country.net/ip2country/country_code.html (GEOIP package)
    Q.country   = M.country(Q) || SITE.config.default_country || false; // on localhost M.country() returns FALSE

    // LANGUAGE
    Q.language  = C.request.get_language(Q, SITE);
    
    //console.log('IP and COUNTRY: ', Q.country, Q.headers['x-forwarded-for'], ' || ', Q.connection.remoteAddress);
    
    // the request has some body - get it
    if(Q.method === 'post' || Q.method === 'put') {
    
        Q.post = C.request.get_body(Q, SITE); // returns promise resolving with {fields, files, error} each of it is either object or null
        
    }

    // fill basic data and frontend data
    Q.data.request_id       = Q.id;
    Q.frontend.request_id   = Q.id;
    
    // add to R
    //R[Q.id] = Q;
    
    return Q;
    
}

// request handler - handles requests behind proxy
exports.handle = async function(Q, s) {

    var result = {ok: 0, id: '[i34]', data: {Q, s}, text:'', error: null};

    try {

        // handle requests only if they are not favicon
        if( !(Q.url === '/favicon.ico' && CONFIG.core.request.ignore_favicon) ) { 

            // now check if acessing by IP, if yes, adjust host and URL so that we can find site
            var adjust_by_ip    = C.request.adjust_host_and_url_by_IP(Q); // returns {from_ip, host, url}
            var host            = adjust_by_ip.host;
            var site            = C.sites.get_site_by_host(host);                                                   // get site from host 
            var site_is_valid   = (site && S[site] && S[site].config && STATE.sites.loaded[site]) ? true : false;   // check if site is valid

            if(host && site && site_is_valid) {

                Q.from_ip   = adjust_by_ip.from_ip;
                Q.true_host = Q.headers.host;
                Q.true_url  = Q.url;
                Q.host      = adjust_by_ip.host;
                Q.url       = adjust_by_ip.url;
                Q.site      = site;

                // now initialize the rquest
                Q = await C.request.init(Q);
                s = await C.response.init(s, Q); // for now just adds the Cookie interface 

                // save the request into global R 
                R.current[Q.id] = Q;

                // get route data: {route, matched, handler}
                var route = C.router.route(Q, s);

                if(route.matched.success) {

                    // save the matched params into request, if there are any
                    Q.params = route.matched.params;

                    if(route.handler) {

                        // wrap handler in a promise to enable request timeout and create the timeout if its set
                        var request_result = await C.request.execute_request_handler({Q, s, route});
                        var finish_result;

                        Q.times.handled = C.helper.now(); // ms
                        result          = request_result;
                        finish_result   = request_result.ok ? await C.request.finish_request({Q, s, request_result}) 
                                                            : await C.request.handle_error({Q, s, request_result}); // apply hooks and clean up the end of request

                    } else { result.text = '404 HANDLER NOT FOUND'; C.response.quick_error({s, code: 404, text: result.text}); }

                } else { result.text = '404 ROUTE NOT FOUND'; C.response.quick_error({s, code: 404, text: result.text}); }

            } else { result.text = '404 SITE NOT FOUND'; C.response.quick_error({s, code: 404, text: result.text}); }

        // ignore favicon requests
        } else { result.text = 'Not serving favicons.'; result.ok = 1; C.request.do_not_serve_favicon(s); }

    } catch(error) { 
        
        result = {ok: 0, id: '[e64]', data: {Q, s}, error, text: 'Failed to handle request - unknown error: '+error.message};
        C.request.handle_error({Q, s, request_result: result}); 
    
    }

    return result;

}

exports.finish_request = async function({Q, s, request_result}={}) {
    
    var result = {ok: 0, id: '', data: {}, text: '', error: null};

    try {

        var SITE = S[Q.site];

        // request was handled by a site handler, but didnt return any response, do it now - if there is any s.content or s.html, render it with code 200, otherwise return 404 Error page
        if( !(s.result && s.result.handled) ) {
            
            var content = s.content || s.html || '';
            var con_404 = C.sites.error_page('404 CONTENT NOT FOUND');
            var code    = content ? 200 : 404;
            var message = content ? '200 Request handled by site.' : '404 CONTENT NOT FOUND';

            s.result    = {code, handled: true, message};
                        
            s.writeHead(code, {'Content-Type': 'text/html'});
            s.end(content || con_404);
            
        }

        if(Q.hook === 'main' || Q.hook === 'sub') { 
            
            result = await C.request.hook({Q, s, request_result}); 
        
        /* none hook */  
        } else { 
            
            console_result = await C.logger.request.log_to_console({Q, s, request_result}); // log to console even if theres no hook
            result = {ok: 1, id: '[i38a]', text: 'Succesfully finished request without hook.', data: {logged_to_console: console_result}, error: null}; 
        
        }

        if(Q.id) delete R.current[Q.id];

    } catch(error) {

        if(Q.id) delete R.current[Q.id];

        result = {...result, id: '[e72]', error, text: 'Unknown finish request error: '+error.message, data: {site: Q.site, request_result}};

        C.logger.catch_unknown_runtime_error(result);

    }

    return result;

};

// show 500, and log and save request, returns a promise
exports.handle_error = async function({Q, s, request_result={}, type='SERVER'}={}) { // type = SERVER | PROXY
    
    var handle_result = {ok: 0, data: {}, id: '', text: '', error: null};

    try {

        request_result.id    = request_result.id     || '[e22]';
        request_result.error = request_result.error  || new Error('Unknown request error.');
        request_result.text  = request_result.text   || 'Unknown request error.';

        // send 500 ERROR page to frontend (s.end()) if no response had been sent yet
        if(!(s.result && s.result.handled)) { C.response.quick_error({s, code: 500, error: request_result.error, text: (type === 'PROXY' ? '500 PROXY ERROR' : '500 SERVER ERROR')}); }

        var SITE            = S[Q.site] || null;
            Q.hook          = 'error'; // override hook of request

        logged_to_file      = await C.logger.request.log_error({Q, s, request_result});
        logged_to_DB        = await C.request.save_to_DB({Q, s, request_result, kind: 'error'});
        logged_to_console   = await C.logger.request.log_to_console({Q, s, request_result});

        // ALWAYS remove from R
        if(Q.id) delete R.current[Q.id];

        handle_result = {ok: 1, id: '[i33]', text: 'Handled request error.', data: {steps: {logged_to_file, logged_to_DB, logged_to_console}}, error: null}

    } catch(error) {

        // just in case
        if(Q && Q.id) delete R.current[Q.id];

        var site_name   = M._.get(Q, ['site'], '--unknown--');
        handle_result   = {ok: 0, id: '[e20]', error, text: 'Failed to catch an error of a request on site '+site_name+': '+error.message, data: {site_name, request_result}};

        C.logger.catch_unknown_runtime_error(handle_result);

    }

    return handle_result;
    
}

// used in C.server.create_http()
exports.handle_http_proxy = async function(Q, s) {

    var result = {ok: 0, id: '[i65]', data: {Q, s}, text:'', error: null};

    try {

        // PROXY requests are not logged or tracked if successful (only regular behind-proxy requests are). In case of proxy request error, the error is logged in DB and file

        /* the Q object will be passed to .web() method, where it will be mutated and all data set to it in here will be wiped, however if you change url or host here,
        the change will persist, therefore DO NOT SAVE ANYTHING in Q object here that you would like to use behind proxy. simply get it again behind proxy */

        // DO NOT BOTHER with /favicon.ico requests - serve 200 and stop the handling of this request
        if(CONFIG.core.request.ignore_favicon && Q.url === '/favicon.ico') { C.request.do_not_serve_favicon(s); result.text = 'No favicons!'; return result; };

        // now check if acessing by IP, if yes, adjust host and URL so that we can find site ... only non-HTTPS sites can be accessed via IP
        var adjust_by_ip    = C.request.adjust_host_and_url_by_IP(Q); // {from_ip, host, url}
        var host            = adjust_by_ip.host;
        var site            = C.sites.get_site_by_host(host);                                                   // get site from host 
        var site_is_valid   = (site && S[site] && S[site].config && STATE.sites.loaded[site]) ? true : false;   // check if site is valid and loaded
        var is_https        = (site_is_valid && S[site]?.config.is_https);                                      // check if its https 
        var http_port       = CONFIG.core.ports.http_main_server;
console.log('PPPPPPPPPPPPPPPPPPPPPPPPP', host, site, site_is_valid);
        if(host && site && site_is_valid) {

            if(STATE.sites.enabled[site]) {
                
                result.ok = 1;

                // redirect to HTTPS if certificate is found
                if( is_https ) { s.writeHead(302, {'Location': 'https://' + Q.headers.host + Q.url, 'Method': Q.method}); s.end(); result.text = 'Redirected to HTTPS.'; return result; }

                // site is not https or IO - proxy to real http server
                // .web() method doesnt return anything         
                console.log('DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', 'http://' + Q.headers.host + ':' + http_port);                                            // ... do not add the Q.url, the .web() methods adds it automatically
                PROCESSES.PROXY_SERVER.web(Q, s, { target: 'http://' + Q.headers.host + ':' + http_port});  // HERE ... this sends the request to C.server.create_http() ... the line with "PROCESSES.HTTP_SERVER = M.http.createServer..."  

            } else { C.response.quick_error({s, code: 418, text: '418 SITE DISABLED'}); result.text = 'Site disabled'; }

        } else { C.response.quick_error({s, code: 404, text: '404 SITE NOT FOUND'}); result.text = 'Invalid host or site'; }

    } catch(error) { 

        result = {ok: 0, id: '[e93]', data: {Q, s}, error, text: 'Failed to handle request - unknown error: '+error.message};
        C.request.handle_error({Q, s, type: 'PROXY', request_result: result}); 
    
    }

    return result;

}

// used in C.server.create_https()
exports.handle_https_proxy = async function(Q, s) {

    var result = {ok: 0, id: '[i66]', data: {Q, s}, text:'', error: null};

    try {

        // PROXY requests are not logged or tracked if successful (only regular behind-proxy requests are). In case of proxy request error, the error is logged in DB and file

        /* the Q object will be passed to .web() method, where it will be mutated and all data set to it in here will be wiped, however if you change url or host here,
        the change will persist, therefore DO NOT SAVE ANYTHING in Q object here that you would like to use behind proxy. simply get it again behind proxy */

        // DO NOT BOTHER with /favicon.ico requests - serve 200 and stop the handling of this request
        if(CONFIG.core.request.ignore_favicon && Q.url === '/favicon.ico') { C.request.do_not_serve_favicon(s); result.text = 'No favicons!'; return result; };

        // now check if acessing by IP, if yes, adjust host and URL so that we can find site
        var adjust_by_ip    = C.request.adjust_host_and_url_by_IP(Q);
        var host            = adjust_by_ip.host;
        var site            = C.sites.get_site_by_host(host);                                                   // get site from host 
        var site_is_valid   = (site && S[site] && S[site].config && STATE.sites.loaded[site]) ? true : false;   // check if site is valid and loaded
        var is_https        = (site_is_valid && S[site]?.config.is_https);                                      // check if its https 

        if(host && site && site_is_valid) {

            if(STATE.sites.enabled[site]) {

                result.ok = 1;

                // redirect to HTTP if no certificate is found
                if( !is_https ) { s.writeHead(302, {'Location': 'http://' + Q.headers.host + Q.url, 'Method': Q.method}); s.end(); result.text = 'Redirected to HTTP.'; return result; }

                let SITE = S[site];
                //let port = parseInt(SITE.config.port); // DEPRECATED - EACH HTTPS SITE HAS TO HAVE ITS OWN HTTPS PORT
                let port = CONFIG.core.ports.https_main_server;
                let certs= STATE.certificates.https;

                if(port) {

                    // site exists and is https - proxy to real https server
                    PROCESSES.PROXY_SERVER_SECURE.web(Q, s,    { 
                                                                    ssl:    certs,                                      // in the .web() method, ssl gets mutated .. cannot use M._.cloneDeep() -... HTTPS sites stop working
                                                                    target: 'https://' + Q.headers.host + ':' + port,   // ... do not add the Q.url, the .web() methods adds it automatically
                                                                    secure: false
                                                                }); // ... this sends the request to the place, where M.https.createServer().listen() is called for given site

                } else { throw new Error('[e79] Invalid HTTPS port.'); }

            } else { C.response.quick_error({s, code: 418, text: '418 SITE DISABLED'}); result.text = 'Site disabled'; }
            
        } else { C.response.quick_error({s, code: 404, text: '404 SITE NOT FOUND'}); result.text = 'Invalid host or site'; }

    } catch(error) { 

        result = {ok: 0, id: '[e94]', data: {Q, s}, error, text: 'Failed to handle request - unknown error: '+error.message};
        C.request.handle_error({Q, s, type: 'PROXY', request_result: result}); 
    
    }

    return result;

}

exports.save_to_DB = async function({Q, s, request_result={}, kind=''}) {
  
    var db_result = {ok: 0, data: {}, id: '[i31]', text: '', error: null};

    try {

        var SITE        = S[Q.site]     || null; 
        var site_name   = SITE?.name    || '';
        var hook        = Q.hook        || 'error';
        var log_type    = C.request.get_log_type(site_name, hook, 'db');
        var log         = {kind};
            s.result    = s.result || '';

        // check if request was initialized (in case of early error)
        if(Q.id && SITE) {

            if(log_type === 'full') {

                // put together things that are to be saved in DB
                log.id          = Q.id;
                log.hook        = Q.hook;
                log.response    = s.result;
                log.site        = SITE.name;
                log.safe        = Q.safe || {};
                log.start_time  = Q.times.start;
                log.method      = Q.method;
                log.protocol    = Q.protocol;
                log.host        = Q.true_host;
                log.url         = Q.true_url;
                log.client_ip   = Q.client_ip;
                log.from_ip     = Q.from_ip;
                log.user_agent  = Q.user_agent.ua;
                log.device      = M._.get(Q.user_agent, 'device.size', '');
                log.is_crawler  = Q.is_crawler;
                log.query       = Q.query;
                log.params      = Q.params;
                log.cookies     = Q.cookies;
                log.result      = request_result;
                log.time        = Q.times.handled - Q.times.start + 'ms';
                //log.sub_requests= []; // sub_requests are added automatically in the DB query of adding a sub_request (the ".default([])" )
                
            } else if (log_type === 'basic') {
            
                log.id          = Q.id;
                log.hook        = Q.hook;
                log.site        = SITE.name;
                log.safe        = Q.safe || {};
                log.response    = s.result.code;
                log.start_time  = Q.times.start;
                log.method      = Q.method;
                log.protocol    = Q.protocol;
                log.host        = Q.true_host;
                log.url         = Q.true_url;
                log.client_ip   = Q.client_ip;
                log.user_agent  = Q.user_agent.ua;

            } else if (log_type === 'bare') {
            
                log.id          = Q.id; // start_time is in ID
                log.response    = s.result.code || '';
                log.method      = Q.method;
                log.protocol    = Q.protocol;
                log.site        = SITE.name;
                log.host        = Q.true_host;
                log.url         = Q.true_url;
                log.safe        = Q.safe || {}; // used to save logged in user's id for socket authorization
                
            }/* else if (log_type === 'none') { // deprecated 
            
                log.id          = Q.id; // start_time is in ID
                log.response    = s.result.code || '';
                
            }*/

        // request was not initialized (in handle_error)
        } else {

            if(log_type === 'full' || log_type === 'basic') {

                // put together things that are to be saved in DB
                log.response    = s.result;
                log.site        = site_name || '';
                log.start_time  = M.moment().format('x');
                log.method      = Q.method;
                log.host        = Q.headers.host;
                log.url         = Q.url;
                log.client_ip   = Q.headers['x-forwarded-for'] || Q.connection.remoteAddress;
                log.user_agent  = Q.headers['user-agent'];
                log.result      = request_result;
                
            } else if (log_type === 'bare') {
            
                log.start_time  = M.moment().format('x');
                log.site        = site_name || '';
                log.response    = s.result;
                log.host        = Q.headers.host;
                log.url         = Q.url;
                
            } /*else if (log_type === 'none') { // deprecated 
            
                log.start_time  = M.moment().format('x');
                log.response    = s.result;
                
            }*/

        }

        if(log_type && log_type !== 'none') {

            if(log && log.kind) {

                // regular requests save as usual 
                if(hook === 'main' || hook === 'error') { // hook=none does not execute this function

                    var insert = await DB.SET(DBP, 'requests', log);

                    if(insert)  { db_result = {...db_result, ok: 1, text: 'Successfully logged log into DB.', data: {insert}}; }
                    else        { db_result = {...db_result, ok: 0, text: 'Failed to log into DB - DB error.', data: {insert}}; }

                // sub_requests save into the array of sub_requests of the parent request
                } else if (hook === 'sub' && Q.parent_request_id) {

                    delete log.type; // not needed in nested sub_requests

                    var change = await DB.CHANGE(DBP, 'requests', {query: function(DBX) { DBX = DBX.get(Q.parent_request_id).update({sub_requests: DB.row('sub_requests').default([]).append(log)}); return DBX;}}, log);

                    if(change.updated)  { db_result = {...db_result, ok: 1, text: 'Successfully appended sub_request to log.', data: {change}}; }
                    else                { db_result = {...db_result, ok: 0, text: 'Failed to append sub_request log into DB - DB error.', data: {change}}; }

                }

            } else { db_result = {...db_result, ok: 1, text: 'Invalid log or log kind (access x error), nothing was logged in DB.'}; }

        } else { db_result = {...db_result, ok: 1, text: 'Not to be logged in DB.'}; }

    } catch(error) { db_result = {ok: 0, id:'[e64]', data: {}, error, text: 'Failed to save request log to DB - unknown error: '+error.message}; }

    return db_result;
    
}

// return a reseted Q.data object containing needed data from previous handler (used in shallow redirects)
exports.set_previous_handler_data = function(previous_data = {}) {
    
    return {previous: previous_data, B: {}, js_data: {}, html: {}};
    
}

exports.do_not_serve_favicon = function(s) {

    s.writeHead(200, {'Content-Type': 'text/plain'});
    s.result = {code: 200, handled: true, message: 'NO ICON SERVED'};
    s.end();

}

// returns bool
exports.is_from_IP = function(host) {

    var IP_hosts = {'127.0.0.1': 1, 'localhost': 1};
        IP_hosts[CONFIG.core.server_ip] = 1; // add the IP of this machine

    return IP_hosts[host] ? true : false;

}

exports.adjust_host_and_url_by_IP = function(Q) {

    var IP_hosts        = {'127.0.0.1': 1, 'localhost': 1};
        IP_hosts[CONFIG.core.server_ip] = 1; // add the IP of this machine

    var result          = {from_ip: false, host: Q.headers.host, url: Q.url};
        result.from_ip  = IP_hosts[Q.headers.host] ? true : false;

    // if site is being accessed via IP, adjust Q.host and Q.url (for example:         VIA HOST - http://my_site.io/hello => host = "my_site.io"; url = "/hello"
    //                                                                          --- OR VIA IP --- http://12.34.56.78/my_site.io/hello => true_host = "12.34.56.78", true_url="/my_site.io/hello", host = "my_site.io"; url = "/hello")
    if( result.from_ip ) {

        // get site from url
        var url_split   = Q.url.split('/');
            result.host = url_split[1];     // overwrite host from server IP to site name (first part of URI)

        url_split.shift(); url_split.shift(); // adjust url - remove site from url (and '') (https://127.0.0.1/opajda/uvod -> url = "/uvod")

        result.url = '/' + url_split.join('/');
        
    }

    return result; // {from_ip, host, url}

}

exports.get_log_type = function(site_name, hook='', output='') {

    var SITE            = S[site_name] || null;
    var outputs         = {file: 'file', db: 'db', console: 'console'};
        output          = outputs[output] || 'unknown';
    var log_types       = CONFIG.core.logs.request.types; // full, basic, bare, none
    var core_log_type   = M._.get(CONFIG, ['core', 'logs', 'request', 'by_hook', hook, output], '');
    var site_log_type   = M._.get(SITE, ['config', 'logs', 'request', 'by_hook', hook, output], ''); // should be a {file, db, console} object

    var log_types_      = {}; // {full: 'full', basic: 'basic', ...}

    log_types.forEach((lt)=>{ log_types_[lt]=lt; });

    var log_type        = log_types_[site_log_type] || log_types_[core_log_type] || 'none';

    return log_type;

}

exports.parse_querystring = function(url='') {

    var query = {};

    if(url.split) {

        // remove everything before the first "?" including it
        var url_split = url.split('?');
            url_split.shift();

        var querystring = url_split.join('?');

        if(querystring) {

            var querystring_params = new URLSearchParams(querystring);

            for([key, value] of querystring_params) { query[key] = value; }

        }

    }

    return query;

}

exports.parse_cookies = function(cookie_string='', code_geass='') {

    var cookies = {};

    if(cookie_string && code_geass) {
    
        var cookie_split, cookie_name, cookie_value;
        var cookies_split = cookie_string.split(';');
        
        cookies_split.forEach((cookie) => {
            
            cookie          = decodeURI(cookie);
            cookie_split    = cookie.split('=');
            cookie_name     = cookie_split[0].trim();
            
            // in case site does not exist OR cookie is not encrypted, fall back to normal cookie value
            try {
            
                cookie_value = C.ciphers.decrypt_sync(cookie_split[1].trim(), code_geass);
                
            } catch(e) { cookie_value = ''; }
            
            cookies[cookie_name] = cookie_value;
            
        });
        
    }

    return cookies;

}

// determine request language - default --> by country --> by negotiator (request headers) --> by cookie --> by query (l, lang, language)
exports.get_language = function(Q, SITE) {

    var languages   = SITE.config.languages || {};
    var supported   = languages.supported || [];
    var negotiator  = new M.negotiator(Q);
    var browser_l   = negotiator.language(supported);
    var language    = false;

    // BY COUNTRY
    if(Q.country && languages.by_country) language = languages.by_country[Q.country] || language;

    // BY BROWSER
    if(browser_l) language = browser_l;

    // BY COOKIE - overwrites country and browser
    if(Q.cookies.language && supported.includes(Q.cookies.language)) language = Q.cookies.language;

    // BY QUERY
    if(Q.query['l']         && supported.includes(Q.query['l']))        language = Q.query['l'];
    if(Q.query['lang']      && supported.includes(Q.query['lang']))     language = Q.query['lang'];
    if(Q.query['language']  && supported.includes(Q.query['language'])) language = Q.query['language'];

    if(language && supported.includes(language)) {

        // everything ok, do nothing

    } else { language = languages.default; }

    return language;

}

exports.get_body = async function(Q, SITE) {

    // structure to resolve post promise with, promise will only be resolved (even with bad user input), if promise is rejected, there is an error in code
    var request_body = {fields: null, files: null, error: null}; // fields and files are an objects
    
    try {

        // FILE & FORM UPLOAD - request POST DATA might contain files, handle them
        if(Q.headers['content-type'].includes('multipart/form-data')) {

            // decide whether to take some config from site (if exsits) or from core by default
            var site_config = M._.get(SITE, 'config.files', {});
            var core_config = CONFIG.core.files || {};
            var max_size    = site_config.max_size || core_config.max_size;
            var upload_dir  = site_config.temp_dir || core_config.temp_dir;
                upload_dir  =    M.path.join(CONFIG.core.root, upload_dir); 
            
            // file parser
            var fp_options  =   {   // mostly default values, just to illustrate they can be changed
                                    encoding:       'utf8',
                                    autoFields:     true,
                                    autoFiles:      true,           // load all files to temp dir
                                    maxFields:      1000,
                                    maxFieldsSize:  10 * B.MB, // 2MBs in bytes - max size of all form fields (not files)
                                    maxFilesSize:   max_size* B.MB, // in bytes, limits the total bytes accepted for all files combined. The default is Infinity. If this value is exceeded, an error event is emitted.
                                    uploadDir:      upload_dir,     // relevant only if autoFiles, fs.rename() to move. Defaults to os.tmpDir().
                                };
            
            var parser = new M.multiparty.Form(fp_options);

            var parse_promise = new Promise(function(resolve, reject) {
            
                parser.parse(Q, (err, fields, files) => {

                    try {
                    
                        var parsed  = {files: null, fields: null, error: null};

                        parsed.error  = err ? err : null;
                        parsed.fields = M._.isEmpty(fields) ? null : fields;
                        parsed.files  = M._.isEmpty(files) ? null : files;
                        
                        // if there is onle on value for a name in a form, tranform i from array to the value
                        if(parsed.fields) M._.forIn(parsed.fields, (val, key) => { if(val.length === 1) parsed.fields[key] = val[0]; });
                        if(parsed.files)  M._.forIn(parsed.files, (val, key) => { if(val.length === 1) parsed.files[key] = val[0]; });
                        
                        // fields:  {<name>: [<val1>, <val2>, ...], <name2>: [<val1>, <val2>], ...}
                        // files:   {<name>: [ <file_obj_1>, <file_obj_2>, ...], <name2>: [<file_obj, ...], ...}
                        // file_obj =   {
                        //                  fieldName:          '', // same as <name>
                        //                  originalFilename:   '',
                        //                  path:               '', // absolute path to uploaded file
                        //                  headers:            {filename: '', 'content-type': '/image/jpeg'}, // http headers of file
                        //                  size:               123,// in bytes
                        //              

                        resolve(parsed);

                    } catch(error) { reject(error); }
                    
                });

            }).catch(function(error) { return Promise.resolve({files: null, fields: null, error}); });

            request_body = await parse_promise;

        // normal POST request, no files
        } else {

            var parse_promise = new Promise(function(resolve, reject) {
            
                var parsed              = {files: null, fields: null, error: null};
                var request_body_chunks = [];

                Q.on('error',(err) =>  { delete request_body_chunks; reject(err); });
                Q.on('data', (chunk) =>  { request_body_chunks.push(chunk); });
                Q.on('end',  () =>  { 
                    
                    let raw_fields = M.qs.parse(Buffer.concat(request_body_chunks).toString()); // put together buffered data, stringify them and parse them to object
                    
                    let fields = {};
                    
                    // go through all fields and transform this.lala.inputs into object
                    M._.forIn(raw_fields, (field_value, field_name) => {
                        
                        let field_name_split    = field_name.split('.');
                        let last                = field_name_split.length - 1;
                        
                        // and transfrom 'some.input.lala': 'value' into object
                        field_name_split.reduce((fields, value, index) => {
                            
                            fields[value] = (last === index) ? field_value : (fields[value] || {});

                            return fields[value];
                            
                        }, fields);

                    });

                    parsed.fields = fields;
                    
                    resolve(parsed); 
                
                });

            }).catch(function(error) { return Promise.resolve({files: null, fields: null, error}); });

            request_body = await parse_promise;
            
        }

    } catch(error) { request_body.error = error; }

    return request_body;

}

exports.execute_request_handler = async function({Q, s, route}={}) {

    var request_result = {ok: 0, id: '[i35]', data: {}, text: '', error: null};

    try {

        var SITE = S[Q.site];

        // wrap handler in a promise to enable request timeout, this promise must ALWAYS resolve with handler_result object
        var handler_promise = new Promise(function(resolve, reject) {

            var handler_result  = {ok: 0, id: '[i36]', data: {}, text: '', error: null};
            var timeout         = (SITE.config.request && SITE.config.request.timeout > -1) ? SITE.config.request.timeout : CONFIG.core.request.timeout; // in seconds | first try getting site , then core if not set, if 0, no timeout

            // first set request timeout, if its set
            if(timeout) { setTimeout(() => {
                
                if( !(s.result && s.result.handled) ) C.response.quick_error({s, code: 408, text: '408 REQUEST TIMEOUT'});

                handler_result = {...handler_result, ok: 1, text: '408 REQUEST TIMEOUT'};
                
                resolve(handler_result);
                    
            }, timeout*1000); }

            // then run the handler itself - it should resolve with {ok: 1} OR {ok: 0, error: <Error>} ... it will be racing against the timeout
            route.handler({Q, s, SITE})
                .then(function(h_result) { 
                    
                    h_result        = h_result || {ok: 1, data: {h_result}}; // handlers might return undefined (in which case everythings ok)
                    handler_result  = Object.assign(handler_result, h_result); // merge  the default result with the actual result
                    resolve(handler_result);

                }).catch(function(h_error) {

                    handler_result = {...handler_result, id: '[e66]', ok: 0, error: h_error, text: 'Unknown request handler error: '+h_error.message}; 
                    resolve(handler_result);

                });

        }).catch(function(error) { return Promise.resolve({id: '[e67]', ok: 0, error, text: 'Unknown request handler error: '+error.message}); });

        var request_result = await handler_promise;

    } catch(error) { request_result = {ok: 0, id: '[e68]', data: {}, error, text: 'Unknown execute_request_handler: '+error.message}; }

    return request_result;

}

exports.hook = async function({Q, s, request_result}={}) {

    var result = {ok: 0, id: '[i38]', data: {}, text: '', error: null};

    try {

        var SITE = S[Q.site];

        // after succesfull send to client (doesnt mean it has arrived, we just sent it), MUST resolve with {ok: 0, ...}
        var finish_promise = new Promise((resolve, reject) => {

            s.on('finish', async function() {

                try {
                    
                    Q.times.sent_response   = C.helper.now(); 
                    var logged_to_file      = await C.logger.request.log_access({Q, s, request_result});
                    var logged_to_DB        = await C.request.save_to_DB({Q, s, request_result, kind: 'access'});
                    var logged_to_console   = await C.logger.request.log_to_console({Q, s, request_result});

                    result = {...result, ok: 1, text: 'Succesfully finished hook.', data: {logged_to_file, logged_to_DB, logged_to_console}};

                    resolve(result);

                } catch(error) { reject(error); } 

            });

            // request finish timeout (to prevent from lingering failed requests)
            var timeout = (SITE.config.request && SITE.config.request.timeout > -1) ? SITE.config.request.timeout : CONFIG.core.request.timeout;

            if(timeout) {

                setTimeout(() => {

                    reject(new Error('[e69.2] Request finish - hook timeout.'));

                }, timeout*1000);

            }

        }).catch(function(error) { return {ok: 0, id: '[e69.1]', error, data: {}, text: 'Failed to hook request - unknown error: '+error.message}; });

        result = await finish_promise;

    } catch(error) { result = {...result, id: '[e69]', error, text: 'Failed to hook request - unknown error: '+error.message}; }

    return result;

}