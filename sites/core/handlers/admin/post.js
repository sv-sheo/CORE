

// HOME PAGE OF LOGGED IN ADMIN 
exports.houses_add = function(resolve, reject, Q, s, SITE, DB) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    
    let result      = SITE.admin.process.empty_result({errors: ['Akce se nezdařila.'], redirect: '/admin/houses_add'});
    
    if(Q.data.admin) {
        
        Q.post.then((data) => {
            
            if(data && data.fields && data.fields.name) {
                
                result.data = data.fields;
                
                DB.GET('houses', false, {id:-1}, 1)
                .then((last_house) => {
                    
                    data            = SITE.admin.process.houses.adjust_data(data.fields);
                    
                    let id          = (SITE.process.get_first(last_house).id || 0) + 1; // new ID
                    let overflow    = data.to_delete;
                    delete          data.to_delete;
                    
                    data.id = id;
                    
                    DB.SET('houses', data).then((insert) => {
                        
                        if(insert.result.ok && insert.result.n === 1) {
                            
                            let file_dir    = M.path.join(SITE.config.root, SITE.config.files.dir);
                            let house_dir   = M.path.join(file_dir, 'images/houses', id+'');
                            let temp_dir    = M.path.join(file_dir, 'temp');
                            
                            let temp_title_image    = overflow.title_image ? M.path.join(file_dir, 'temp', overflow.title_image) : '';
                            let temp_title_sketch   = overflow.title_image_sketch ? M.path.join(file_dir, 'temp', overflow.title_image_sketch) : '';
                            
                            let new_title_image     = temp_title_image ? M.path.join(house_dir, 'title'+M.path.extname(overflow.title_image)) : '';
                            let new_title_sketch    = temp_title_sketch ? M.path.join(house_dir, 'title_sketch'+M.path.extname(overflow.title_image)) : '';
                            
                            Q.params.id = id;
                            
                            // move images
                            SITE.admin.process.file.prove_dir(house_dir)
                            .then((res) => {
                                
                                return Promise.resolve().parallel([
                                    
                                    SITE.admin.process.file.move_file(temp_title_image, new_title_image),
                                    SITE.admin.process.file.move_file(temp_title_sketch, new_title_sketch),
                                
                                ]);
                                
                            }).then((res) => {
                                
                                result.data = data;
                                result.ok = 1;
                                SITE.handlers.admin.action.house(resolve, reject, Q, s, SITE, DB, result); 
                                
                            }).catch((error) => { catch_error(error, '[HAE6]', 'admin.action.house'); });
                            
                        } else { catch_error({message: 'Chyba databáze.'}, '[HAE5]', 'admin.action.houses_add'); }                        
                        
                    }).catch((error) => {  catch_error(error, '[HAE4]', 'admin.action.houses_add');});
                      
                }).catch((error) => {  catch_error(error, '[HAE3]', 'admin.action.houses_add');});
                
            } else { catch_error({message: 'Chybí data.'}, '[HAE2]', 'admin.action.houses_add');}
            
        }).catch((error) => {  catch_error(error, '[HAE-1]', 'admin.action.houses_add');});
        
    } else { catch_error({message: 'Přístup odepřen.'}, '[HAE1]', 'admin.action.houses_add');}
    
    function catch_error(err, code = '[HAE0]', path) {
        
        result.data.error = err;
        result.errors.push('Chyba '+code);
        if(err.message) result.errors.push(err.message);
        
        if(path) {
            
            let redirect = M._.get(SITE.handlers, path, false);
            if(redirect && M.util.isFunction(redirect)) redirect(resolve, reject, Q, s, SITE, DB, result);
            
            
        }
        
    }
    
}
 
exports.house_edit = function(resolve, reject, Q, s, SITE, DB) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    
    let result      = SITE.admin.process.empty_result({errors: ['Akce se nezdařila.'], redirect: '/admin/houses_list'});
    
    if(Q.data.admin) {
        
        let id = parseInt(Q.params.id) || 0;
        
        result.redirect = '/admin/house_edit/'+id;
        
        DB.GET('houses', {id: id})
        .then((house) => {

            if(house.size === 1) {

                house               = SITE.process.get_first(house);
        
                Q.post.then((data) => {

                    if(data && data.fields && data.fields.name) {

                        result.data     = data.fields;
                        let new_data    = SITE.admin.process.houses.adjust_data(data.fields);
                            new_data    = M._.merge(house, new_data);
                        delete          new_data.to_delete;
                        
                        DB.CHANGE('houses', {id: id}, {$set: new_data})
                        .then((change) => {
                            
                            if(change.result.ok) {
                                
                                result.ok = 1;
                                SITE.handlers.admin.action.house_edit(resolve, reject, Q, s, SITE, DB, result);  
                                
                            } else { result.db_result = change; catch_error({message: 'Chyba Databáze.'}, '[HEE7]', 'admin.action.house_edit/'+id); }
                            
                        }).catch((error) => {catch_error(error, '[HEE6]', 'admin.action.house_edit/'+id);})

                    } else { catch_error({message: 'Chybí data.'}, '[HEE5]', 'admin.action.house_edit/'+id);}

                }).catch((error) => { catch_error(error, '[HEE4]', 'admin.action.house_edit/'+id);});
                
            } else { catch_error({message: 'Tento dům neexistuje.'}, '[HEE3]', 'admin.action.house_edit/'+id); }
            
        }).catch((error) => { catch_error(error, '[HEE2]', 'admin.action.houses_edit/'+id); });
        
    } else { catch_error({message: 'Přístup odepřen.'}, '[HEE1]', 'admin.action.houses_list');}
    
    function catch_error(err, code = '[HEE0]', path) {
        
        result.data.error = err;
        result.errors.push('Chyba '+code);
        if(err.message) result.errors.push(err.message);
        
        if(path) {
            
            let redirect = M._.get(SITE.handlers, path, false);
            if(redirect && M.util.isFunction(redirect)) redirect(resolve, reject, Q, s, SITE, DB, result);
            
            
        }
        
    }
    
}

exports.house_remove = function(resolve, reject, Q, s, SITE, DB) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    
    let result      = SITE.admin.process.empty_result({errors: ['Akce se nezdařila.'], redirect: '/admin/houses_list'});
    
    if(Q.data.admin) {
        
        let id          = parseInt(Q.params.id) || 0
        result.redirect = '/admin/house_remove/'+id;
        
        // GET HOUSE
        DB.GET('houses', {id: id})
        .then((house) => {

            if(house.size === 1) {

                Q.data.house= SITE.process.get_first(house);
                
                return Promise.resolve();
        
                
            } else { 
                
                return Promise.reject({message: 'Tento dům neexistuje.'}); 
            
            }
            
        // remove all images with folder
        }).then(() => {
            
            let     house_dir = M.path.join(SITE.config.root, SITE.config.files.dir, 'images/houses/'+Q.data.house.id);
            return  SITE.admin.process.file.remove_dir(house_dir);
            
        // REMOVE FROM DB
        }).then(() => {
            
            return DB.REMOVE('houses', {id: Q.data.house.id});
            
        // FINISH REQUEST
        }).then((remove) => {
            
            result.ok           = 1;
            result.data         = remove;
            result.redirect     = '/admin/houses_list';
            SITE.handlers.admin.action.houses_list(resolve, reject, Q, s, SITE, DB, result); 
            
        }).catch((error) => { catch_error(error, '[HRE2]', 'admin.action.house_remove'); });
        
    } else { catch_error({message: 'Přístup odepřen.'}, '[HRE1]', 'admin.action.houses_list');}
    
    function catch_error(err, code = '[HRE0]', path) {
        
        result.data.error = err;
        result.errors.push('Chyba '+code);
        if(err.message) result.errors.push(err.message);
        
        if(path) {
            
            let redirect = M._.get(SITE.handlers, path, false);
            if(redirect && M.util.isFunction(redirect)) redirect(resolve, reject, Q, s, SITE, DB, result);
            
            
        }
        
    }
    
}

exports.edit_homepage = function(resolve, reject, Q, s, SITE, DB) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    
    let result      = SITE.admin.process.empty_result({errors: ['Akce se nezdařila.'], redirect: '/admin/edit_homepage'});
    
    if(Q.data.admin) {

        // get and check post data
        Q.post.then((data) => {
            
            if(data.fields) {
                
                Q.data.post = data.fields;
                return Promise.resolve();
                
            } else {
                
                return Promise.reject(data.error || {message: 'Chybí data'})
                
            }
            
        // UPDATE DATA
        }).then(() => {

            let updates = [];
            
            M._.forIn(Q.data.post, (value, name) => {
                
                console.log(name, value);
                updates.push(DB.CHANGE('content', {page: 'home', name: name}, {$set: {content: value}}));
                
            });
            
            return Promise.resolve().parallel(updates);
            
        }).then((update) => {
            
            console.log(update);
            
            result.ok           = 1;
            result.data         = update;
            SITE.handlers.admin.action.edit_homepage(resolve, reject, Q, s, SITE, DB, result); 
            
        // ERROR
        }).catch((error) => { 
            
            let code = error.code || '[hp_edit_2]';
            
            SITE.process.inner_redirect(error, code, 'admin.action.edit_homepage', '',  result, resolve, reject, Q, s, SITE, DB);
        
        });
        
    } else { 
        
        SITE.process.inner_redirect({message: 'Přístup odepřen.'}, '[hp_edit_1]', 'admin.action.edit_homepage', '',  result, resolve, reject, Q, s, SITE, DB);
        
    }
    
}

exports.contact_edit_content = function(resolve, reject, Q, s, SITE, DB) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    
    let result              = SITE.admin.process.empty_result({errors: ['Akce se nezdařila.']});
        result.redirect     = '/admin/home';
        result.handler_path = 'admin.action.home';
    
    if(Q.data.admin) {

        result.redirect     = '/admin/action/contact';
        result.handler_path = 'admin.action.contact';
        
        // get and check post data
        Q.post.then((data) => {
            
            if(data.fields) {
                
                Q.data.post = data.fields;
                return Promise.resolve();
                
            } else {
                
                return Promise.reject(data.error || {message: 'Chybí data'})
                
            }
            
        // UPDATE DATA
        }).then(() => {

            let updates = [];
            
            M._.forIn(Q.data.post, (value, name) => {
                
                console.log(name, value);
                updates.push(DB.CHANGE('content', {page: 'contact', name: name}, {$set: {content: value}}));
                
            });
            
            return Promise.resolve().parallel(updates);
            
        }).then((update) => {
            
            console.log(update);
            
            result.ok           = 1;
            result.data         = update;
            SITE.handlers.admin.action.contact(resolve, reject, Q, s, SITE, DB, result); 
            
        // ERROR
        }).catch((error) => { 
            
            let code = error.code || '[hp_edit_2]';
            
            SITE.process.inner_redirect(error, code, '', '',  result, resolve, reject, Q, s, SITE, DB);
        
        });
        
    } else { 
        
        SITE.process.inner_redirect({message: 'Přístup odepřen.'}, '[hp_edit_1]', '', '',  result, resolve, reject, Q, s, SITE, DB);
        
    }
    
}