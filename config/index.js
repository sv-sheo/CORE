

require('dotenv').config(); // fills process.env with .env file content
                            // in sites, use dotenv.parse(buf) and buf=fs.readFileSync(./env) to add site config

var cpu_cores = require('os').cpus();

// expand on .env file
var config = {};

    config.server_ip    = process.env.server_ip,
    config.https        = process.env.https ? true : false;
    config.root         = process.env.root,
    config.machine      = process.env.machine,        //pc | laptop | rpi
    config.code_geass   = process.env.code_geass,
    config.ENVIRONMENT  = process.env.ENV,            // PRODUCTION | DEVELOPMENT
    config.PRODUCTION   = process.env.ENV === 'PRODUCTION',
    config.DEVELOPMENT  = process.env.ENV === 'DEVELOPMENT',

    // PORTS
    config.ports = {
                                        // a reverse proxy is in use for future addition of load-balancing capabilities, 
                                        // it also provides rudimentary load balancing as-is, since requests handled in proxy do not get fully initiated, and you can filter them,
                                        // to let through only valid requsts that will be fully initiated (more expensive) behind proxy 
                                        // ... good explanation of proxies can be found here: https://www.cloudflare.com/learning/cdn/glossary/reverse-proxy/
        http_proxy_server:  80,         // all HTTP requests will go through proxy which will direct them to the main http server
        http_main_server:   8080,       // main HTTP server that will handle allowed requests
        https_proxy_server: 443,        // all HTTPS requests will be handles by HTTPS proxy, (DEPRECATED - which will redirect them to their own respective sites, with their own respective certificates)
        https_main_server:  8443,       // 

    }

    // OTHER
    config.workers          = parseInt(process.env.workers) || 1,                                           // number od CPU cores to use
    config.workers          = process.env.workers === 'max' ? cpu_cores.length : config.workers;
    config.workers          = config.workers < 1 ? 1 : config.workers;
    config.workers          = config.workers > cpu_cores.length ? cpu_cores.length : config.workers;

    config.shutdown_timeout = parseInt(process.env.shutdown_timeout) || 30, // in seconds

    // CERTIFICATES
    // SERVER ITSELF (proxies) now HAVE to BE HTTPS (core server has to have its own certificate) (even localhost)
    config.certificates  = {

        https: {

            key_file: process.env.certificates_https_key_file, // path to key file
            crt_file: process.env.certificates_https_crt_file, // path to .crt file

        }

    }

    // LOGS
    config.logs = {

        path:           process.env.logs_path || "./logs/",
        request:        {

            path:       './requests/', // for logging requests that had unknown site
            types:      [ 'full', 'basic', 'bare', 'none' ],

            // log types by hooks (Q.hook) 
            by_hook: { /* ... get_request_log_type_config_by_hook method cannot be used here yet, because by this time, C.helper.config hasnt been loaded yet */

                main:       {

                    file:   process.env.logs_request_main_file      || 'full', // full, basic, bare, none
                    db:     process.env.logs_request_main_db        || 'full',
                    console:process.env.logs_request_main_console   || 'full', // full, basic, none

                },
                sub:       {

                    file:   process.env.logs_request_sub_file       || 'basic',
                    db:     process.env.logs_request_sub_db         || 'basic',
                    console:process.env.logs_request_sub_console    || 'basic',

                },
                none:      {

                    // file:   process.env.logs_request_none_file      || 'none', // - deprecated
                    // db:     process.env.logs_request_none_db        || 'bare', // - deprecated // because of this deprecation, requests with none hook cant be connected to socket
                    console:process.env.logs_request_none_console   || 'none',

                },
                error:       {

                    file:   process.env.logs_request_error_file     || 'full',
                    db:     process.env.logs_request_error_db       || 'full',
                    console:process.env.logs_request_error_console  || 'full',

                },

            }

        }
    
    }

    // SOCKET
    config.socket = {

        enabled:            process.env.socket_enabled ? true               : false,
        timeout:            parseInt(process.env.socket_timeout)            || 0, // 0 = no timeout
        max_connections:    parseInt(process.env.socket_max_connections)    || 1000,
        artificial_delay:   parseInt(process.env.socket_artificial_delay)   || 0, // for DEV purposes only

        servers:    { // must be represented in .env

            REGULAR: { 
                host:       process.env.socket_server_REGULAR_host || '', 
                port:       parseInt(process.env.socket_server_REGULAR_port) || 0, 
                secure:     process.env.socket_server_REGULAR_secure ? true : false,
                protocol:   process.env.socket_server_REGULAR_secure ? 'wss://' : 'ws://',
            },
            SECURE: {
                host:       process.env.socket_server_SECURE_host || '',
                port:       parseInt(process.env.socket_server_SECURE_port) || 0,  
                secure:     process.env.socket_server_SECURE_secure ? true : false,
                protocol:   process.env.socket_server_SECURE_secure ? 'wss://' : 'ws://',
            },
            /*
            OPAJDA_SECURE: {...} // if you need certain site to have its own socket server
            FIBY_SECURE: {...}
             */
            // example of external socket server config - this socket server will not be running on this machine ... more viz bin/other/socket.js
            RPI5: {
                host:       '', // should be set via env like above
                port:       0,  
                secure:     true,
                protocol:   'wss://',
                external:   true,
            }
            // custom: {},

        }

    }

    // REQUEST
    config.request = {

        timeout:    parseInt(process.env.request_timeout) || 10,    // in seconds
        ignore_favicon: process.env.request_ignore_favicon ? true : false,

    }

    // RESPONSE
    config.response = { }

    // FILES
    config.files = {

        temp_dir:   process.env.files_temp_dir || "./files/temp/",
        max_size:   parseInt(process.env.files_max_size) || 2, // max size in MB of all files in POST

    }

    // DB
    config.db = {

        script:     process.env.DB_script,
        config:     process.env.DB_config,
        host:       process.env.DB_host,
        port:       process.env.DB_port,
        db:         process.env.DB_name,
        user:       process.env.DB_user,
        pass:       process.env.DB_password,

        bootup_timeout: parseInt(process.env.DB_bootup_timeout) || 10, // give some time after booting up DB to become responsive, in seconds
        ready_timeout: parseInt(process.env.DB_ready_timeout) || 30, // give some time for DB tables to become ready, in seconds
        //host:       'localhost',                         // not needed for rethinkDB
        //user:       'admin',                             // ... admin user of RethinkDB ... full rights
        //pass:       '0e5c2b5fb0f3d49d7d7afc3560bacf5f',  //

        /* 
            commands used to update admin user (GUIDE IN sites/project/SETUP README) 
            
            SOME BASIC COMMANDS (in RethinkDB admin at localhost:8080):
            >r.db('sheo').table('souls')                                 ... returns all rows in table souls
            >r.db('sheo').table('souls').filter(r.row("n").gt(1))       ... returns all rows where n > 1

        */

    }

    // SITES
    config.sites = {

        path:       process.env.sites_path || "../sites/",
        to_load:    process.env.sites_to_load.split(',').map(site => site.trim()), // sheo, project, opajda, fiby, moonblocks, volba

    }

    config.admin = {

        on:         process.env.admin_on ? true : false,
        name:       process.env.admin_name || 'core', // will be used as a site name (available in S['core'])
        //host:     process.env.admin_host || process.env.server_ip, // if no host is specified, http://<IP>/<name> will be used
        path:       process.env.admin_path || './sites/core',
    
    }

    // MAIL
    config.mail = {

        providers:      {

            // NODEMAILER
            //  - paired with a gmail account (for example a@gmail.com) - via this email, nodemailer sends out emails (meaning that they appear as sent from the gmail, and even appear in the "sent" gmail inbox)
            //  - can host only 1 dev server that works for all sites -> 1 dev server running on each worker and master
            nodemailer: {

                enabled:        process.env.mailer_node_enabled ? true : false,
                host:           process.env.mailer_node_host || '',
                port:           process.env.mailer_node_port || 0,                       // (GMAIL: secure:true for port 465, secure:false for port 587)
                secure:         process.env.mailer_node_secure ? true : false,       
                bypass_secure:  process.env.mailer_node_bypass_secure ? true : false,    // false for PRODUCTION;  true for localhost (with self-signed certificate) (DEV)
                user:           process.env.mailer_node_user || '',
                pass:           process.env.mailer_node_pass || '',

            },
                                        
            brevo: {

                API_KEY: process.env.mailer_brevo_API_KEY || '',

            }

        },

    }


module.exports      = config;