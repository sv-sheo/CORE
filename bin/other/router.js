
// match real request url against site routes and return matching route together with handler
exports.route = function(Q, s) {
    
    var SITE        = S[Q.site];
    var routes      = SITE.router;
    var base_url    = SITE.config.base_url || '/';
    var handlers    = SITE.handlers;
    var result      = {route: null, matched: null, handler: null};
    
    for(route_name in routes) {

        result.route    = routes[route_name];   
        result.matched  = C.router.match_route(result.route, Q.url, Q.method, base_url); // matched contains .params of the request URL (i.e. user ID)

        if(result.matched.success) { 
            
            result.handler = C.router.get_handler(handlers, result.route, result.matched.param_handlers);
            break;
            
        }
        
    }

    return result;
    
}

// check if given route matches, used in loop in c.router.route
exports.match_route = function(route, url, method, base_url = '/', params = {}) {
    
    // check for method before any other computing - if route method is set, but does not match request, return false
    if(route.method && route.method !== method) return {success: false, params: {}, param_handlers: {}};

    // format URL - extract only URL path (remove query etc)
    var true_url    = url;
        url         = url.split('?')[0];

    // check if route withe exact url (without params) exists
    if(base_url + route.url === url) return {success: true, params: {}, param_handlers: {}};
    
    var regexps =   { 
                        route_default:  /[a-zA-Z0-9\-\_]/,    // az09_-
                        is_optional:    /\($/,              // ends with (
                        first_optional: /^\(/,              // starts with (
                        is_param:       /^<.+>$/,           // <anything>
                        is_handle:      /^handle_\d$/,         
                        optional:       /\([a-zA-Z0-9<>\(\)\/\-\_]+\)/g, // match (az09<>()/-_)
                    };
    
    var matched         = true;
    var base_url        = base_url || '/';
    var route_url       = base_url + route.url;
    var brackets_index  = route_url.indexOf(')');
        route_url       = brackets_index > -1 ? route_url.slice(0, brackets_index) : route_url;
        route_url       = route_url.split('/');
    var request_url     = url.split('/');
    var is_optional     = false;
    var next_optional   = regexps.first_optional.test(route_url[1]); // IMPORTANT for index - enables first part to be optional
    var is_param        = false;
    var param_name      = '';
    var params          = {};
    var param_handlers  = {};
    var is_handle       = false;
    var handle          = [];
    var handle_key      = 0;
    var part            = '';
    var part_regexp     = regexps.route_default;
    var request_part    = '';
    
    // remove the empty first parts
    route_url.shift();
    request_url.shift();
    
    // if request url is bigger (has more parts) then route url, return false
    if(request_url.length > route_url.length) return {success: false};
    
    // going by route url
    for(var i = 0; i < route_url.length; i++) {
        
        part            = route_url[i];
        is_optional     = next_optional;
        next_optional   = regexps.is_optional.test(part);
        
        // in case first part is optional, adjust it (part) -> part)
        if(i === 0 && is_optional) part = part.slice(1);
        
        // next is optional, remove the ( 
        if(next_optional) part = part.slice(0, -1); //  part( -> part
        
        // check if part exists in request url, or if it doesnt exist, but is optional
        if(request_url[i] || is_optional) {
            
            request_part    = request_url[i] || '';
            is_param        = regexps.is_param.test(part);
        
            if(is_param) {
                
                // check if it has its own regexp, if not, use default and check if it matches
                var route_exps      = route.regexps || {};
                part_regexp         = route_exps[part] || part_regexp;
                matched             = part_regexp.test(request_part);
                    
                // in case its not set, check if its optional, if yes, natched = true
                if(!request_part && is_optional) matched = true;

                // part matches request, add to params and handle_params
                if(matched) {

                    param_name          = part.slice(1, -1); // <param> -> param
                    params[param_name]  = request_part;   

                    // handle params
                    is_handle = regexps.is_handle.test(param_name);
                    
                    if(is_handle) param_handlers[part] = request_part;

                }
            
            // not a param, do a simple check
            } else {
                
                matched = part == request_part;
                
                // in case its not set, check if its optional, if yes, natched = true
                if(!request_part && is_optional) matched = true;
 
            }
            
        // part doesnt exist and is not optional, this is not the route we are looking for, quit   
        } else { matched = false; }
        
        // terminate any further checking once we know its not our route
        if(matched === false) { break; }
        
    }
    
    return {success: matched, params, param_handlers};
    
}

// aftert matched route, from route handler, get real handler
exports.get_handler = function(handlers, route, param_handlers) {
    
    var handler         = handlers;
    var route_handlers  = route.handler.split('/');
    var is_param        = false;
    
    for(var i = 0; i < route_handlers.length; i++) {
        
        var route_handler = route_handlers[i];
        
        // check if handler from route is to be taken from params
        is_param    = /^<handle_\d>$/.test(route_handler);
        
        if(is_param && param_handlers[route_handler]) {
            
            handler = handler[param_handlers[route_handler]];
            
        } else { handler = handler[route_handler]; }
        
        if(!handler) {
            
            handler = false;
            break;
            
        }
        
    }
    
    if(route_handlers.length === 0) handler = false;
    
    return handler;
    
}












