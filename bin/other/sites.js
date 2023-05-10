
class SITE_CONSTRUCTOR {

    constructor({config_dir=''}={}) {

        this.config_dir = config_dir || './config'; // directory of config files (index.js, .conf), relative to site root

        this.load = C.sites.CONSTRUCTOR_site_load_method.bind(this);

        // can be overridden in index.js file of site, customizes loading of the site, is executed after CONSTRUCTOR.load() resolves and must pass its result in the resolve
        this.middleware = async function() {};

    }

}

// sort of a site constructor, returns an object with async load method, which creates SITE object which will be stored in S (global sites repository), used in index.js of SITE
exports.CONSTRUCTOR = SITE_CONSTRUCTOR;

exports.CONSTRUCTOR_site_load_method = async function({name, path, log=false}={}) {

    var SITE    = {}; // SITE OBJECT - will be saved in S[<site_name>]
    var result  = {ok: 0, data: {}, errors: {}, steps: {}};
// TO DO // REFACTOR HERE ... stop putting stuff from BIN directly to SITE .... -> make SITE.bin object ---> refactor sites
    try {

        let load_args   = {site: name, site_root: path, log, config: {/* defined after config load (below) */}};
        let config      = await C.sites.load_site_config({...load_args, config_dir: this.config_dir});

        if(config.ok) {

            load_args.config = config.data;

            let BIN         = await C.sites.load_site_bin       (load_args);
            let handlers    = await C.sites.load_site_handlers  (load_args);
            let views       = await C.sites.load_site_views     (load_args);
            let site_DB     = await C.sites.connect_site_to_DB  (load_args);
            let socket      = await C.socket.bind_site_namespaces({...load_args, SITE_BIN: BIN.data});// https://socket.io/docs/v4/namespaces/     ... old ({...load_args, SITE_BIN: BIN.data});
            let mailer      = await C.mail.setup_site           (load_args); // inserts the mailer (mail transporter) into STATE.mailers[site_name] ... enables use of C.mail.send(site_name, options)
            let middleware  = {ok: 1, data: {}, text: 'No middleware applied.', error: null}; 

            SITE            = {...SITE, ...BIN.data} // merge BIN and SITE - contents of BIN will be directly available from S[<site_name] (.. or from SITE inside a request)

            SITE.name       = name;
            SITE.root       = path;
            SITE.config     = config.data;
            SITE.handlers   = handlers.data;
            SITE.views      = views.data;
            SITE.DB         = site_DB.data; // {connection: <>, shadow: {}, NAME: '', tables: int, connected: 1}
            SITE.SOCKET     = socket.data?.SOCKET || null; // use like this: SITE.SOCKET.MAIN.on(...) = SITE.SOCKET.IO.of('/core') 
            SITE.mailer     = mailer.data?.mailer || null; // you can use SITE.mailer.sendMail(options) instead of C.mail.send(site_name, options)
            SITE.STATE      = SITE.other?.initial_state ? structuredClone(SITE.other.initial_state) : {};

            // base chunk of site loaded, now its time for user customization
            // run custom code (site specific) code after main site code has been loaded
            middleware      = await C.sites.load_site_middleware(SITE);

            var step_results= C.sites.format_site_load_step_results({BIN, config, handlers, views, DB: site_DB, middleware, mailer, socket});

            result.ok       = step_results.ok;
            result.text     = 'Site '+name+' successfully loaded on worker '+C.server.worker_id+'.';
            result.data     = {SITE, load_on_this_worker: 1};
            result.steps    = step_results.steps;
            result.errors   = step_results.errors;

        } else { result.errors.config = config; }

    } catch(error) { result.errors.load = {id: '[e21]', text: 'Failed to load site '+name.toString()+' - unknown error: '+error.message, error: error}; }

    return result;

};

// fill global.S
exports.load_all = async function(previous_step={}) {

    if(previous_step.ok) {

        var result  = {ok: 0, id:'[i22]', text:'', data: {previous_step, sites:[]}, error: null};

        try {

            var site_promises = CONFIG.core.sites.to_load.map(function(site) { return C.sites.load_site({name: site, log: true}); });

            // need to resolve even if there is an error (one site couldnt be loaded, so what ?)
            var results = await C.promise.parallel(site_promises);
            var count   = 0;
            var t_count = site_promises.length; // total count of sites to load

            M._.forEach(results, function(res) { if(res.resolved !== 'ROOT') { if(res.resolved && res.resolved.ok) {count++; result.data.sites.push(res.resolved.data.SITE.name) } } });

            result.ok       = 1;
            result.text     = count ? 'Successfully loaded '+count+'/'+t_count+' sites ('+result.data.sites.join(',')+').' : 'No sites ('+count+'/'+t_count+') were loaded on worker '+M.cluster.worker.id+'.';

            C.logger.bootup_step(result);

        } catch(error) {  
            
            result = {...result, id: '[e7]', text: 'Failed to load sites - unknown error: '+error.message, error};
            C.logger.bootup_step({id: result.id, err_text: result.text, err: error});
        
        }

        return result;

    } else { return previous_step; }
    
};

// load site on core bootup or during runtime
exports.load_site = async function({name='', path='', log=false}) { // name is required, path = path to the root of site - it is optional (if no path is defined, default SITES path will be used)

    var result  = {ok: 0, data: {}, errors: {}};

    try {

        // basic validation - site name must be unique, non-empty string, path must be a non-empty string
        if(name && M._.isString(name) && !S[name] && M._.isString(path)) {

                path    = path || M.path.join(CONFIG.core.root, CONFIG.core.sites.path, name); // if path is not specified, use default path of SITES/<site_name> (defined in config)
            var proof   = await C.sites.prove_site({name, path});  // check if index.js of site exists, if yes, return {ok: 1, name:'', path: '', stats: {}}, if not return {ok: 0, error}

            if(proof.ok) {

                name = proof.data.name;
                path = proof.data.path; // root of site

                site = require(M.path.join(path, 'index.js')); // require index.js of site ... must return object with .load() method

                result = await site.load({name, path, log}) // site loads itself, resolves with {ok: 1, SITE: {}, steps: {}, error: {id, text, error}}

                // site loaded successfully, save the result to the globals
                if(result.ok) {

                    if(result.data.load_on_this_worker) {

                        // final check for race-condition in case of 2 sites of the same name being loaded at the same time
                        if( !S[name] ) {

                            let now = C.helper.now();
                        
                            S[name]         = result.data.SITE;         // save instance of SITE into global site repository S
                            //CONFIG[name]    = S[name].config;         // DEPRECATED (now stored only in SITE.config) - save config of site into global CONFIG object
                            //DBS[name]       = S[name].DB.CONNECTION;  // DEPRECATED (now stored only in SITE.DB.CONNECTION)

                            STATE.sites.loaded[name]    = now;
                            S[name].STATE.loaded        = now;

                            STATE.sites.enabled[name]   = 1;
                            S[name].STATE.enabled       = 1;

                            if(result.data.SITE?.DB && result.data.SITE?.DB?.CONNECTED && result.data.SITE?.DB?.READY) {

                                STATE.sites.connected[name] = 1;
                                S[name].STATE.connected     = 1;

                            }

                        } else { 
                            
                            result.ok = 0; 
                            result.errors.after_load = {id: '[e56]', text: 'Failed to load site '+name.toString()+' - site with this name has already been loaded.', error: new Error('') };
                        
                            if(result.data?.SITE?.DB?.CONNECTION) result.data.SITE.DB.CONNECTION.close(); // close DB connection in case of duplicit site load

                        }

                    }

                } // errors are generated during site.load()

            } else { result.errors.prove = proof; } // result of C.sites.prove_site()

        } else { result.errors.pre_load = {id: '[e21]', text: 'Failed to load site '+name.toString()+' - invalid or not unique site name or path.', error: new Error('') };}

    } catch(error) { result.errors.pre_load = {id: '[e14]', text: 'Site ['+name.toString()+'] failed to load - unknown error: '+error.message, error: error}; }

    if( log ) M._.forEach(result.errors, function(r_error, step) { C.logger.bootup_step({id: (r_error.id || '[e55]'), site: name.toString(), text: '['+step+'] '+(r_error.text || 'Unknown site load error: '+M._.get(r_error, 'error.message')), err: r_error.error}); });

    return result;

}

exports.load_web_admin = async function(previous_step={}) {

    if(previous_step.ok) {

        var result = {ok: 1, data: {previous_step}, id: '[i27]', text: '', error: null};

        try {

            if(CONFIG.core.admin.on) {

                var admin_path = M.path.resolve(CONFIG.core.root, CONFIG.core.admin.path);

                result = await C.sites.load_site({name: CONFIG.core.admin.name, path: admin_path, log: true});

                // remove non-cloneable data so that result can be sent between processes during worker_init
                var SITE_plucked    = M._.pick(result.data.SITE, ['name', 'root', 'config']);
                var load_otw        = result.data.load_on_this_worker;
                result.data = {SITE: SITE_plucked, load_on_this_worker: load_otw};
                

                result.id                   = '[i27]';
                result.data.previous_step   = previous_step;

            } else { result.text = 'Web admin site ['+CONFIG.core.admin.name+'] is turned off.'; }

        } catch(error) { result = {...result, ok: 0, error, text: 'Failed to load web admin site - unknown error: '+error.message}; }

        return result;

    } else { return previous_step; }

}

// synchronous, loop throuh all loaded sites and return one with matching host, false if no site found, used in request handlers
exports.get_site_by_host = function(host = 'non.existent') {
    
    var result_site_name    = false;
    var site_found          = false;

    M._.forEach(S, function(site, site_name) {

        if( !site_found ) {

            site_found          = S?.[site_name]?.config?.hosts?.[host] ? true : false; // god bless optional chaining
            result_site_name    = site_found ? (S?.[site_name]?.config?.name || false) : false;

        }
        
    });
    
    return result_site_name; // = 'site_name' or false
    
}

// SITE functions

// check if index.js of site exists, if yes, return {ok: 1, name:'', path: ''}, if not return {ok: 0}
exports.prove_site = async function({name='', path=''}) {

    var result = {ok: 0, data: {}, id: '[e8]', text: '', error: null};

    try {

            path        = path || M.path.join(CONFIG.core.sites.path, name); // if no path is specified, try looking in default SITES directory (specified in CORE config)
        var index_path  = M.path.join(path, 'index.js');

        var stats       = await M.fs.stat_async(index_path); // stats object https://nodejs.org/api/fs.html#class-fsstats
        var site_path   = M.path.resolve(M.path.dirname(index_path));

        if(stats && stats.size) {

            result.ok   = 1;
            result.data = {name, path: site_path, stats };

        } else { 
            
            result.text         = 'Site ['+name.toString()+'] failed to load - site could not be found at path ['+path.toString()+']'; 
            result.data.stats   = stats; 
            result.error        = new Error(result.text); 
        
        }

    } catch(error) { result.error = error; result.text = 'Site ['+name.toString()+'] failed to load - site could not be found at path ['+path.toString()+']: '+error.message; }

    return result;

};

// back to async, MERGES core config and site config into CONFIG[site] and SITE.config
exports.load_site_config = async function({site='', site_root='', config_dir='', log = false}={}) {

    var result = {ok: 0, data: {}, id: '[i17]', text: 'Successfully loaded config.', error: null};

    try {

        var config_path             = M.path.join(site_root, config_dir);
        var site_conf_file_buffer   = await M.fs.read_file_async(M.path.join(config_path, '.conf'));    // resolves with contents of the .env file (of site) in the form of a buffer
        var site_conf               = M.dotenv.parse(site_conf_file_buffer);                            // get contents of .conf 

        // now get site config - a function to format, adjust and amend .conf
        var config_index = M.path.join(config_path, 'index.js');

        delete require.cache[require.resolve(config_index)]; // remove from cache - for updating purposes

        var config  = require(config_index); // returns a function
            config  = config(site_conf);
            config  = Object.assign({}, CONFIG.core, config, {root: site_root}); // merge with CORE config, add site root path and save the result into final config object

        result.ok   = 1;
        result.data = config;

        if(log) C.logger.bootup_step({id: result.id, site, text: 'Site '+site+': '+result.text});

    } catch(error) { result.id = '[e48]'; result.text = 'Failed to load config: '+error.message; result.error = error; }

    return result;
    
};

exports.load_site_bin = async function({site='', site_root='', config={}, log=false}={}) {

    var result = {ok: 0, data: {}, error: null, id: '', text: ''};

    try {

        var bin_dir = config?.dir?.bin || './bin';
        var bin_path= M.path.join(site_root, bin_dir)

        result.data = C.helper.force_require(require.resolve(bin_path));
        result.ok   = 1;
        result.id   = '[i23]';
        result.text = 'Successfully loaded site BIN of site '+site+'.';

    } catch(error) { result = {...result, error, id: '[e54]', text: 'Failed to load BIN of site '+site+' - unknown error: '+error.message}; }

    return result;

}

// load all handler files and its contents into a handlers object that will be saved in S[<site_name>].handlers
exports.load_site_handlers = async function({site='', site_root='', config={}, log=false}={}) {

    var result = {ok: 0, data: {}, id: '[i18]', text: '', error: null};

    try {
 
        var handlers_dir    = config?.dir?.handlers || './handlers';
        var path            = M.path.join(site_root, handlers_dir);

        var handlers        = await C.sites.async_recursive_load_js(path);

        if(log && handlers.ok) C.logger.bootup_step({id: handlers.id, site, text: 'Site '+site+': '+handlers.text});

        result = handlers;

    } catch(error) { result = {...result, id: '[e49]', text: 'Failed to load handlers - unknown error: '+error.message, error};  }

    return result;
    
};

// load all views (html) into S.site.views object and register all helpers and partials in JS files, also, load helpers
exports.load_site_views = async function({site='', site_root='', config={}, log=false}={}) {

    var result = {ok: 0, data: {}, id: '[i19]', text: '', error: null, errors: {}};

    try {

        var views_dir   = config?.dir?.views || './views';
        var path        = M.path.join(site_root, views_dir);

        var views       = await C.sites.async_recursive_load_views(path); // load HTML and .handlebars views

        if(log) C.logger.bootup_step({id: views.id, site, text: 'Site '+site+': '+views.text});

        result = views;

    } catch(error) { result = {...result, id: '[e50]', text: 'Failed to load views - unknown error: '+error.message, error};  }

    return result;
    
};

exports.load_site_middleware = async function(SITE) {

    var result = {ok: 1, data: {}, text: 'No middleware applied.', error: null};

    try {

        var middleware = SITE?.middleware;

        if(middleware && M._.isFunction(middleware)) {

            result = await middleware(SITE); // must resolve with {ok, data, text, error} object

            if(result.ok) C.logger.bootup_step({id: '[i25]', site: SITE.name, text: result.text});

        }

    } catch(error) { result = {ok: 0, error, id: '[e57]', text: 'Failed to load site middleware of site '+site+' - unknown error: '+error.message}; }

    return result;

}

exports.connect_site_to_DB = async function({site='', site_root='', config = {}, log=false}={}) {

    var result  = {ok: 0, data: {}, id: '[i24]', text: '', error: null, steps: {}};

    try {

        // connect only if theres config for DB
        if(config.db) {
            
            var connect = await C.DB.connect({...config}); // {CONNECTION: <>, SHADOW: {}}

            // check if DB is ready only if the connect has been successful
            if(connect.ok) {

                if(log) C.logger.bootup_step({id: connect.id, site, text: connect.text, err: connect.error});

                result.steps.DB_connect = connect;

                var SITE        = S[site];
                var CONN        = connect.data.CONNECTION;
                var DB_ready    = await C.DB.wait_for_DB_ready({config, CONN});

                if(DB_ready.ok) {

                    if(log) C.logger.bootup_step({id: DB_ready.id, site, text: DB_ready.text, err: DB_ready.error});

                    result.steps.DB_ready   = DB_ready;

                    result.ok               = 1;
                    result.data.CONNECTED   = 1;
                    result.data.READY       = 1;
                    result.data.CONNECTION  = CONN;
                    result.data.SHADOW      = connect.data.SHADOW;
                    result.data.TABLES      = DB_ready.data.ready;
                    result.data.NAME        = config.db.db;
                    result.text             = connect.id+' '+connect.text+'; '+DB_ready.id+' '+DB_ready.text;

                    // do not halt the site load if only shadow_DB fails, the site might be fine without it
                    var shadow_DB           = await C.DB.load_shadow_DB({config, db_data: result.data});

                    result.steps.DB_shadow  = shadow_DB;
                    result.text            += '; '+shadow_DB.id+' '+shadow_DB.text;

                    if(shadow_DB.ok)        result.data.SHADOW  = shadow_DB.data.SHADOW;

                    // log success of shadow_DB load only if there were any shadow tables to load
                    if(log && shadow_DB.ok && shadow_DB.data.to_load) C.logger.bootup_step({id: shadow_DB.id, site, text: shadow_DB.text, err: shadow_DB.error});

                } else { 
                    
                    result = DB_ready; 
                    if(connect.data.CONNECTION) connect.data.CONNECTION.close(); // close the DB connection if further steps fail
                
                }
 
            } else { result = connect; }

        } else { result.ok = 1; result.text = 'Site '+site+' has no DB.'; result.data.CONNECTED = 0; }

    } catch(error) { result = {...result, id: '[e53]', text: 'Failed to connect site '+site+' to DB - unknown error: '+error.message, error}; }

    return result;
    
};

// THIS IS NOT NEEDED ANYMORE, AS BROWSERS LOOK ONLY FOR CERTIFICATE OF THE PROXY (listening on port 80), therefore, proxy HAS to have a certificate which encompasses all served on server
// exports.load_site_certificate = function(site, cert_dir = 'certificate') { return Promise.resolve(); };

// synchronous simple function that returns string
exports.error_page = function(title = '', error = '') {
    
    return `
    <!DOCTYPE html>

    <html>

        <head>

            <meta charset="UTF-8">
            <meta name="robots" content="noindex, nofollow">
            <title>${title}</title>

        </head>

        <body style="background: #eee;color:#333;">

            <div ondblclick="show_error()" style="width: 404px; margin: 100px auto; font-size: 2em;text-align:center;cursor: pointer;">

                <div>${title}</div>
                <div id="error" style="display: none;margin-top: 50px; font-size: 0.5em;text-align:left;">${error}</div>

            </div>

            <script>
                function show_error() {
                    document.getElementById('error').style.display = "block";        
                }
            </script>

        </body>

    </html>`;
    
}

exports.update_handlers_and_config = function(message) {
    
    var site_name   = message.site_name;
    var paths       = message.paths;
    
    Promise.chain([
    
        C.sites.load_site_handlers      .args(site_name, paths.handlers), // will be loaded via master together with all workers
        C.sites.load_site_config        .args(site_name, paths.config), // will be loaded via master together with all workers


    ]).then(function(val) {
        
        console.log('succesfully reloaded handlers and configs on worker '+C.server.worker_id);
    
    }).catch(function(error) {
        
        console.log('Failed to reload handlers and config: '+error.message, error);
        
    });
    
}

exports.async_recursive_load_js = async function(path) {

    var result = {ok: 0, data: {}, id: '[i18]', text: '', error: null};

    try {

        var path_contents = await M.node_dir.paths_async(path); // returns {files: [], dirs: []}

        // tree = handlers in tree object
        var {tree, files_by_dir_flat} = C.sites.create_tree_out_of_path_contents({root: path, path_contents});
        var count       = 0;
        var total_count = 0;

        // require all handlers (.js) files
        M._.forEach(files_by_dir_flat, function(files_in_dir, dir_path) {

            files_in_dir.forEach(function(file_name) {

                let ext = M.path.extname(file_name);

                if(ext === '.js') {

                    let dir_path_split          = dir_path.split('.');
                    let full_handler_path       = M.path.join(path, dir_path_split.join(M.path.sep), file_name);
                    let tree_location           = dir_path ? M._.get(tree, dir_path) : tree;
                    let file_name_without_ext   = M.path.basename(file_name, ext);

                    // delete require.cache[full_handler_path]; // remove from cache - for updating purposes // not needed anymore, handled in C.helper.force_require

                    let valid_file = (file_name_without_ext && M._.isString(file_name_without_ext)); 

                    if(valid_file) { count++; tree_location[file_name_without_ext] = C.helper.force_require(require.resolve(full_handler_path)); }

                    total_count++;

                }

            });

        });

        result = {...result, ok: 1, data: tree, text: 'Successfully loaded '+count+'/'+total_count+' handlers.'};

    } catch(error) { result = {...result, id: '[e49]', text: 'Failed to load handlers - unknown error: '+error.message, error} }

    return result; // handlers are in tree object

}

exports.async_recursive_load_views = async function(path) {

    try {

        var path_contents   = await M.node_dir.paths_async(path); // returns {files: [], dirs: []}

        // tree = object containing loaded views 
        var {tree, files_by_dir_flat} = C.sites.create_tree_out_of_path_contents({root: path, path_contents});

        var allowed_formats = {".html": 1, ".handlebars": 1};
        var promises        = [];

        // require all views (.html & .handlebars) files
        M._.forEach(files_by_dir_flat, function(files_in_dir, dir_path) {

            files_in_dir.forEach(function(file_name) {

                let ext = M.path.extname(file_name);

                if(allowed_formats[ext]) {

                    let dir_path_split  = dir_path.split('.');
                    let full_view_path  = M.path.join(path, dir_path_split.join(M.path.sep), file_name);
                    let rel_view_path   = dir_path_split.join('/') + '/' + file_name;
                    let tree_location   = dir_path ? M._.get(tree, dir_path) : tree;
                    let view_name       = M.path.basename(file_name, ext); // = file_name without ext (index.js -> index)

                    promises.push(
                        
                        M.fs.read_file_async(full_view_path)
                            .then(function(view) { tree_location[view_name] = M.handlebars.compile(view.toString('utf8')); return { ok: 1, view: rel_view_path }; })
                            .catch(function(error) { return { ok: 0, view: rel_view_path, error: error};})
            
                    );

                }

            });

        });

        var load_results = await Promise.resolve('root').parallel(promises);
        var result       = {ok: 1, data: {}, id: '[i19]', text: '', errors: {}};
        var count        = 0;
        var total_count  = promises.length;

        load_results.forEach(function(res) {

            if(res.resolved && res.resolved !== 'root') { // ignore the root promise

                if(res.ok) {

                    if(res.resolved.ok) { count++; }
                    else { result.errors[res.resolved.view] = res.resolved.error; }

                } else { result.errors['unknown'] = result.errors['unknown'] || []; result.errors['unknown'].push(res.error); }

            }

        });

        result.text = "Successfully loaded "+count+"/"+total_count+" views.";
        result.data = tree; // = views in tree object

        if(M._.size(result.errors)) { 

            result.text +=' \r\n---- ERRORS: ';
            M._.forEach(result.errors, function(error, view_name) { result.text += '\r\n-------- '+view_name+': '+error.message; });

        }

        return result;

    } catch(error) { return Promise.reject(error); }

}

// returns an object with structure same as all subdirectories of a root and a flat object with files by directories
exports.create_tree_out_of_path_contents = function({root, path_contents}={}) {

    var tree = {};                  // example: {users: {}, common: {helpers: {}}};
    var files_by_dir_flat = {};     // example: {'': ['index.js', 'lala.js'], 'users': ['index.js'], 'common.helpers': ['index.js']}
    var root_path_split = root.split(M.path.sep);

    path_contents.files.forEach(function(file) {

        var file_name       = M.path.basename(file);
        var dir             = M.path.dirname(file); 
        var dir_path_split  = dir.split(M.path.sep);


        // remove parts of DIRNAME that are shared with root (E.G. root = /a; dir = /a/b/c ==> return ['b', 'c']);
        // example: root_path_split = ['C:', 'site', 'views'] ..... dir_path_split = ['C:', 'site', 'views', 'user', 'private', 'account']
        var r = root_path_split.length;
        var i = r // we need r (the original start index) saved, because both i and j get incremented step by step, but the original start index is needed as well (below in the second for loop)
        var j = r;
        var dir_path_from_handlers_root = ''; // '' = root;

        for(i; i < dir_path_split.length; i++) { 

                j = r; // we need to reset j for every new i
            var dir_part= dir_path_split[i];
            var dir_loc = tree; // ! MUST NOT be a deep copy

            dir_path_from_handlers_root += dir_path_from_handlers_root ? '.'+dir_part : dir_part;

            for(j; j < i; j++) {

                if( !dir_loc[dir_path_split[j]] ) dir_loc[dir_path_split[j]] = {};

                dir_loc = dir_loc[dir_path_split[j]];

            }

            dir_loc[dir_part] = dir_loc[dir_part] || {};
        
        }

        files_by_dir_flat[dir_path_from_handlers_root] = files_by_dir_flat[dir_path_from_handlers_root] || [];
        files_by_dir_flat[dir_path_from_handlers_root].push(file_name);

    });

    return({tree, files_by_dir_flat});

}

exports.format_site_load_step_results = function(steps = {}) {

    var results             = {ok: 0, steps: {}, errors: {}};

    M._.forEach(steps, function(step, step_name) {

        let step_   = M._.omit(step, ['data']); 

        var type    = step_.ok ? 'steps' : 'errors';

        results[type][step_name] = step_;

        if(step_.steps) {

            let step_steps = C.sites.format_site_load_step_results(step_.steps);

            results.steps = {...results.steps, ...step_steps.steps };
            results.errors= {...results.errors, ...step_steps.errors };

        }

    });

    var critical_steps_ok = (steps.BIN && steps.BIN.ok && steps.config && steps.config.ok && steps.handlers && steps.handlers.ok && steps.views && steps.views.ok && steps.DB && steps.DB.ok && steps.middleware && steps.middleware.ok);

    results.ok  = critical_steps_ok;

    return results;

}

// return bool - check if site exists and is loaded
exports.site_is_loaded = function(site_name='') {

    return (site_name && S[site_name] && STATE.sites.loaded[site_name]) ? true : false;

}

// check if site is loaded and enabled (accepting requests)
exports.site_is_enabled = function(site_name='') {

    return (site_name && S[site_name] && STATE.sites.loaded[site_name] && STATE.sites.enabled[site_name]) ? true : false;

}







