
// get admin from cookies and fill Q.data.admin, false if no admin
exports.get_admin = function(Q, s) {
    
    Q.data.admin = false;

    if(Q.cookies.admin) {
        
        let admin       = Q.cookies.admin.split('_'); // array of admin data made from cookies
        Q.data.admin    = {id: parseInt(admin[0]), name: admin[1], time: parseInt(admin[2]), logged_in_time: M.moment(parseInt(admin[2])).format('D.M.Y HH:mm:ss')}
        
    }
    
}

// redirect to admin page (result), if a logged-in admin tries to log in
exports.kick_logged_in = function(Q, s) {
    
    if(Q.data.admin) s.redirect(''); // home
    
}

// redirect to admin page (result), if a logged-in admin tries to log in
exports.kick_not_logged_in = function(Q, s) {
    
    if(!Q.data.admin) s.redirect('login');
    
}

// veps of login
exports.validate_login = ({post={}, admin={}, code_geass=''}) => {
    
    let result = {ok: 0, text: '', data: {}};
    
    // error in POST data
    if(post.error) {
        
        result.text     = 'POSTA DATA ERROR: '+post.error?.message;
        
    // POST data ok
    } else {
        
        let p = post.fields || {};
        
        // check if name and pass exists in POST
        if(p?.name && code_geass) {
            
            // exactly 1 admin was found
            if(admin?.id) {

                // check password
                let input_pass      = p.pass || '';
                let decrypted_pass  = admin.pass ? C.ciphers.decrypt_sync(admin.pass, code_geass) : '';

                if(input_pass === decrypted_pass) {

                    result.ok = 1;
					result.text = "SUCCESS";
					result.data.admin = {name: admin.name, id: admin.id};

                } else { result.text = "WRONG PASSWORD"; }

            } else { result.text = "ADMIN NOT FOUND"; }
            
        } else { result.text = 'MISSING CREDENTIALS'; }
        
    }

    return result;
    
}