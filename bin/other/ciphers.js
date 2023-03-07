
// GUIDES
// https://dev.to/alexadam/encrypt-and-decrypt-in-nodejs-3o0p
// https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81
// https://nodejs.org/api/crypto.html#cryptocreatecipherivalgorithm-key-iv-options
// 09/2022 - replaced .substr() with .slice()

var algorithm = 'aes-256-cbc';

module.exports.encrypt_sync = function(text, key = 'sc7vjM4yOYfD4r78') {

    var key         = M.crypto.createHash('sha256').update(key).digest('base64').slice(0, 32);
    var iv          = M.crypto.randomBytes(16);
    var cipher      = M.crypto.createCipheriv(algorithm, key, iv);
    var encrypted   = cipher.update(text);
        encrypted   = Buffer.concat([encrypted, cipher.final()]);

    var final       = iv.toString('hex') + ':' + encrypted.toString('hex');

    return final;

};

module.exports.decrypt_sync = function(encrypted, key = 'sc7vjM4yOYfD4r78') {


    var text_parts  = encrypted.split(':');
    var iv          = Buffer.from(text_parts.shift(), 'hex');
    var to_decrypt  = Buffer.from(text_parts.join(':'), 'hex');
    
    //key         = Buffer.from(key, 'utf8');
    var key         = M.crypto.createHash('sha256').update(key).digest('base64').slice(0, 32);
    var decipher    = M.crypto.createDecipheriv(algorithm, key, iv);
    var decrypted   = decipher.update(to_decrypt);
    var decrypted_  = Buffer.concat([decrypted, decipher.final()]);
    var final       = decrypted_.toString();

    return final;

};

// DEPRECATED
/*var algorithm = 'aes256';

module.exports.encrypt_sync = function(text, key = 'sc7vjM4yOYfD4r78') {

        key         = Buffer.from(key, 'utf8');
    var cipher      = M.crypto.createCipher(algorithm,key);
    var encrypted   = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');

    return encrypted;

};

module.exports.decrypt_sync = function(encrypted, key = 'sc7vjM4yOYfD4r78') {

        key         = Buffer.from(key, 'utf8');
    var decipher    = M.crypto.createDecipher(algorithm,key);
    var decrypted   = decipher.update(encrypted,'hex');
        decrypted  += decipher.final();
        decrypted   = decrypted.toString(); // buffer

    return decrypted;

};*/
module.exports.hash_sha256 = function(string='') {
    
    if(string) {
        
        string = M.crypto.createHash('sha256').update(string).digest('hex');
        
    }
    
    return string;
    
}