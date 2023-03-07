
exports.default_change = function({value, input, field, lang, set_form}) {

	var valid 			= S.other.validation.run(value, input.validation, lang);
	var value_object	= {...valid}; // {value, valid, error, text} 
	var action 			= {type: 'input', value_object, field: input.name};

	//console.log('[DEFAULT HANDLER] CHANGING INPUT '+input.name+' from '+field.value+' to '+valid.value);

	set_form(action);

}


exports.settings_input_change = function({value, input, field, lang, set_form, set_remote, remote, init, segment, settings, set_settings, rights, dummy}) {

	if(!remote.sending) {

		var l = WH.locales.GET(lang, 'content.general');

		if(rights.write || init) {

			var valid 			= S.other.validation.run(value, input.validation, lang);
			var value_object	= {...valid}; // {value, valid, error, text} 
			var action 			= {type: 'input', value_object, field: input.name};

			if(valid.valid) {

				set_form(action);

				//console.log('[SETTINGS HANDLER] CHANGING INPUT '+input.name+' from '+field.value+' to '+valid.value, action);
				// send to server if not dummy
				if(!dummy) {

					if(!init) {

						if(remote.timeout) window.clearTimeout(remote.timeout);

						var timeout_ms	= 800;
						var timeout 	= valid.valid ? window.setTimeout(function() {S.settings.save_setting({value_object, input, remote, set_remote, set_form, segment, settings, set_settings, rights, dummy, lang})}, timeout_ms) : 0;

						var remote_action = {type: 'set_timeout', timeout: timeout}; // resets timeout or cancels it, depending if new value is valid or not

						set_remote(remote_action);

					}

				// dummy is true, do not send to server
				} else {

					var new_settings = _.cloneDeep(settings);
						new_settings[segment][input.name] = value_object.value;

					set_settings(new_settings);

					if(!init) {

						set_remote({type: 'set_remote', result: {sending: 0, sent: 1, result: {ok: 1, error: ''}}});

						window.setTimeout(()=>{ set_remote({type: 'set_sent_off'}); }, 2000);

					}

				}

			} else { 
            
				var original_value 				= field.value;
					value_object.value 			= original_value;
					value_object.original_value = original_value;

				set_form({type: 'input', field: input.name, value_object}); 
			
			}

		} else { 
            
			var original_value 	= field.value;
			var value_object 	= {value: original_value, valid: 0, error: l.not_authorized, text: '', original_value};
            set_form({type: 'input', field: input.name, value_object}); 
        
        }

	}

}

exports.settings_right_change = function({type, value, input, lang, set_form, set_remote, remote, init, rights, set_rights}) {

	remote 		= remote.right;
	set_remote 	= set_remote.right;

	if(!remote.sending) {

		var options 		= {public: 1, limited: 1, private: 1} // none: 1 - used only by sheo (directly in DB)
			value 			= options[value] ? value : 'private';
		var value_object	= {value, valid: true, text: '', error: ''};
		var action 			= {type: 'input', value_object, field: input.name};

		set_form(action);

		if(!init) {

			S.settings.save_right({type, value_object, input, remote, set_remote, set_form, lang});

		}

	}

}

exports.settings_right_souls_change = function({type, value, input, lang, field, set_form, set_remote, remote, init}) {

	remote 		= remote.right_souls;
	set_remote 	= set_remote.right_souls;

	if(!remote.sending) {

			value 			= value.substring(0,64); // max 64 chars
		var souls_regex 	= /[^0-9\,]/g; // allow only digits and commas "15,789,45,145,55,69"
		var valid 			= !souls_regex.test(value);
		var errors 			= {cz: 'Neplatný formát (<ID>,<ID>,<ID>)', en: 'Invalid format (<ID>,<ID>,<ID>)', de: 'ungültiges Format (<ID>,<ID>,<ID>)'}
		var error 			= valid ? '' : (errors[lang] || errors.en);
		var value_object	= {valid, value, error, text:''}; // {value, valid, error, text} 
		var action 			= {type: 'input', value_object, field: input.name};

		set_form(action);

		if(!init) {
			
			if(remote.timeout) window.clearTimeout(remote.timeout);

			var timeout_ms	= 800;
			var timeout 	= valid ? window.setTimeout(function() {S.settings.save_right_souls({type, value_object, input, remote, set_remote, set_form, lang})}, timeout_ms) : 0;

			var remote_action = {type: 'set_timeout', timeout: timeout}; // resets timeout or cancels it, depending if new value is valid or not

			set_remote(remote_action);

		}

	}

}

exports.settings_right_link_change = function({type, input, field, set_form, set_remote, remote, init}) {

	remote 		= remote.right_link;
	set_remote 	= set_remote.right_link;

	if(!remote.sending) {

		var old_value = init ? input.init_value : field.value;
		var new_value;  // if old_value = '', generate new value (link) on the server, of old value is an existing link, remove this link from the server;
		var promise;

		if( !init ) {

			promise = S.settings.save_rights_link({type, remote, set_remote})
								.then((result)=>{

									new_value	= result.ok ? result.data.new_link : old_value;

									set_remote({type: 'set_remote', result: {sending: 0, sent: 1, result}});
						
									// if success, hide success message after 2 seconds, otherwise leave the error displayed till next action
									if(result.ok) window.setTimeout(()=>{ set_remote({type: 'set_sent_off'}); }, 2000);

								});

		// when INITing, do not send anything to the server, just update the local state from undefined to current value
		} else { promise = Promise.resolve().then(()=>{new_value = old_value; }); }

		promise.then(()=>{

			var access_link 	= new_value ? WH.HOST+(WH.APP_URL.substring(1))+'?xcslnk='+new_value : '';
			var value_object	= {value: new_value, valid: true, error: '', text: access_link}; // {value, valid, error, text} 
			var action 			= {type: 'input', value_object, field: input.name};

			set_form(action);

		})

	}

}