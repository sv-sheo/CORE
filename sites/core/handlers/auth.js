
exports.login = async function({Q, s, SITE}) {
    
    SITE.auth.get_admin(Q, s);          // fills Q.data.admin       false if no admin
    SITE.auth.kick_logged_in(Q, s);     // kick to admin page (result) if someone is logged in
    SITE.other.pre.get_environment(Q, s, SITE);

	Q.data.js_data      = JSON.stringify(Q.frontend); // IMPORTANT
	Q.data.html         = {head: {title: 'CORE-S ADMIN'}};
	
	Q.data.PRELOAD_DATA = SITE.other.pre.get_preload_data(Q, SITE);
	Q.data.PRELOAD_DATA = M.tosource(Q.data.PRELOAD_DATA);
    
    // check for data from previous handler
    if(Q.cookies.previous) { 
        
        Q.data.result = JSON.parse(Q.cookies.previous);
        s.cookie.delete('previous');
        
    }

    s.html = SITE.views.auth.login(Q.data);
    
    return {ok: 1};
    
}

// ACTUAL LOGIN OF ADMIN
exports.login_process = async function({Q, s, SITE}) {
    
    SITE.auth.get_admin(Q, s);          // fills Q.data.admin       false if no admin
    SITE.auth.kick_logged_in(Q, s);     // kick to admin page (result) if someone is logged in
    
    Q.data.result = C.helper.new_result();
    
    // first get POST data, structure {field: false, files: false, error: false}
    Q.data.post = await Q.post;

    // now get admin by name from admins, limit 1

    let admin_db        = await DB.GET(SITE.DB, 'admins', {filter: {name: (Q.data.post?.fields?.name || '')}, limit: 1, format: 'single'});

    // validate data
    Q.data.result       = SITE.auth.validate_login({post: Q.data.post, admin: admin_db, code_geass: SITE.config.code_geass});
    Q.data.result.name  = Q.data.post?.fields?.name;

    if(Q.data.result.ok) {
        
        // the cookie shall have value like?
        // <ObjectId.str>_<id>_<name>_<time_of_login>
        let admin   = Q.data.result.data.admin;
        
        let now     = M.moment().format('x');
        let cookie  = [admin.id, admin.name, now].join('_'); 
            
        s.cookie.set('admin', cookie/*, age, path, domain, http_only*/);
        
        s.redirect('');
        
    // invalid -> back to login page with data
    } else { s.inner_redirect('login', Q.data.result); }

    return {ok: 1};
    
}

// LOGOUT PROCESS
exports.logout  = async function({Q, s, SITE}) {
    
    s.cookie.delete('admin');
    s.redirect('login');

    return {ok: 1};
    
}