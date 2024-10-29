
// setting up global M - modules
// can be extended further my by local modules

module.exports = {
    // CORE MODULES
    path:       require('path'),
    fs:         require('fs'),
    os:         require('os'),
    util:       require('util'),
    qs:         require('querystring'),
    url:        require('url'),
    zlib:       require('zlib'),
    events:     require('events'),
    stream:     require('stream'),
    net:        require('net'),
    http:       require('http'),
    https:      require('https'),
    crypto:     require('crypto'),
    stream:     require('stream'),
    cluster:    require('cluster'),
    net:        require('net'),
    child_process:require('child_process'),

    // NPM NODE MODULES
    proxy:      require('http-proxy'),
    make_request:require('postman-request'),
    cloudinary: require('cloudinary'),
    user_agent: require('ua-parser-js'),
    handlebars: require('handlebars'),
    country:    require('request-country'),
    negotiator: require('negotiator'), // parse accept-language headers
    json:       require('flatted'),
    tosource:   require('tosource'),
    moment:     require('moment'),
    mimes:      require('mime-types'),
    nodemailer: require('nodemailer'),
    socket_io:  require('socket.io'),
    ws:         require('ws'),          // not explicitly used, its employed by socket.io
    uuid:       require('uuid'),
    dotenv:     require('dotenv'),
    node_dir:   require('node-dir'),
    rethinkdb:  require('rethinkdb'),
    _:          require('lodash'),
    multiparty: require('multiparty'),   // parse POST data from rquest with form with enctype="multipart/form-data" - FILE UPLOAD, https://www.npmjs.com/package/multiparty
    brevo:      require('@getbrevo/brevo'), // MAILER (formerly sendinblue) https://app.brevo.com/

    // FILE MODULES
    //logger:     require('./logger')

};