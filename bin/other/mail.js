// DOCUMENTATION
// https://nodemailer.com/message/
//const pass          = C.ciphers.decrypt_sync(encrypted, CONFIG.core.code_geass);  

exports.setup_core = async function(previous_step={}) {

    if(previous_step.ok) {

        var result  = {ok: 0, data: {previous_step}, id: '[i42]', text:'', error: null};

        try {

            var pid     = C.server.worker_id ? 'WORKER '+C.server.worker_id : 'MASTER';
            var res1    = null;
            var res2    = null;

                    // 1. PROVIDER - NODEMAILER
                    // look into config whether mailer should be made for core server
                    if(CONFIG.core?.mail?.providers?.nodemailer?.enabled) {

                        if(CONFIG.core.mail.providers.nodemailer.user && CONFIG.core.mail.providers.nodemailer.pass && CONFIG.core.mail.providers.nodemailer.host && parseInt(CONFIG.core.mail.providers.nodemailer.port)) {

                            STATE.mailers['nodemailer']             = STATE.mailers['nodemailer'] || {};
                            STATE.mailers['nodemailer']['SERVER']   = C.mail.setup_nodemailer({...CONFIG.core.mail.providers.nodemailer, code_geass: CONFIG.core.code_geass});

                            res1 = {ok: 1, text: 'Mail [nodemailer] for core server successfully created ('+pid+').'};

                        } else { res1 = {ok: 0, text: 'Missing or invalid mail [nodemailer] config ('+pid+').', error: new Error('Missing or invalid mail [nodemailer] config.')}; }

                    } else { res1 = {ok: 1, text: 'Mail [nodemailer] is not enabled on core server ('+pid+').'}; }

                    // 2. PROVIDER - BREVO (formerly sendinblue)
                    // if api_key is empty, consider brevo to be disabled
                    // https://developers.brevo.com/recipes/send-transactional-emails-in-nodejs
                    // https://github.com/getbrevo/brevo-node
                    if(CONFIG.core?.mail?.providers?.brevo?.API_KEY) {

                        let brevo_API_KEY   = C.ciphers.decrypt_sync(CONFIG.core.mail.providers.brevo.API_KEY, CONFIG.core.code_geass); // 2021 encryption
                        let brevo_mailer    = new M.brevo.TransactionalEmailsApi();
                            brevo_mailer.authentications['apiKey'].apiKey = brevo_API_KEY;

                        STATE.mailers['brevo']              = STATE.mailers['brevo'] || {};
                        STATE.mailers['brevo']['SERVER']    = brevo_mailer;

                        res2 = {ok: 1, text: 'Mail [brevo] for core server successfully created ('+pid+').'};

                    } else { res2 = {ok: 1, text: 'Mail [brevo] is not enabled on core server ('+pid+').'}; }

            result.ok                       = (res1.ok && res2.ok) ? 1 : 0;
            result.text                     = res1.text + ' ---- || ---- '+res2.text;
            result.data.nodemailer_result   = res1;
            result.data.brevo_result        = res2;

            if( !res1.ok ) result.error     = res1.error;
            if( !res2.ok ) result.error     = res2.error;

        } catch(error) { result = {...result, id: '[e75]', text: 'Failed to setup core mailer - unknown error: '+error.message, error}; }

        C.logger.bootup_step(result);

        return result;

    } else { return previous_step; }

}

exports.setup_site = async function({site='', log=false, config={}}={}) {

    var result = {ok: 0, data: {}, id: '[i44]', text: '', error: null, errors: {}, site};

    try {

        if(site) {

                    // 1. PROVIDER - NODEMAILER - only 1 server instance per process (worker/master) - meaning that it cannot be run for more sites independently

                    // 2. PROVIDER - BREVO (formerly sendinblue)
                    if(config?.mail?.providers?.brevo?.API_KEY) {

                        let brevo_API_KEY   = C.ciphers.decrypt_sync(config.mail.providers.brevo.API_KEY, config.code_geass); // 2021 encryption
                        let brevo_mailer    = new M.brevo.TransactionalEmailsApi();
                            brevo_mailer.authentications['apiKey'].apiKey = brevo_API_KEY;

                        STATE.mailers['brevo']          = STATE.mailers['brevo'] || {};
                        STATE.mailers['brevo'][site]    = brevo_mailer;

                        result.ok   = 1;
                        result.text = 'Mail [brevo] for site '+site+' successfully created.';

                    } else { result = {ok: 1, text: 'Mail [brevo] is not provided for site '+site+'.'}; }

        } else { result = {...result, ok: 0, id: '[e77.1]', text: 'Mailer cannot be setup for empty site ('+site+').'}; }

    } catch(error) { result = {...result, id: '[e77]', text: 'Failed to load mailer for site '+site+': '+error.message, error};  }

    if(log) C.logger.bootup_step(result);

    return result;
    
};

exports.setup_nodemailer = function(mailer_config = {}) {

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

exports.send = async function(provider_name='', site='', options={}) {
    
    var result  = {ok: 0, data: {}, id: '[i43]', text:'', error: null};
    //  options for NODEMAILER  = {from: {name: '', address: ''}, to: [{name: '', address: ''}, ...], subject: '', text: '', html: ''};
    //  options for BREVO       = {sender: {name: '', email: ''}, to: [{name: '', email: ''}, ...], subject: '', text: '', html: '', reply_to: {name: '', email: ''}, headers: {}, params: {key: value, ...}};

    try {

        let provider    = STATE.mailers[provider_name];
        let transporter = provider?.[site] || provider?.['SERVER']; // site = SERVER for core server

        if(provider) {

            // NODEMAILER
            if(provider_name === 'nodemailer') {
                
                if(transporter && transporter.sendMail) {

                    var mail_result = await transporter.sendMail(options); // (options, callback) // if callback is omitted, promise is returned

                    result = {...result, ok: 1, text: 'E-mail successfully sent to '+mail_result.accepted.length+'/'+(options?.to?.length||0)+' recipients.', data: {mail_result}};

                } else { result = {...result, id: '[e76.2]', text: 'Failed to send e-mail - transporter not found.'}; }

            // BREVO
            } else if(provider_name === 'brevo') {
                
                if(transporter && transporter.sendTransacEmail) {

                    // https://developers.brevo.com/recipes/send-transactional-emails-in-nodejs
                    // https://github.com/getbrevo/brevo-node

                    let md              = new M.brevo.SendSmtpEmail(); // mail_data (sendSmtpEmail)
                        md.subject      = options.subject;
                        md.sender       = options.sender;
                        md.to           = options.to;
                        md.replyTo      = options.reply_to;
                        md.headers      = options.headers || { a: 'a'}; // params cannot be blank - otherwise brevo would throw an error
                        md.params       = options.params || { a: 'a'}; // params cannot be blank - otherwise brevo would throw an error

                        if(options.text) md.textContent  = options.text;
                        if(options.html) md.htmlContent  = options.html;

                        /* EXAMPLE 
                        md.subject      = "My {{params.subject}}";
                        md.htmlContent  = "<html><body><h1>Common: This is my first transactional email {{params.parameter}}</h1></body></html>";
                        OR md.textContent= "";
                        md.sender       = { "name": "sheo", "email": "info@sheo.cz" };
                        md.to           = [ { "email": "stipav@seznam.cz", "name": "štěpán veteŠník" } ];
                        md.replyTo      = { "email": "info@sheo.cz", "name": "sheo" };
                        md.headers      = { "Some-Custom-Name": "unique-id-1234" };
                        md.params       = { "parameter": "My param value", "subject": "common subject" };*/

                    let mail_result = await transporter.sendTransacEmail(md).catch(function(mail_error) { mail_error.is_error = true; return Promise.resolve(mail_error); } );

                    result.data.response = {statusCode: mail_result?.response?.statusCode, statusMessage: mail_result?.response?.statusMessage, body: mail_result.body};

                    if(result.data.response.statusCode === 201) {

                        result.ok   = 1;
                        result.text = 'E-mail successfully sent to '+(md.to.length)+' recipients.';

                    } else {

                        result.ok   = 0;
                        
                        if(mail_result.is_error) {

                            result.id   = '[e76.3]';
                            result.text = 'Failed to send e-mail via brevo: [statusCode '+mail_result.statusCode+'] ' + mail_result.message + ' - ' + mail_result.body?.code + ' - ' + mail_result.body?.message;
                            result.data.error = {message: mail_result.message, body: mail_result.body, statusCode: mail_result.statusCode};

                        } else {

                            result.id   = '[e76.4]';
                            result.text = 'Unknown brevo response while sending e-mail: [statusCode '+result.data.response.statusCode+'] '+ result.data.response.statusMessage;

                        }

                    }

                } else { result = {...result, id: '[e76.2]', text: 'Failed to send e-mail - transporter not found.'}; }

            } else { result = {...result, id: '[e76.1.1]', text: 'Failed to send e-mail - invalid provider name.'}; }

        } else { result = {...result, id: '[e76.1]', text: 'Failed to send e-mail - invalid provider.'}; }
    
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