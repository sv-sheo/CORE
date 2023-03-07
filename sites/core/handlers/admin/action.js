


// HOME PAGE OF LOGGED IN ADMIN 
exports.home = function(resolve, reject, Q, s, SITE, DB, alert) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    SITE.auth.pre.kick_not_logged_in(Q, s);     // kick to login page, if no admin is logged in
    SITE.admin.pre.get_environment(Q, s, SITE);

    Q.data.menu         = SITE.admin.pre.get_menu('home');
    Q.data.menu_header  = 'FIBY ADMIN';
    Q.data.request_id   = Q.id;
    Q.data.alert        = alert ? JSON.stringify(alert) : '';
    Q.data.js_data      = {request_id: Q.id, true_host: Q.data.HOST};
    Q.data.js_data      = JSON.stringify(Q.data.js_data);
    
    Q.data.content      = SITE.views.admin.home({admin: Q.data.admin});
    
    s.html              = SITE.views.admin.root(Q.data);
    
    resolve()
    
}

exports.houses_list = function(resolve, reject, Q, s, SITE, DB, alert = null) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    SITE.auth.pre.kick_not_logged_in(Q, s);     // kick to login page, if no admin is logged in
    SITE.admin.pre.get_environment(Q, s, SITE);

    Q.data.menu         = SITE.admin.pre.get_menu('houses/list');
    Q.data.menu_header  = 'FIBY ADMIN';
    
    Q.data.alert        = alert ? JSON.stringify(alert) : '';

    Q.data.request_id   = Q.id;
    Q.data.js_data      = {request_id: Q.id, true_host: Q.data.HOST};
    Q.data.js_data      = JSON.stringify(Q.data.js_data);
    
    DB.GET('houses')
    .then((houses) => {
        
        Q.data.content      = SITE.views.admin.houses.list({houses: houses, HOST:Q.data.HOST});
        s.html              = SITE.views.admin.root(Q.data);
        
        resolve();
    
    }).catch(reject);
    
}

exports.houses_add = function(resolve, reject, Q, s, SITE, DB, alert = null) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    SITE.auth.pre.kick_not_logged_in(Q, s);     // kick to login page, if no admin is logged in
    SITE.admin.pre.get_environment(Q, s, SITE);
    
    Q.data.menu         = SITE.admin.pre.get_menu('houses/add');
    Q.data.menu_header  = 'FIBY ADMIN';
    
    Q.data.alert        = alert ? JSON.stringify(alert) : '';
    
    let backfill        = (alert && alert.data) ? alert.data : {};
        backfill.other  = SITE.admin.process.houses.format_backfill_other(backfill.other);
    
    // values on first run (without alert)
    if( !alert ) {
        
        backfill.active = 1; 
        backfill.area   = {net: 0, gross: 0}; 
        
    }
    
    let temp_title_image        = backfill.title_image ? M.path.join(SITE.config.root, SITE.config.files.dir, 'temp', backfill.title_image) : '';
    let temp_title_image_sketch = backfill.title_image_sketch ? M.path.join(SITE.config.root, SITE.config.files.dir, 'temp', backfill.title_image_sketch) : '';
    
    let fu              = {};
        fu.title        = SITE.admin.file_upload.get_data({uploaded_input: 'ti_input', max_size: 2, url: '/admin/ajax/upload_image', preview: temp_title_image});
        fu.title_sketch = SITE.admin.file_upload.get_data({uploaded_input: 'tis_input', max_size: 2, url: '/admin/ajax/upload_image', preview: temp_title_image_sketch, text: 'SKETCH'});
    
    Q.data.request_id   = Q.id;
    Q.data.js_data      = {request_id: Q.id, true_host: Q.data.HOST};
    Q.data.js_data      = JSON.stringify(Q.data.js_data);
    
    Q.data.content      = SITE.views.admin.houses.form({fu, backfill, action: '/admin/post/houses_add'});
    s.html              = SITE.views.admin.root(Q.data);

    resolve();
    
}

exports.house = function(resolve, reject, Q, s, SITE, DB, alert = null) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    SITE.auth.pre.kick_not_logged_in(Q, s);     // kick to login page, if no admin is logged in
    SITE.admin.pre.get_environment(Q, s, SITE);

    // get home
    let id = parseInt(Q.params.id) || 0;
    DB.GET('houses', {id: id})
    .then((house) => {
        
        if(house.size === 1) {
            
            house               = SITE.process.get_first(house);
            house               = SITE.admin.process.houses.format_for_detail(house, SITE);
            
            Q.data.menu         = SITE.admin.pre.get_menu('houses/house/detail', {house: house});
            Q.data.menu_header  = 'FIBY ADMIN';
            
            Q.data.alert        = alert ? JSON.stringify(alert) : '';
            
            Q.data.request_id   = Q.id;
            Q.data.js_data      = {request_id: Q.id, true_host: Q.data.HOST};
            Q.data.js_data      = JSON.stringify(Q.data.js_data);
            
            Q.data.content      = SITE.views.admin.houses.detail({house});
            s.html              = SITE.views.admin.root(Q.data);

            resolve();
        
        // house doesnt exist, kick to list
        } else { SITE.process.inner_redirect({message: 'Tento dům neexistuje.'}, '[house_action_1]', 'admin.action.houses_list', '/admin/houses_list',  null, resolve, reject, Q, s, SITE, DB); }
        
    }).catch(reject);
    
}

exports.house_edit = function(resolve, reject, Q, s, SITE, DB, alert = null) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    SITE.auth.pre.kick_not_logged_in(Q, s);     // kick to login page, if no admin is logged in
    SITE.admin.pre.get_environment(Q, s, SITE);

    // get home
    let id = parseInt(Q.params.id) || 0;
    DB.GET('houses', {id: id})
    .then((house) => {
        
        if(house.size === 1) {
            
            house               = SITE.process.get_first(house);
            //house               = SITE.admin.process.houses.format_for_detail(house);
            
            let backfill        = (alert && alert.data) ? alert.data : house;
                backfill.other  = SITE.admin.process.houses.format_backfill_other(backfill.other);
            
            Q.data.menu         = SITE.admin.pre.get_menu('houses/house/edit', {house: house});
            Q.data.menu_header  = 'FIBY ADMIN';
            
            Q.data.alert        = alert ? JSON.stringify(alert) : '';
            
            Q.data.request_id   = Q.id;
            Q.data.js_data      = {request_id: Q.id, true_host: Q.data.HOST};
            Q.data.js_data      = JSON.stringify(Q.data.js_data);
            
            Q.data.content      = SITE.views.admin.houses.form({backfill, action: '/admin/post/house_edit/'+house.id});
            s.html              = SITE.views.admin.root(Q.data);

            resolve();
        
        // house doesnt exist, kick to list
        } else { SITE.process.inner_redirect({message: 'Tento dům neexistuje.'}, '[house_action_1]', 'admin.action.houses_list', '/admin/houses_list',  null, resolve, reject, Q, s, SITE, DB); }
        
    }).catch(reject);
    
}

exports.house_images = function(resolve, reject, Q, s, SITE, DB, alert = null) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    SITE.auth.pre.kick_not_logged_in(Q, s);     // kick to login page, if no admin is logged in
    SITE.admin.pre.get_environment(Q, s, SITE);
    
    Q.data.request_id   = Q.id;
    Q.data.js_data      = {request_id: Q.id, true_host: Q.data.HOST};
    
    // get home
    let id = parseInt(Q.params.id) || 0;
    DB.GET('houses', {id: id})
    .then((house) => {
        
        if(house.size === 1) {
            
            house               = SITE.process.get_first(house);
            house               = SITE.admin.process.houses.format_for_detail(house, SITE); // get images_src
            
            Q.data.menu         = SITE.admin.pre.get_menu('houses/house/images', {house: house});
            Q.data.menu_header  = 'FIBY ADMIN';
            
            Q.data.alert        = alert ? JSON.stringify(alert) : '';
            
            let ajax_url        = '/admin/ajax/house_edit_image/'+house.id;
            let house_dir       = Q.data.HOST+'files/get/images/houses/'+house.id+'/';
            
            let other_image_limit = 10;
            let fu              = {};
                fu.title        = SITE.admin.file_upload.get_data({ id:1, max_size: 2, url: ajax_url+'?type=title'});
                fu.title_sketch = SITE.admin.file_upload.get_data({ id:2, max_size: 2, url: ajax_url+'?type=title_sketch', text: 'SKETCH'});
                fu.plan         = SITE.admin.file_upload.get_data({ id:3, max_size: 2, url: ajax_url+'?type=plan'});
                fu.plan_2       = SITE.admin.file_upload.get_data({ id:4, max_size: 2, url: ajax_url+'?type=plan_2'});
                fu.other        = [];
            
            if(house.images.title) {
                
                fu.title.preview    = SITE.process.src_to_img(house_dir+house.images.title, 'class="fit_size_image"');
                fu.title.remove_url = '/admin/ajax/house_remove_image/'+house.id+'?name='+house.images.title+'&type=title';
                
            }
            
            if(house.images.title_sketch) {
                
                fu.title_sketch.preview    = SITE.process.src_to_img(house_dir+house.images.title_sketch, 'class="fit_size_image"');
                fu.title_sketch.remove_url = '/admin/ajax/house_remove_image/'+house.id+'?name='+house.images.title_sketch+'&type=title_sketch';
                
            }
            
            if(house.images.plan) {
                
                fu.plan.preview    = SITE.process.src_to_img(house_dir+house.images.plan, 'class="fit_size_image"');
                fu.plan.remove_url = '/admin/ajax/house_remove_image/'+house.id+'?name='+house.images.plan+'&type=plan';
                
            }
            
            if(house.images.plan_2) {
                
                fu.plan_2.preview    = SITE.process.src_to_img(house_dir+house.images.plan_2, 'class="fit_size_image"');
                fu.plan_2.remove_url = '/admin/ajax/house_remove_image/'+house.id+'?name='+house.images.plan_2+'&type=plan_2';
                
            }
                
            for(var i = 0; i < other_image_limit; i++) {
                
                let other_image = house.images.other[i] || {};
                let fu_options  = { id: (i+5), max_size: 2, url: ajax_url+'?type=other&i='+i, style: 'margin-bottom: 5px;'};
                
                if(house.images.other[i]) {
                    
                    fu_options.preview  = SITE.process.src_to_img(house_dir+house.images.other[i], 'class="fit_size_image"');
                    fu_options.remove_url = '/admin/ajax/house_remove_image/'+house.id+'?name='+house.images.other[i]+'&type=other&i='+i;
                    
                }
                
                fu.other.push(SITE.admin.file_upload.get_data(fu_options));
                
            }
            
            Q.data.js_data      = JSON.stringify(Q.data.js_data);
            
            Q.data.content      = SITE.views.admin.houses.images({fu, house});
            s.html              = SITE.views.admin.root(Q.data);

            resolve();
        
        // house doesnt exist, kick to list
        } else { SITE.process.inner_redirect({message: 'Tento dům neexistuje.'}, '[house_action_1]', 'admin.action.houses_list', '/admin/houses_list',  null, resolve, reject, Q, s, SITE, DB); }
        
    }).catch(reject);
    
}

exports.house_remove = function(resolve, reject, Q, s, SITE, DB, alert = null) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    SITE.auth.pre.kick_not_logged_in(Q, s);     // kick to login page, if no admin is logged in
    SITE.admin.pre.get_environment(Q, s, SITE);
    
    // get home
    DB.GET('houses', {id: parseInt(Q.params.id) || 0})
    .then((house) => {
        
        if(house.size === 1) {
            
            Q.data.house = SITE.process.get_first(house);
            
            return Promise.resolve();
        
        // house doesnt exist, kick to list
        } else { 
        
            return Promise.reject({message: 'Tento dům neexistuje.'});
            
        }
        
    }).then((res) => {
        
        Q.data.menu         = SITE.admin.pre.get_menu('houses/house/remove', {house: Q.data.house});

        Q.data.alert        = alert ? JSON.stringify(alert) : '';

        Q.data.request_id   = Q.id;
        Q.data.js_data      = {request_id: Q.id, true_host: Q.data.HOST};
        Q.data.js_data      = JSON.stringify(Q.data.js_data);

        Q.data.content      = SITE.views.admin.houses.remove({house: Q.data.house});
        s.html              = SITE.views.admin.root(Q.data);

        resolve();
        
    }).catch((error) => {
        
        console.log('ERROR', error);
        
        let redirect =  Q.data.house 
                        ? {url: '/admin/house/'+Q.data.house.id, handler: 'admin.action.house'}
                        : {url: '/admin/houses_list', handler: 'admin.action.houses_list'};
        
        SITE.process.inner_redirect(error, '[house_remove_1]', redirect.handler, redirect.url,  null, resolve, reject, Q, s, SITE, DB);
        
    });
    
}

exports.contact = function(resolve, reject, Q, s, SITE, DB, alert = null) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    SITE.auth.pre.kick_not_logged_in(Q, s);     // kick to login page, if no admin is logged in
    SITE.admin.pre.get_environment(Q, s, SITE);

    Q.data.menu         = SITE.admin.pre.get_menu('contact');
    Q.data.request_id   = Q.id;
    Q.data.alert        = alert ? JSON.stringify(alert) : '';
    
    Q.data.js_data      = {request_id: Q.id, true_host: Q.data.HOST};
    Q.data.js_data      = JSON.stringify(Q.data.js_data);
    
    DB.GET('content', {page: 'contact'})
    .then((db_content) => {
        
        db_content          = SITE.process.data_by_key(db_content, 'name');
        Q.data.content      = SITE.views.admin.contact.content({content: db_content});
    
        s.html              = SITE.views.admin.root(Q.data);

        resolve()
        
    }).catch(reject);
    
}