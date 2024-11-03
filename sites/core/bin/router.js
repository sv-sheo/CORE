
exports.get_routes = function() {
    
    var routes = {
        
            /*'test-route':       {url: 'test', handler: 'test/test/test'},
            'lalala-route':     {url: 'lalala', handler: 'test/test/lalala'},
            'ahoj-route':       {url: 'ahoj', handler: 'test/test/ahoj', method: 'post'},
            'socket_io':        {url: 'socket.io(/<namespace>)', handler: 'test/test/test'},
            'socket_io':        {url: 'form', handler: 'test/test/form'},
            'test':             {url: '<handle_0>/<handle_1>(/<user_id>)', handler: '<handle_0>/<handle_1>/detail', regexps: {'<user_id>': /^\d+$/}},*/
            
            // FILES
            'files-get':        {url: 'files/get/<p1>(/<p2>(/<p3>(/<p4>(/<p5>(/<p6>(/<p7>(/<p8>(/<p9>(/<p10>(/<p11>(/<p12>(/<p13>(/<p14>(/<p15>))))))))))))))', handler: 'files/get_file'},
    
            // HOME
            'index':            {url: '', handler: 'index/index'},
            //'signal':           {url: '', handler: 'index/signal'},
            'sections':         {url: '<section>', handler: 'index/index', regexps: {'<section>': /(^server$)|(^processes$)|(^sub_servers$)|(^sites$)|(^sockets$)/i}},

            // AUTH
            'login':            {url: 'login', handler: 'auth/login', method: 'get'},
            'login_post':       {url: 'login', handler: 'auth/login_process', method: 'post'},
            'logout':           {url: 'logout', handler: 'auth/logout'},

            // UI overview
            'ui_overview':            {url: 'ui_overview', handler: 'index/ui_overview'},

            // HANDLEBARS RELOAD
            'handlebars-reload':{url: 'handlebars_reload', handler: 'index/handlebars_reload'},

            // ACME CHALLENGE - for proving control over domain for HTTPS
            'acme_challenge':       {url: '.well-known/acme-challenge/<key>', handler: 'index/acme_challenge'},
            
            // 404 ROUTE - has to be last
            'not_found':        {url: '(<a>(/<b>(/<c>(/<d>(/<e>(/<f>(/<g>(/<h>(/<ch>(/<i>(/<j>(/<k>(/<l>(/<m>(/<n>(/<o>))))))))))))))))', handler: 'test/test/not_found'},
        
        };

    return routes;

}