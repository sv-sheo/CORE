

// HOME PAGE OF LOGGED IN ADMIN 
exports.test = function(resolve, reject, Q, s, SITE, DB) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    SITE.auth.pre.kick_not_logged_in(Q, s);     // kick to login page, if no admin is logged in

    Q.data.request_id   = Q.id;
    s.html              = SITE.views.admin.root(Q.data);
    
    resolve()
    
}

// HOME PAGE OF LOGGED IN ADMIN 
exports.upload_image = function(resolve, reject, Q, s, SITE, DB) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    
    let ret = {ok: 0, data: {}, error: 'Not authorized.'};
    
    if(Q.data.admin) {
    
        Q.post.then((data) => {
console.log(data);
            if( !data.error ) {

                // check allowed types
                let allowed_types   = {'image/jpeg': 1, 'image/png': 1, 'image/gif': 1, 'image/bnp': 1, 'image/tiff': 1}
                let is_allowed      = allowed_types[data.files.file.headers['content-type']] ? true : false;
                
                if(is_allowed) {
                    
                    ret.ok              = 1;
                    ret.error           = '';
                    ret.data.is_image   = true;
                    ret.data.filename   = M.path.basename(data.files.file.path);
                    ret.data.ext        = M.path.extname(data.files.file.path);
                    
                } else {
                    
                    ret.error = 'Nepovolený formát';
                    
                }

            } else {

                let known_errors= {ENOENT: 'Neplatná cesta k souboru.', ETOOBIG: 'Soubor je příliš velký.'};
                
                ret.error       = known_errors[data.error.code] || 'Neznáma chyba: '+data.error.message;
                ret.data.error  = data.error;

            }
        
            s.content = JSON.stringify(ret);
            resolve();

        }).catch(reject);
        
    } else {
        
        s.content = JSON.stringify(ret);
        resolve();
        
    }
    
}

exports.house_edit_image = function(resolve, reject, Q, s, SITE, DB) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    
    let ret = {ok: 0, data: {}, error: 'Not authorized.'};
    
    if(Q.data.admin) {
    
        Q.post.then((data) => {
            
            if( !data.error ) {

                // check allowed types
                let allowed_types   = {'image/jpeg': 1, 'image/png': 1, 'image/gif': 1, 'image/bnp': 1, 'image/tiff': 1}
                let is_allowed      = allowed_types[data.files.file.headers['content-type']] ? true : false;
                
                if(is_allowed) {
                    
                    // GET HOUSE
                    let id = parseInt(Q.params.id) || 0;

                    DB.GET('houses', {id: id})
                    .then((house) => {

                        if(house.size === 1) {

                            house               = SITE.process.get_first(house);

                            //decide what to do
                            let type            = Q.query.type;
                            let i               = parseInt(Q.query.i) || 0;
                            let filename        =  M.path.basename(data.files.file.path);
                            let ext             = M.path.extname(data.files.file.path);
                            
                            let house_dir       = M.path.join(SITE.config.root, SITE.config.files.dir, 'images/houses/'+house.id+'/');
                            let temp_name       = M.path.join(SITE.config.root, SITE.config.files.dir, 'temp', filename);
                            let new_name        = 'noname'+ext;

                            // if one of these
                            if({title: 1, title_sketch: 1, plan: 1, plan_2: 1}[type]) new_name = M.path.join(house_dir+type+ext);
                            if(type === 'other') new_name = M.path.join(house_dir+i+'_other'+ext);

                            SITE.admin.process.file.move_file(temp_name, new_name)
                            .then((res) => {
                                
                                let change = {$set: {images: house.images}};
                                
                                // update DB
                                if({title: 1, title_sketch: 1, plan: 1, plan_2: 1}[type]) change.$set.images[type] = type+ext;
                                
                                if(type === 'other') change.$set.images.other[i] = i+'_other'+ext;
                                
                                return DB.CHANGE('houses', {id: house.id}, change);
                                
                            }).then((res) => {
                                
                                ret.ok              = res.result.ok;
                                ret.error           = res.result.ok ? '' : 'Chyba databáze.';
                                ret.data.is_image   = true;
                                ret.data.pathname   = Q.data.HOST+'files/get/images/houses/'+house.id+'/'+M.path.basename(new_name)+'?cache=refresh';
                                ret.data.ext        = ext;
                                
                                s.content = JSON.stringify(ret);
                                resolve();
                                
                            }).catch((error) => {
                                
                                
                                ret.error           = error.message || 'Neznámá chyba';
                                ret.data.error      = error;
                                
                                s.content = JSON.stringify(ret);
                                resolve();
                                
                            });
                            
                        } else { 
                            
                            ret.error = 'Tento dům neexistuje'; 
                            s.content = JSON.stringify(ret);
                            resolve();
                        
                        }
                        
                    }).catch(reject);
                    
                } else {
                    
                    ret.error = 'Nepovolený formát';
                    s.content = JSON.stringify(ret);
                    resolve();
                    
                }

            } else {

                let known_errors= {ENOENT: 'Neplatná cesta k souboru.', ETOOBIG: 'Soubor je příliš velký.'};
                
                ret.error       = known_errors[data.error.code] || 'Neznáma chyba: '+data.error.message;
                ret.data.error  = data.error;

                s.content = JSON.stringify(ret);
                resolve();
                
            }

        }).catch(reject);
        
    } else {
        
        s.content = JSON.stringify(ret);
        resolve();
        
    }
    
}

exports.house_remove_image = function(resolve, reject, Q, s, SITE, DB) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    
    let ret = {ok: 0, data: {}, errors: ['Not authorized.']};
    
    if(Q.data.admin) {
        
        let type    = Q.query.type;
            type    = ['title', 'title_sketch', 'plan', 'plan_2', 'other'].indexOf(type) === -1 ? false : type;
        let name    = Q.query.name;
        let i       = parseInt(Q.query.i) || 0;
        
        if(type && name) {
            
            // GET HOUSE
            let id = parseInt(Q.params.id) || 0;

            DB.GET('houses', {id: id})
            .then((house) => {
                
                house           = SITE.process.get_first(house);
                Q.data.house    = house;
                
                if(house.id) {
                    
                    let path = M.path.join(SITE.config.root, SITE.config.files.dir, 'images/houses/'+house.id+'/'+name) || 'non.existent';
                    
                    return M.fs.unlink_async(path);
                    
                } else {
                    
                    return Promise.reject({message: 'Tento dům neexistuje.'});
                    
                }
                
            // update DB
            }).then((res) => {
                
                let change = {$set: {images: Q.data.house.images}}
                
                if(type === 'other') {
                    
                   change.$set.images.other[i] = '';
                    
                } else {
                    
                    change.$set.images[type] = '';
                    
                }
                
                return DB.CHANGE('houses', {id: Q.data.house.id}, change);
                
            // SUCCESS
            }).then((res) => {
                
                ret.ok      = 1;
                ret.errors  = [];
                ret.data    = res;
                s.content       = JSON.stringify(ret);
                resolve();
                
            // ERROR
            }).catch((error) => {
               
                ret.errors.push(error.message);
                ret.data        = error;
                s.content       = JSON.stringify(ret);
                resolve();
                
            });
            
        // no type
        } else { ret.errors = ['Missing type or name.']; s.content = JSON.stringify(ret); resolve();}
        
    // no admin
    } else { s.content = JSON.stringify(ret); resolve(); }
    
}

exports.carousel_image = function(resolve, reject, Q, s, SITE, DB) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    
    let ret = {ok: 0, data: {}, error: 'Not authorized.'};
    
    if(Q.data.admin) {
    
        Q.post.then((data) => {
            
            if( !data.error ) {

                // check allowed types
                let allowed_types   = {'image/jpeg': 1, 'image/png': 1, 'image/gif': 1, 'image/bnp': 1, 'image/tiff': 1}
                let is_allowed      = allowed_types[data.files.file.headers['content-type']] ? true : false;
                
                if(is_allowed) {
                    
                    if(data.files && data.files.file && data.files.file.path) {
                    
                        let filename        = M.path.basename(data.files.file.path);
                        let ext             = M.path.extname(data.files.file.path);

                        let i               = parseInt(Q.query.i) || 0;
                        let carousels_name  = Q.query.carousel;
                        let carousels_dir   = M.path.join(SITE.config.root, SITE.config.files.dir, 'images', 'carousels', carousels_name);
                        let temp_name       = M.path.join(SITE.config.root, SITE.config.files.dir, 'temp', filename);
                        
                        let prefix          = i < 10 ? '00' : '0';
                        let new_name        = prefix + i + '_' + filename;
                        let new_path        = M.path.join(carousels_dir, new_name);

                        SITE.admin.process.file.move_file(temp_name, new_path)
                        .then((res) => {
                            
                            // remove previous image, if any. Do not wait for result of removal
                            let previous_image  = Q.query.image;
                            if( previous_image) M.fs.unlink_async(M.path.join(carousels_dir, previous_image));
                            
                            ret.ok              = 1;
                            ret.data.result     = res;
                            ret.data.is_image   = true;
                            ret.data.pathname   = Q.data.HOST+'files/get/images/carousels/'+carousels_name+'/'+new_name+'?cache=refresh';
                            ret.data.ext        = ext;

                            s.content = JSON.stringify(ret);
                            resolve();

                        }).catch((error) => {


                            ret.error           = error.message || 'Neznámá chyba';
                            ret.data.error      = error;

                            s.content = JSON.stringify(ret);
                            resolve();

                        });

                    } else {

                        ret.error = 'Chybí data.';
                        s.content = JSON.stringify(ret);
                        resolve();

                    }
                    
                } else {
                    
                    ret.error = 'Nepovolený formát.';
                    s.content = JSON.stringify(ret);
                    resolve();
                    
                }

            } else {

                let known_errors= {ENOENT: 'Neplatná cesta k souboru.', ETOOBIG: 'Soubor je příliš velký.'};
                
                ret.error       = known_errors[data.error.code] || 'Neznáma chyba: '+data.error.message;
                ret.data.error  = data.error;

                s.content = JSON.stringify(ret);
                resolve();
                
            }

        }).catch(reject);
        
    } else {
        
        s.content = JSON.stringify(ret);
        resolve();
        
    }
    
}

exports.remove_carousel_image = function(resolve, reject, Q, s, SITE, DB) {
    
    SITE.auth.pre.get_admin(Q, s);              // fills Q.data.admin       false if no admin
    
    let ret = {ok: 0, data: {}, errors: ['Not authorized.']};
    
    if(Q.data.admin) {
        
        let image       = Q.query.image;
        let carousel    = Q.query.carousel;
        
        if(image && carousel) {
            
            let path    = M.path.join(SITE.config.root, SITE.config.files.dir, 'images', 'carousels', carousel, image);
                    
            M.fs.unlink_async(path)
            .then((res) => {
                
                ret.ok          = 1;
                ret.errors      = [];
                ret.data.result = res;
                s.content       = JSON.stringify(ret);
                resolve();
                
            // ERROR
            }).catch((error) => {
               
                ret.errors.push(error.message);
                ret.data        = error;
                s.content       = JSON.stringify(ret);
                resolve();
                
            });
            
        // no type
        } else { ret.errors = ['Missing image or carousel.']; s.content = JSON.stringify(ret); resolve();}
        
    // no admin
    } else { s.content = JSON.stringify(ret); resolve(); }
    
}



















