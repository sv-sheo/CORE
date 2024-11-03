
exports.index = async function({Q, s, SITE}) {

    SITE.auth.get_admin(Q, s);                  // fills Q.data.admin       false if no admin
    SITE.auth.kick_not_logged_in(Q, s);             // kick to admin page (result) if someone is logged in
    SITE.other.pre.get_environment(Q, s, SITE);

    Q.safe              = {user: Q.data.admin.id, site: SITE.name, client_ip: Q.client_ip};  // init Q safe and save data needed to authorize socket connections

    Q.data.html         = {head: {title: 'S-CORE ADMIN'}};

    Q.data.workers      = CONFIG.core.workers;
    Q.data.workers_arr  = Array.from({length: Q.data.workers}, (v, i) => (i+1)); // -->returns [1,2,...] 
    Q.data.sub_servers  = SITE.other.get_sub_servers();

    Q.data.socket       = SITE.other.pre.get_socket_data(Q, SITE);
    Q.data.PRELOAD_DATA = SITE.other.pre.get_preload_data(Q, SITE);
    Q.frontend          = Object.assign(Q.frontend, Q.data.PRELOAD_DATA);

    Q.data.js_data      = JSON.stringify(Q.frontend); // IMPORTANT      ... M.tosource(Q.frontend);

    Q.data.html = {};
    Q.data.html.sections = {};
    Q.data.html.sections.server         = SITE.views.sections.server(Q.data);
    Q.data.html.sections.processes      = SITE.views.sections.processes(Q.data);
    Q.data.html.sections.sub_servers    = SITE.views.sections.sub_servers(Q.data);
    Q.data.html.sections.sites          = SITE.views.sections.sites(Q.data);
    Q.data.html.sections.sockets        = SITE.views.sections.sockets(Q.data);
    
    s.html = SITE.views.index(Q.data);

    return {ok: 1};

    
}

exports.signal = async function({Q, s, SITE}) {

    SITE.auth.get_admin(Q, s);                  // fills Q.data.admin       false if no admin
    SITE.auth.kick_not_logged_in(Q, s);             // kick to admin page (result) if someone is logged in
    SITE.other.pre.get_environment(Q, s, SITE);

    Q.safe              = {user: Q.data.admin.id, site: SITE.name, client_ip: Q.client_ip};  // init Q safe and save data needed to authorize socket connections

    Q.data.html         = {head: {title: 'S-CORE ADMIN'}};
    Q.data.socket       = SITE.other.pre.get_socket_data(Q, SITE);
    Q.data.PRELOAD_DATA = SITE.other.pre.get_preload_data(Q, SITE);
    Q.frontend          = Object.assign(Q.frontend, Q.data.PRELOAD_DATA);

    Q.data.js_data      = JSON.stringify(Q.frontend); // IMPORTANT      ... M.tosource(Q.frontend);

    s.html = SITE.views.signal(Q.data);

    return {ok: 1};

    
}


exports.ui_overview = async function({Q, s, SITE}) {
    
    // required
    Q.data.js_data      = JSON.stringify(Q.fronetnd); // IMPORTANT
    Q.data.html         = {head: {title: 'S-CORE - UI overview'}};
    Q.data.socket       = SITE.config.socket || {};

    Q.data.webpack_url = SITE.config.ENVIRONMENT === 'DEVELOPMENT' ? 'http://localhost:'+SITE.config.webpack_dev_port+'/' : Q.data.HOST+'files/get/build/production/'; 

    Q.data.base_url     = Q.base_url;

    Q.data.PRELOAD_DATA = SITE.other.pre.get_preload_data(Q, SITE);
    Q.data.PRELOAD_DATA = M.tosource(Q.data.PRELOAD_DATA);

    var wait = new Promise(function(resolve, reject) { setTimeout(resolve, 10000); });
    var wwww = await wait;

    s.html = SITE.views.other.ui_overview(Q.data);

    return {ok: 1};

    
}

exports.handlebars_reload = async function({Q, s, SITE}) {

    var test = await C.process.EXECUTE_ON_MASTER({action: 'process.handlers.master.execute_on_all_workers', 
                                                    data: {message_for_workers: {action: 'process.handlers.worker.execute_site_method',
                                                            data: {site: SITE.name, method: 'other.reload_site', data: {}}}}});
    

    //console.log(test.resolved.resolved.data.results[1].resolved.data.message);
    Q.hook = 'none';
    
    var content = 'succesfully reloaded handlers and handlebars views<br>'+M.util.inspect(test, showHidden=true, depth=20);
    s.result    = {code: 200, handled: true, message: '200 Request handled by site.'};
                    
    s.writeHead(200, {'Content-Type': 'text/plain'});
    s.end(content);
    
    return {ok: 1};
    
}