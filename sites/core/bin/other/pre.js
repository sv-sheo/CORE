
exports.get_preload_data = function(Q, SITE) {

    // PRELOAD DATA for JS in HTML
    var PRELOAD_DATA             = Q.data.PRELOAD_DATA || {};
        PRELOAD_DATA.request_id  = Q.id;
        PRELOAD_DATA.languages   = SITE.config.languages || {en: 'English', cz: 'Česky'};
        PRELOAD_DATA.language    = Q.language;
        PRELOAD_DATA.currencies  = Q.data.currencies;
        PRELOAD_DATA.socket      = Q.data.socket;
        PRELOAD_DATA.admin 		 = Q.data.admin;
        PRELOAD_DATA.alerts      = Q.alerts || [];
        PRELOAD_DATA.HOST        = Q.data.HOST;
        PRELOAD_DATA.webpack_url = Q.data.webpack_url;
        PRELOAD_DATA.error       = Q.data.server_error;
        PRELOAD_DATA.section    = Q.params;
        PRELOAD_DATA.base_url   = Q.base_url;

        PRELOAD_DATA.resource_version = Q.data.resource_version;

    return PRELOAD_DATA;

}

exports.get_environment = (Q, s, SITE) => {
        
	Q.data.webpack_url  = SITE.config.ENVIRONMENT === 'DEVELOPMENT' ? 'http://localhost:'+SITE.config.webpack_dev_port+'/' : Q.data.HOST+'files/get/build/production/'; 
    Q.data.base_url     = Q.base_url;
    Q.data.socket       = SITE.config.socket || {};

}

exports.get_socket_data = (Q, SITE) => {
        
    let data            = {};
    let server_name     = SITE.config.site_socket.server;
    let server_data     = CONFIG.core.socket.servers[server_name];

    data.server         = server_name;
    data.host           = server_data.host;
    data.port           = server_data.port;
    data.protocol       = server_data.protocol;
    data.url            = server_data.protocol+server_data.host+':'+server_data.port;
    data.namespaces     = SITE.config.site_socket.namespaces;
    data.timeout        = SITE.config.site_socket.timeout;

    return data;

}