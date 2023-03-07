

exports.mailus_finances = function(resolve, reject, Q, s, SITE, DB) {
    
    // required
    Q.data.request_id           = Q.id;
    Q.hook                      = 'none';
    
    Q.post.then((data) => {
       
        data = data.fields || {};
        
        let proof = new C.proof()
            .prove('text', 'Text', data.text).max_length(500)
            .prove('email', 'E-mail', data.email).is_email()
            .prove('phone', 'Telefon', data.phone).required().regex((/^[0-9]{3} [0-9]{3} [0-9]{3}$/), ' - neplatný formát.')
            .prove('post', 'PSČ', data.post).required().regex((/^[0-9]{3} [0-9]{2}$/), ' - neplatný formát.');
            
        
        s.content       = JSON.stringify(proof.result); // send back to JS

        let mail_html = SITE.views.mails.finances({data: data});
        
        // send mail
        if(proof.result.success) {
            
            let options =   { 
                                from:       {name: 'fiby.cz', address: 'info@fiby.cz'},              
                                to:         [{name: 'sheo', address: 'stipav@seznam.cz'}, {name: 'fiby.cz', address: 'info@fiby.cz'}, {name: 'ted', address: 't.volanek@seznam.cz'}],
                                subject:    'FIBY - '+data.type,                                         
                                text:       mail_html, 
                                html:       mail_html 
                            };
            
            B.B =   C.mail.send(options)
                    .then( (ress)=>{ console.log('MAIL RESULT FIBY', ress); return Promise.resolve(ress) })
                    .then(SITE.fiby.ajax.success_finish.args(s, resolve))
                    .catch(SITE.fiby.ajax.error_finish.args(s, reject));
            
        } else {
            
            SITE.fiby.ajax.success_finish(s, resolve, proof.result);
            
        }
        
    }).catch(SITE.fiby.ajax.error_finish.args(s, reject));
    
}

exports.mailus_living = function(resolve, reject, Q, s, SITE, DB) {
    
    // required
    Q.data.request_id           = Q.id;
    Q.hook                      = 'none';
    
    Q.post.then((data) => {
       
        data = data.fields || {};
        
        let proof = new C.proof()
            .prove('text', 'Text', data.text).required().max_length(500)
            .prove('email', 'E-mail', data.email).is_email()
            .prove('phone', 'Telefon', data.phone).required().regex((/^[0-9]{3} [0-9]{3} [0-9]{3}$/), ' - neplatný formát.')
            .prove('post', 'PSČ', data.post).required().regex((/^[0-9]{3} [0-9]{2}$/), ' - neplatný formát.');
            
        
        s.content       = JSON.stringify(proof.result); // send back to JS

        let mail_html = SITE.views.mails.living({data: data});
        
        // send mail
        if(proof.result.success) {
            
            let options =   { 
                                from:       {name: 'fiby.cz', address: 'info@fiby.cz'},              
                                to:         [{name: 'sheo', address: 'stipav@seznam.cz'}, {name: 'fiby.cz', address: 'info@fiby.cz'}, {name: 'ted', address: 't.volanek@seznam.cz'}],
                                subject:    'FIBY - '+data.type+' - '+data.topic,                                         
                                text:       mail_html, 
                                html:       mail_html 
                            };
            
            B.B =   C.mail.send(options)
                    .then( (ress)=>{ console.log('MAIL RESULT FIBY', ress); return Promise.resolve(ress) })
                    .then(SITE.fiby.ajax.success_finish.args(s, resolve))
                    .catch(SITE.fiby.ajax.error_finish.args(s, reject));
            
        } else {
            
            SITE.fiby.ajax.success_finish(s, resolve, proof.result);
            
        }
        
    }).catch(SITE.fiby.ajax.error_finish.args(s, reject));
    
}