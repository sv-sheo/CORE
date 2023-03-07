// DOCUMENTATION
// https://nodemailer.com/message/
//const pass          = C.ciphers.decrypt_sync(encrypted, CONFIG.core.code_geass);  

exports.setup_core = async function(previous_step={}) {

    if(previous_step.ok) {

        var result  = {ok: 0, data: {previous_step}, id: '[i42]', text:'', error: null};

        try {

            var pid = C.server.worker_id ? 'WORKER '+C.server.worker_id : 'MASTER';

            // look into config whether mailer should be made for core server
            if(CONFIG.core?.mailer?.enabled) {

                if(CONFIG.core.mailer.user && CONFIG.core.mailer.pass && CONFIG.core.mailer.host && parseInt(CONFIG.core.mailer.port)) {

                    STATE.mailers['__CORE__'] = C.mail.setup({...CONFIG.core.mailer, code_geass: CONFIG.core.code_geass});

                    result = {...result, ok: 1, text: 'Mailer for core server successfully created ('+pid+').'};

                } else { result = {...result, ok: 0, id: '[e75.1]', text: 'Missing or invalid mailer config ('+pid+').', error: new Error('Missing or invalid mailer config.')}; }

            } else { result = {...result, ok: 1, text: 'Mailer is not enabled on core server ('+pid+').'}; }

        } catch(error) { result = {...result, id: '[e75]', text: 'Failed to setup core mailer - unknown error: '+error.message, error}; }

        C.logger.bootup_step(result);

        return result;

    } else { return previous_step; }

}

exports.setup_site = async function({site='', log=false, config={}}={}) {

    var result = {ok: 0, data: {}, id: '[i44]', text: '', error: null, errors: {}, site};

    try {

        if(site) {

            // look into config whether mailer should be made for this site
            if(config?.mailer?.enabled) {

                if(config.mailer.user && config.mailer.pass && config.mailer.host && parseInt(config.mailer.port)) {

                    STATE.mailers[site] = C.mail.setup({...config.mailer, code_geass: config.code_geass});

                    result = {...result, ok: 1, text: 'Mailer for site '+site+' successfully created.', data: {mailer: STATE.mailers[site]}};

                } else { result = {...result, ok: 0, id: '[e77.2]', text: 'Missing or invalid mailer config.', error: new Error('Missing or invalid mailer config.')}; }

            } else { result = {...result, ok: 1, text: 'Mailer is not enabled on site '+site+'.'}; }

        } else { result = {...result, ok: 0, id: '[e77.1]', text: 'Mailer cannot be setup for empty site ('+site+').'}; }

    } catch(error) { result = {...result, id: '[e77]', text: 'Failed to load mailer for site '+site+': '+error.message, error};  }

    if(log) C.logger.bootup_step(result);

    return result;
    
};

exports.setup = function(mailer_config = {}) {

    var user    = mailer_config.user;
    var pass    = C.ciphers.decrypt_sync(mailer_config.pass, mailer_config.code_geass); // 2021 encryption

    var bypass_secure = mailer_config.bypass_secure ? true : false; // false for PRODUCTION, true for localhost (DEV)

    var data = {

        host:       mailer_config.host,
        port:       parseInt(mailer_config.port),
        secure:     mailer_config.secure ? true : false, // secure:true for port 465, secure:false for port 587
        auth:       {user, pass},
        
        tls: { rejectUnauthorized: !bypass_secure } // https://stackoverflow.com/questions/31861109/tls-what-exactly-does-rejectunauthorized-mean-for-me

    }

    return M.nodemailer.createTransport(data);

}

exports.send = async function(site='', options={}) {
    
    var result  = {ok: 0, data: {}, id: '[i43]', text:'', error: null};
    //  options = {from: {name: '', address: ''}, to: [{name: '', address: ''}, ...], subject: '', text: '', html: ''};

    try {

        var transporter = STATE.mailers[site] || STATE.mailers['__CORE__']; // site = __CORE__ for core server

        if(transporter && transporter.sendMail) {

            var mail_result = await transporter.sendMail(options); // (options, callback) // if callback is omitted, promise is returned

            result = {...result, ok: 1, text: 'E-mail successfully sent to '+mail_result.accepted.length+'/'+(options?.to?.length||0)+' recipients.', data: {mail_result}};

        } else { result = {...result, id: '[e76.1]', text: 'Failed to send e-mail - transporter not found.'}; }
    
    } catch(error) { result = {...result, id: '[e76]', text: 'Failed to send e-mail - unknown error: '+error.message, error}; }

    return result;

}

// ______________ LEGACY _________________

/*function authenticate() {

    // Special google password generated for this app, it can be accessed in the gmail account -> security -> app passwords (Prihlaseni do googlu -> hesla aplikaci)

    var code = 'sc7vjM4ht4e4r78';
    var pass = 'b539482bdf97876ecfbd040ae42f16fa:05420f58c47a6af0f054dffe20cb2424d779cfb7790d46526b7f17b9cebec9fd';
        pass = C.ciphers.decrypt_sync(pass, code); // 2021 encryption
    

    var auth =  {
                    user: 'stepan.vetesnik@gmail.com',
                    pass: pass,
                }

    return auth;

}*/

//var mailer_auth = authenticate();

// create reusable transporter object using the default SMTP transport
/*exports.transporter = M.nodemailer.createTransport({
    
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // secure:true for port 465, secure:false for port 587
    auth: mailer_auth,
    
    tls: { rejectUnauthorized: false } // https://stackoverflow.com/questions/31861109/tls-what-exactly-does-rejectunauthorized-mean-for-me
    
});*/

/*exports.send = function(options) {
    
    return C.mail.transporter.sendMail(options); // (options, callback) // if callback is omitted, promise is returned
    
}*/

// EXAMPLE
/*let options = {
    from:       '"Fred Foo 👻" <foo@blurdybloop.com>',            
    from:       {name: 'Fred', address: 'foo@blurdybloop.com'},
    to:         'stipav@seznam.cz, opajda@seznam.cz',               
    to:         [{name: 'sheo', address: 'stipav@seznam.cz'}, {address: 'opajda@seznam.cz'}],
    subject:    'Hello ✔',                                         
    text:       'Hello world ?', 
    html:       '<h1 style="color: crimson">TEST</h1><b>Hello world ?</b>' 
};

// send mail with defined transport object
transporter.sendMail(options, (error, info) => {
    if (error) {
        return console.log(error);
    }
    console.log('Message %s sent: %s', info.messageId, info.response);
});*/

/*

in CORE
C.mail.send(options)
    .then((data) => {
    
        console.log(M.util.inspect(data));
    
    }).catch((error) => {
    
        console.log(M.util.inspect(error));
    
    });

*/