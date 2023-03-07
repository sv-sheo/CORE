
function proof(mode = 'full') {
    
    this.result     = {success: true, errors: [], errors_full: {}, data: {}};
    this.subject    = {};
    this.mode       = mode; // 'full' or 'quick'; quick stops after first error
    
}

proof.prototype.prove = function(name, display_name, value) {
    
    this.subject = {name, display_name, value, rejected: false};
    
    return this;
    
}

proof.prototype.required = function(error_text = ' je povinná hodnota.') {
    
    if(!this.subject.rejected) {
        
        var valid       = this.subject.value ? true : false;
        
        if( !valid ) this.handle_error(error_text);
        
    }
    
    return this;
    
}

proof.prototype.is_email = function(error_text = ': Neplatná hodnota (špatný formát).') {
    
    if(!this.subject.rejected) {
        
        var email_regex = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
        var valid       = this.subject.value ? email_regex.test(this.subject.value) : true;
        
        if( !valid ) this.handle_error(error_text);
        
    }
    
    return this;
    
}

proof.prototype.regex = function(regex, error_text = ': Neplatná hodnota (špatný formát).') {
    
    if(!this.subject.rejected) {
        
        if(this.subject.value) {
        
            var valid       = regex ? regex.test(this.subject.value) : true;
        
        } else {
        
            var valid = true;
        
        }
        
        if( !valid ) this.handle_error(error_text);
        
    }
    
    return this;
    
}

proof.prototype.max_length = function(max_length = 1, error_text = ': příliš dlouhá hodnota.') {
    
    if(!this.subject.rejected) {
        
        var length  = (this.subject.value && this.subject.value.length) ? this.subject.value.length : 0;
        var valid   = length <= max_length ? true : false;
        
        if( !valid ) this.handle_error(error_text);
        
    }
    
    return this;
    
}

proof.prototype.min_length = function(min_length = 1, error_text = ': příliš krátká hodnota.') {
    
    if(!this.subject.rejected) {
        
        var length  = (this.subject.value && this.subject.value.length) ? this.subject.value.length : 0;
        var valid   = length >= min_length ? true : false;
        
        if( !valid ) this.handle_error(error_text);
        
    }
    
    return this;
    
}

proof.prototype.handle_error = function(error_text) {
    
    this.result.errors.push(this.subject.display_name + error_text);
    this.result.errors_full[this.subject.name] = this.result.errors_full[this.subject.name] || {display_name: this.subject.display_name, errors: []};
    this.result.errors_full[this.subject.name].errors.push(error_text);

    if(this.mode === 'quick') this.subject.rejected = true;

    this.result.success = false;
    
}

module.exports = proof;