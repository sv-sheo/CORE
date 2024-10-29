// extend response object
exports.init = async function(s, Q) {
    
    var SITE    = S[Q.site];

    // COOKIES 
    s.cookie = {};
    
    //Max-age sets the time in SECONDS for when a cookie will be deleted (counting from the time browser receieved cookie), if not set, it will be a session cookie
    
    s.cookie.set = function(name, value, age, path, domain, http_only) {
        
        if(name && value) {
            
            var             cookie_string   = name + '=';
                            cookie_string  += C.ciphers.encrypt_sync(value, SITE.config.code_geass);
            
            if(age)         cookie_string  += '; Max-Age=' + age;
            if(path)        cookie_string  += '; Path=' + path;
            if(domain)      cookie_string  += '; Domain=' + domain;
            if(http_only)   cookie_string  += '; HttpOnly';

            // check if some cookie is already set, if yes, push to the cookies array, otherwise create cookies array
            var cookies     = s.getHeader('Set-Cookie') ? s.getHeader('Set-Cookie') : [];
                cookies.push(cookie_string);
            
            // finish
            s.setHeader('Set-Cookie', cookies);
        
        }
        
    }
    
    s.cookie.delete = function(name = 'nonexistent', path, domain, http_only) {
        
        var cookie_string = name+'=deleted; Expires=Thu, 01 Jan 1970 00:00:01 GMT';

        if(path)        cookie_string  += '; Path=' + path;
        if(domain)      cookie_string  += '; Domain=' + domain;
        if(http_only)   cookie_string  += '; HttpOnly';

        // check if some cookie is already set, if yes, push to the cookies array, otherwise create cookies array
        var cookies     = s.getHeader('Set-Cookie') ? s.getHeader('Set-Cookie') : [];
            cookies.push(cookie_string);
        
        s.setHeader('Set-Cookie', cookies);
        
    }
    
    s.redirect = function(url = '', out = false) {
        
        var location = out ? url : Q.data.HOST + url;
        
        //console.log('REDIRECT TO '+location);

        Q.hook      = 'none';
        s.result    = {code: 302, handled: true, message: '302 Redirected to ' + url};
        
        s.writeHead(302, {'Location': location});
        s.end('');
        
    }
    
    // redirect to the same site, with possibility to save data from previous handler in cookie previous
    s.inner_redirect = function(url = '', previous = false) {
        
        var location = Q.data.HOST + url;
        
        //console.log('INNER REDIRECT TO '+location);
        
        if(previous) s.cookie.set('previous', JSON.stringify(previous));
        
        Q.hook      = 'none';
        s.result    = {code: 302, handled: true, message: '302 Redirected to ' + url};
        
        s.writeHead(302, {'Location': location});
        s.end('');
        
    }
    
    return s;
    
}

exports.quick_error = function({s, code, error, text}={}) {

    var text_error = error ? ' '+M.util.inspect(error) : '';

    s.writeHead(code, {'Content-Type': 'text/html'});
    s.result = {code, handled: true, message: text + text_error};
    s.end(C.sites.error_page(text, text_error));

}

exports.quick_response = function({s, code, content, message, content_type='text/html'}={}) {

    s.writeHead(code, {'Content-Type': content_type});
    s.result = {code, handled: true, message: message};
    s.end(content);

}