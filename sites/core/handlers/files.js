
exports.get_file = async function({Q, s, SITE}) {

    // if request is a subrequest, leave it, otherwise remove hooks
    if(Q.hook !== 'sub') Q.hook = 'none';

    var params      = C.helper.request.get_file_path_from_params({params: Q.params}); // {file_path, file_name, path_parts, is_private}
    var file_path   = M.path.join(SITE.config.root, SITE.config.files.dir, params.file_path);
    var file_name   = M.path.basename(params.file_path);
    var is_private  = params.is_private;
    var file_stats  = null;
    var result      = {ok: 1, data: {}};

    try {           file_stats          = await M.fs.stat_async(file_path); }
    catch(e) {  var file_stats_error    = e; }

    if(file_stats) {

        var content_type    = M.mimes.lookup(file_name) || 'application/octet-stream';
        var ext             = M.path.extname(file_name);// '.jpg'
        var cache_for       = parseInt(Q?.query?.cache) || 2592000;// via url?cache=<seconds>; default 30 days
        var is_directory    = ext ? false : true;

         //console.log('GOT FILE OR DIRECTORY: ', file_name, ext, content_type, file_path);

        // FORBIDDEN
        if( is_directory || is_private ) {
            
            var content         = Q.hook === 'sub' ? '' : C.sites.error_page('403 ACCESS FORBIDDEN');
            var content_type    = Q.hook === 'sub' ? 'text/plain' : 'text/html';

            C.response.quick_response({s, code: 403, message: '403 Acess Forbidden', content, content_type});
            
        } else {

            var last_modified   = file_stats.mtime.toUTCString(); // data.mtimeMs for milliseconds
            var ETAG            = C.ciphers.hash_sha256(last_modified);
            var if_none_match   = Q.headers['if-none-match'] || '';
            
            // FILE IS IN CACHE
            if(if_none_match) { 

                Q.hook = 'none'; 
                C.response.quick_response({s, code: 304, message: '304 Not Modified', content: '', content_type: 'text/plain'}); 
            
            } else {
            
                // FILE NOT IN CACHE, decide if to cache it
                if(cache_for > 0) {
                    
                    var now_ms      = parseInt(M.moment().format('x'));
                    var expired_ms  = now_ms + (cache_for*1000);            
                    var expired     = M.moment(expired_ms).toISOString(); 
                    
                    s.setHeader('Cache-Control', 'max-age='+cache_for+', must-revalidate, public');
                    s.setHeader('ETag', '"'+ETAG+'"');
                    s.setHeader('Expires', expired+' GMT');
                    
                    // in CHROME DEVTOOLS - network tab - click on given request and response and request headers will show up
                    
                } else { s.setHeader('Cache-Control', 'no-store'); }

                s.setHeader('Content-Type',     content_type);
                s.setHeader('Content-Length',   file_stats.size);
                s.setHeader('Last-Modified',    last_modified);
                //s.setHeader('Access-Control-Allow-Origin', '*');
                s.writeHead(200);
                s.result = {code: 200, handled: true, message: '200 Request handled by site.'};

                // send file to the client
                var stream = M.fs.createReadStream(file_path);
                    stream.pipe(s);

                // not needed
                /*stream.on('end', function() {

                    //console.log('ended file response on ' + file_path);
                    //s.end(); // not needed, the stream.end = s.end;

                });*/
                // stream.on events: 'close', 'error', 'pause', 'resume', 'readable', 'data'

                // finish request and trigger hooks upon sending whole file
                result.data.file_send = '[i39] File ['+file_path+'] was succesfully sent to the client.'

            }

        }

    // FILE NOT FOUND
    } else {

        result.data.file_stats = file_stats_error;
                
        // in case of subrequest, do not show any body, or error page
        var content         = Q.hook === 'sub' ? '' : C.sites.error_page('404 FILE NOT FOUND', M.util.inspect(err));
        var content_type    = Q.hook === 'sub' ? 'text/plain' : 'text/html';

        C.response.quick_response({s, code: 404, message: '404 Not Found', content, content_type}); 

    }

    return result;

    
};