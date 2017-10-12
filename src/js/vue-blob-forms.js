/**
 * Form Validation
 *
 * This is a Vue plugin for providing form validation.
 *
 * @version 0.1.0
 * @author Blobfolio, LLC <hello@blobfolio.com>
 * @package vue-blob-forms
 * @license WTFPL <http://www.wtfpl.net>
 *
 * @see https://blobfolio.com
 * @see https://github.com/Blobfolio/vue-blob-forms
 */
(function () {

	// The plugin!
	var BlobFormsVue = {};
	BlobFormsVue.install = function (Vue, options) {

		// -------------------------------------------------------------
		// Setup
		// -------------------------------------------------------------

		// Improved validation patterns.
		var regexEmail = new RegExp(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);

		// It is too easy to lose the vnode context with Vue directives.
		var $scope = {};

		// This will hold our form states.
		Vue.prototype.blobForms = {};
		Vue.prototype.blobFields = {};
		Vue.prototype.blobErrors = {};

		// ------------------------------------------------------------- end setup



		// -------------------------------------------------------------
		// Directives
		// -------------------------------------------------------------

		/**
		 * v-form
		 *
		 * The main form validation directive.
		 */
		Vue.directive('form', {
			id: 'form',
			priority: 999999,
			/**
			 * Element with this directive has fully landed in the DOM.
			 *
			 * @param DOMElement $el Element.
			 * @param object $binding Vue data.
			 * @param object $vnode Vue node.
			 * @return void Nothing.
			 */
			inserted: function(el, binding, vnode) {
				var name = _isForm(el);
				if (!name) {
					return;
				}

				// Don't want to validate the form the usual way.
				el.setAttribute('novalidate', true);

				// Save the scope so we have it later.
				$scope[name] = vnode.context;

				// Set up the form object.
				Vue.set(vnode.context.blobForms, name, {
					name: name,
					el: el,
					changed: false,
					touched: false,
					valid: true,
					$lock: false,
				});

				// Make sure the field and errors tables have entries.
				if (typeof vnode.context.blobFields[name] === 'undefined') {
					Vue.set(vnode.context.blobFields, name, {});
				}
				if (typeof vnode.context.blobErrors[name] === 'undefined') {
					Vue.set(vnode.context.blobErrors, name, {});
				}

				// Force Vue to update as it doesn't tend to notice deep
				// object changes right away.
				vnode.context.$forceUpdate();

				// Watch for element changes. This code block is largely
				// a duplicate of _loadFields(), but Vue has trouble
				// setting data correctly when this particular piece is
				// passed to another function.
				var observer = new MutationObserver(_debounce(function(mutations) {
					// Set up some variables.
					var fieldKeys = Object.keys(vnode.context.blobFields[name]),
						errorKeys = Object.keys(vnode.context.blobErrors[name]),
						fieldName,
						tmp;

					var newFields = {},
						removedFields = {};

					// Loop through mutations.
					for (i=0; i<mutations.length; i++) {

						// New fields?
						for (j=0; j<mutations[i].addedNodes.length; j++) {
							// The added node might itself be a field,
							// or it might be a wrapper containing
							// field(s). Have to annoyingly search to
							// see.
							fieldName = _isField(mutations[i].addedNodes[j]);
							if (fieldName) {
								if (typeof removedFields[fieldName] !== 'undefined') {
									delete(removedFields[fieldName]);
								}
								newFields[fieldName] = mutations[i].addedNodes[j];
							}
							else {
								try {
									tmp = mutations[i].addedNodes[j].querySelectorAll('input, select, textarea');
									if (tmp.length) {
										for (k=0; k<tmp.length; k++) {
											fieldName = _isField(tmp[k]);
											if (fieldName) {
												if (typeof removedFields[fieldName] !== 'undefined') {
													delete(removedFields[fieldName]);
												}
												newFields[fieldName] = tmp[k];
											}
										}
									}
								} catch (Ex) {}
							}
						}

						// Removed fields?
						for (j=0; j<mutations[i].removedNodes.length; j++) {

							// The removed node might itself be a field,
							// or it might be a wrapper containing
							// field(s). Have to annoyingly search to
							// see.
							fieldName = _isField(mutations[i].removedNodes[j]);
							if (fieldName) {
								if (typeof newFields[fieldName] !== 'undefined') {
									delete(newFields[fieldName]);
								}
								removedFields[fieldName] = mutations[i].removedNodes[j];
							}
							else {
								try {
									tmp = mutations[i].removedNodes[j].querySelectorAll('input, select, textarea');
									if (tmp.length) {
										for (k=0; k<tmp.length; k++) {
											fieldName = _isField(tmp[k]);
											if (fieldName) {
												if (typeof newFields[fieldName] !== 'undefined') {
													delete(newFields[fieldName]);
												}
												removedFields[fieldName] = tmp[k];
											}
										}
									}
								} catch (Ex) {}
							}
						}
					}

					// Did we collect any noteworthy mutations?
					var newFieldKeys = Object.keys(newFields),
						removedFieldKeys = Object.keys(removedFields);

					// Loop through and setup new fields.
					for (i=0; i<newFieldKeys.length; i++) {
						fieldName = newFieldKeys[i];

						// But only if the field isn't already in the
						// data.
						if (fieldName && fieldKeys.indexOf(fieldName) === -1) {
							fieldKeys.push(fieldName);
							var newField = newFields[newFieldKeys[i]];

							Vue.set($scope[name].blobFields[name], fieldName, {
								name: fieldName,
								el: newField,
								originalValue: _checksum(newField.value),
								changed: false,
								touched: false,
								valid: true,
								$lock: false,
							});

							// Bind an input listener to monitor blur,
							// AKA what we're calling "touched".
							/* jshint ignore:start */
							newField.addEventListener('blur', function (e) {
								Vue.nextTick(function() {
									_validateField(el, e.target, true);
								});
							});
							/* jshint ignore:end */
						}
					}

					// Loop through and remove old fields.
					for (i=0; i<removedFieldKeys.length; i++) {
						fieldName = removedFieldKeys[i];

						// Remove event listeners.
						try {
							var fieldEvents = getEventListeners(removedFields[removedFieldKeys[i]]);
							for (j=0; j<fieldEvents.length; j++) {
								fieldEvents[j].remove();
							}
						} catch (Ex) {}

						// Remove field.
						if (fieldKeys.indexOf(fieldName) !== -1) {
							Vue.delete($scope[name].blobFields[name], fieldName);
						}
						// Remove error.
						if (errorKeys.indexOf(fieldName) !== -1) {
							Vue.delete($scope[name].blobErrors[name], fieldName);
						}
					}

					// Force Vue to update as it doesn't tend to notice
					// deep object changes right away.
					if (newFields.length || removedFieldKeys.length) {
						vnode.context.$forceUpdate();
						_updateFormClasses(el);
					}
				}, 50));
				observer.observe(el, {childList: true, subtree: true});

				// Bind an input listener to monitor changes, but only
				// act if we have an INPUT or TEXTAREA field.
				el.addEventListener('input', _debounce(function (e) {
					Vue.nextTick(function() {
						if ((e.target.tagName !== 'SELECT') && (false !== _isField(e.target))) {
							_validateField(el, e.target, true);
						}
					});
				}, 100));

				// For SELECT fields, we'll use a change listener
				// instead. This fixes a bug with Vue + Chrome.
				el.addEventListener('change', _debounce(function (e) {
					Vue.nextTick(function() {
						if ((e.target.tagName === 'SELECT') && (false !== _isField(e.target))) {
							// The timeout fixes another SELECT bug,
							// this one affecting Edge. Haha.
							setTimeout(function(){
								_validateField(el, e.target, true);
							}, 50);
						}
					});
				}, 100));

				// Let's assume we have no fields yet and load our data.
				Vue.nextTick(function(){
					_loadFields(el);
					Vue.nextTick(function() {
						_validateForm(el);
					});
				});

				// And done!
				return true;
			},
		});

		/**
		 * v-gravatar
		 *
		 * Find the Gravatar icon associated with an email address.
		 *
		 * @param int $size Icon size.
		 */
		Vue.directive('gravatar', {
			id: 'gravatar',
			priority: 50000,
			inserted: function(el, binding, vnode) {
				// This must be an email field.
				if (
					el.nodeName &&
					(el.nodeName === 'INPUT') &&
					(el.getAttribute('type') === 'email')
				) {
					var size = parseInt(binding.value, 10) || 0,
						gravatar = 'https://www.gravatar.com/avatar/';

					// Make sure the size makes sense.
					if (size <= 0) {
						size = 80;
					}

					var updateEmail = _debounce(function(){
						// Make sure the field value makes sense.
						var email = (el.value || '').trim().toLowerCase(),
							hash = '334c4a4c42fdb79d7ebc3e73b517e6f8',
							oldHash = el.dataset.hash || '';

						// Calculate the hash if the email seems
						// email-like.
						if (email && !!regexEmail.test(email)) {
							hash = _md5(email);
						}

						// Set it!
						if (hash !== oldHash) {
							el.setAttribute('data-hash', hash);
							el.style.backgroundImage = 'url(' + gravatar + hash + '?s=' + size + '&d=blank)';
						}
					}, 500);

					// Bind a listener so we can update the image as the
					// user types.
					Vue.nextTick(function(){
						el.addEventListener('input', updateEmail);
						updateEmail();
					});
				}
			}
		});

		/**
		 * v-phone
		 *
		 * Extended handling for telephone numbers. This requires the
		 * blob-phone.js library.
		 *
		 * @see https://github.com/Blobfolio/blob-phone
		 *
		 * @param string $country Country code.
		 */
		Vue.directive('phone', {
			id: 'phone',
			priority: 50000,
			inserted: function(el, binding, vnode){
				// This must be a telephone field.
				if (
					!el.nodeName ||
					(el.nodeName !== 'INPUT') ||
					(el.getAttribute('type') !== 'tel')
				) {
					return;
				}

				// The blob-phone library must be loaded.
				if (!('blobPhone' in window)) {
					console.warn('v-phone requires the blob-phone Javascript library.' + "\n" + 'https://github.com/Blobfolio/blob-phone#javascript');
					return;
				}

				// Sort out the default country.
				var defaultCountry = (binding.value || '').toUpperCase() || 'US';
				if (defaultCountry.length !== 2) {
					defaultCountry = 'US';
				}

				// Our update handler.
				var updatePhone = _debounce(function(){
					// Make sure the field value makes sense.
					var value = (el.value || '').trim(),
						valueNew = '',
						valid = false,
						country = el.dataset.country || '',
						countryNew = '';

					// First, come up with a formatted value, if
					// possible.
					if (value.length) {
						var parsed = blobPhone.parse(value, defaultCountry);
						if (false !== parsed) {
							valueNew = parsed.number;
							countryNew = parsed.country;
							valid = true;

							// Already checked, already fine.
							if (
								(parsed.number === el.dataset.blobPhoneValue) &&
								(country === countryNew)
							) {
								return;
							}
						}
					}

					if (valid) {
						if (value !== valueNew) {
							// We have to figure out what the model is,
							// and break it down into something Vue can
							// process.
							/* jshint ignore:start */
							var model = _getModelName(vnode);
							model = ('vnode.context.' + model).split('.');
							var modelTop = model.pop();
							model = eval(model.join('.'));
							/* jshint ignore:end */

							// Update the model.
							Vue.set(model, modelTop, valueNew);
							value = valueNew;

							vnode.context.$forceUpdate();
						}

						// Update the country.
						if (country !== countryNew) {
							el.setAttribute('data-country', countryNew);
						}
					}
					else {
						// Remove the country.
						if (country) {
							el.setAttribute('data-country', '');
						}
					}

					// Store the checked values so we can skip this
					// later.
					if (el.dataset.blobPhoneValue !== value) {
						el.setAttribute('data-blob-phone-value', value);
					}

					valid = valid ? 1 : 0;
					var lastValid = parseInt(el.dataset.blobPhoneValid, 10) || 0;
					if (valid !== lastValid) {
						el.setAttribute('data-blob-phone-valid', valid);
					}

				}, 500);

				// If libphonenumber-js is already here, let's just
				// do what needs doing.
				Vue.nextTick(function() {
					el.addEventListener('input', updatePhone);
					Vue.nextTick(function() {
						updatePhone();
					});
				});
			}
		});

		/**
		 * v-blobselect
		 *
		 * Wrapper for blob-select.
		 *
		 * @see https://github.com/Blobfolio/blob-phone
		 *
		 * @param string $country Country code.
		 */
		Vue.directive('blobselect', {
			id: 'blobselect',
			priority: 50000,
			inserted: function(el, binding){
				// This must be a select field.
				if (
					!el.nodeName ||
					(el.nodeName !== 'SELECT')
				) {
					return;
				}

				// The blob-phone library must be loaded.
				if (!('blobSelect' in HTMLSelectElement.prototype)) {
					console.warn('v-blobselect requires the blob-select Javascript library.' + "\n" + 'https://github.com/Blobfolio/blob-select');
					return;
				}

				// Figure out the arguments.
				var args = binding.value || null;
				if (typeof args !== 'object') {
					args = null;
				}

				Vue.nextTick(function() {
					el.blobSelect.init(args);
				});
			},
		});

		// ------------------------------------------------------------- end directive



		// -------------------------------------------------------------
		// Public Methods
		// -------------------------------------------------------------

		/**
		 * Form/Field Errors
		 *
		 * @param string Form name.
		 * @param string Field name.
		 * @return mixed Errors or false.
		 */
		Vue.prototype.formErrors = function(name, fieldName) {
			// Make sure the form is valid.
			if (!name || (typeof this.blobForms[name] === 'undefined')) {
				return false;
			}

			var errors = this.blobErrors[name] || {},
				errorKeys = Object.keys(errors);

			// We have no errors.
			if (!errorKeys.length) {
				return false;
			}

			// Looking for a specific field's error?
			if (fieldName) {
				if (errorKeys.indexOf(fieldName) === -1) {
					return false;
				}

				return errors[fieldName];
			}

			// Return all errors.
			return errors;
		};

		/**
		 * Form/Field Touched
		 *
		 * @param string Form name.
		 * @param string Field name.
		 * @return bool True/false.
		 */
		Vue.prototype.formTouched = function(name, fieldName) {
			// Make sure the form is valid.
			if (!name || (typeof this.blobForms[name] === 'undefined')) {
				return false;
			}

			// Looking for a specific field's status?
			if (fieldName) {
				return this.blobFields[name][fieldName] && this.blobFields[name][fieldName].touched;
			}

			// Return the form's status.
			return this.blobForms[name].touched;
		};

		/**
		 * Form/Field Changed
		 *
		 * @param string Form name.
		 * @param string Field name.
		 * @return bool True/false.
		 */
		Vue.prototype.formChanged = function(name, fieldName) {
			// Make sure the form is valid.
			if (!name || (typeof this.blobForms[name] === 'undefined')) {
				return false;
			}

			// Looking for a specific field's status?
			if (fieldName) {
				return this.blobFields[name][fieldName] && this.blobFields[name][fieldName].changed;
			}

			// Return the form's status.
			return this.blobForms[name].changed;
		};

		/**
		 * Form/Field Valid
		 *
		 * @param string Form name.
		 * @param string Field name.
		 * @return bool True/false.
		 */
		Vue.prototype.formValid = function(name, fieldName) {
			// Make sure the form is valid.
			if (!name || (typeof this.blobForms[name] === 'undefined')) {
				return false;
			}

			// Looking for a specific field's status?
			if (fieldName) {
				return this.blobFields[name][fieldName] && this.blobFields[name][fieldName].valid;
			}

			// Return the form's status.
			return this.blobForms[name].valid;
		};

		/**
		 * Validate Form
		 *
		 * @param string $name Form name.
		 * @return bool|object True or errors.
		 */
		Vue.prototype.validateForm = function(name) {
			// Make sure the form is valid.
			if (!name || (typeof this.blobForms[name] === 'undefined')) {
				return { other: 'Invalid form.' };
			}

			// Force (re)check all fields.
			_validateForm(this.blobForms[name].el, true);

			// See if we have any errors and report accordingly.
			var errors = this.blobErrors[name] || {},
				errorKeys = Object.keys(errors);

			return errorKeys.length ? errors : true;
		};

		/**
		 * Set Errors
		 *
		 * Pass arbitrary errors to a form. These do not necessarily
		 * have to correspond to fields, but they must correspond to
		 * a v-form.
		 *
		 * @param string $name Form name.
		 * @param object $errors Errors.
		 * @return bool True/false.
		 */
		Vue.prototype.setFormErrors = function(name, errors) {
			// Make sure the form is valid.
			if (!name || (typeof this.blobErrors[name] === 'undefined')) {
				return false;
			}

			// This should be a keyed object.
			if (
				(typeof errors !== 'object') ||
				(errors === null) ||
				Array.isArray(errors)
			) {
				return false;
			}

			var fields = Object.keys(this.blobFields[name]),
				keys = Object.keys(errors),
				changed = false;

			// Again, exit if the data is bad.
			if (!keys.length) {
				return false;
			}

			// Loop through everything!
			for (i=0; i<keys.length; i++) {
				var key = keys[i],
					value = errors[keys[i]];

				// Bad error?
				if (!value || (typeof value !== 'string')) {
					continue;
				}

				changed = true;

				// Record the main error.
				this.blobErrors[name][key] = value;

				// If this is a field, we should also update its
				// validity details.
				if (fields.indexOf(key) !== -1) {
					// Update internal meta.
					if (this.blobFields[name][key].valid) {
						Vue.set(this.blobFields[name][key], 'valid', false);
					}
					if (this.blobFields[name][key].el.classList.contains('is-valid')) {
						this.blobFields[name][key].el.classList.remove('is-valid');
					}
					if (!this.blobFields[name][key].el.classList.contains('is-invalid')) {
						this.blobFields[name][key].el.classList.add('is-invalid');
					}

					// And for good measure, the field's constraint error.
					this.blobFields[name][key].el.setCustomValidity(value);
				}
			}

			// If we made changes, update the form classes.
			if (changed) {
				this.$forceUpdate();
				_updateFormClasses(this.blobForms[name].el);
			}

			return true;
		};

		/**
		 * Gravatar URL
		 *
		 * Get a gravatar URL given an email address.
		 *
		 * @param string $email Email.
		 * @param int $size Size.
		 * @return string URL.
		 */
		Vue.prototype.gravatarURL = function(email, size) {
			// Make sure the data makes sense.
			email = email ? email + '' : '';
			email = email.trim().toLowerCase();
			size = parseInt(size, 10) || 0;
			if (size <= 0) {
				size = 80;
			}

			// A default hash.
			var hash = '334c4a4c42fdb79d7ebc3e73b517e6f8';

			// Calculate the hash if the email seems email-like.
			if (email && !!regexEmail.test(email)) {
				hash = _md5(email);
			}

			return gravatar + hash + '?s=' + size + '&d=blank';
		};

		/**
		 * Format A Phone Number
		 *
		 * @param string $phone Phone.
		 * @param string $country Country.
		 * @return string Phone number.
		 */
		Vue.mixin({
			filters: {
				phone: function(phone, country) {
					if (!('blobPhone' in window)) {
						console.warn('This filter requires the blob-phone Javascript library.' + "\n" + 'https://github.com/Blobfolio/blob-phone#javascript');
						return phone;
					}

					var parsed = blobPhone.parse(phone, country);
					if (false !== parsed) {
						return parsed.number;
					}

					return phone;
				}
			},
		});

		// ------------------------------------------------------------- end public



		// -------------------------------------------------------------
		// Validation
		// -------------------------------------------------------------

		/**
		 * Validate Form
		 *
		 * @param DOMElement $el Form.
		 * @param bool $touch Force touch.
		 * @return bool True/false.
		 */
		function _validateForm(el, touch) {
			// Make sure the form is valid.
			var name = _isForm(el);
			if (
				!name ||
				typeof $scope[name] === 'undefined' ||
				$scope[name].blobForms[name].$lock
			) {
				return false;
			}

			// Set a lock so this doesn't double-run.
			Vue.set($scope[name].blobForms[name], '$lock', true);

			// Cast $touch to a boolean.
			touch = !!touch;

			// Before we start validating, let's reset the error holder
			// to clear any arbitrary messages a user might have
			// injected.
			$scope[name].blobErrors[name] = {};

			// Loop through and validate each field.
			var fieldKeys = Object.keys($scope[name].blobFields[name]);
			for (i=0; i<fieldKeys.length; i++) {
				_validateField(
					el,
					$scope[name].blobFields[name][fieldKeys[i]].el,
					touch
				);
			}

			// Remove our lock.
			Vue.set($scope[name].blobForms[name], '$lock', false);

			// Update form classes.
			Vue.nextTick(function() {
				_updateFormClasses(el);
			});

			return true;
		}

		/**
		 * Validate Field
		 *
		 * @param DOMElement $form Form.
		 * @param DOMElement $field Field.
		 * @param bool $touch Force touch.
		 * @return bool True/false.
		 */
		function _validateField(form, field, touch) {
			// Make sure the form is valid.
			var name = _isForm(form);
			if (
				!name ||
				typeof $scope[name] === 'undefined'
			) {
				return false;
			}

			// Make sure the field is valid.
			var fieldName = _isField(field);
			if (!field) {
				return false;
			}

			// Vue might mess up event trigger ordering when forms are
			// conditionally displayed. If the data doesn't exist yet
			// we can go ahead and create it.
			if (typeof $scope[name].blobFields[name][fieldName] === 'undefined') {
				console.warn('Missing Field Data: ' + name + '.' + fieldName);

				// Save the data.
				Vue.set($scope[name].blobFields[name], fieldName, {
					name: fieldName,
					el: field,
					originalValue: _checksum(field.value),
					changed: false,
					touched: false,
					valid: true,
					$lock: false,
				});
				$scope[name].$forceUpdate();
			}

			// If this is locked, get out of here.
			if ($scope[name].blobFields[name][fieldName].$lock) {
				return false;
			}

			// Cast $touch to a boolean.
			touch = !!touch;

			var fieldValue = field.value || '',
				validity = false;

			// Set a lock to pevent double-runs.
			Vue.set($scope[name].blobFields[name][fieldName], '$lock', true);

			// Mark it touched?
			if (touch && !$scope[name].blobFields[name][fieldName].touched) {
				Vue.set($scope[name].blobFields[name][fieldName], 'touched', true);
			}

			// Mark it changed?
			var changed = (_checksum(fieldValue) !== $scope[name].blobFields[name][fieldName].originalValue);
			if (changed !== $scope[name].blobFields[name][fieldName].changed) {
				Vue.set($scope[name].blobFields[name][fieldName], 'changed', changed);
			}

			// Start checking validity!
			var valid = false;
			_resetValidity(field);

			// Either good or maybe the browser doesn't support the API.
			if ((typeof field.willValidate === 'undefined') || field.checkValidity()) {
				valid = true;
			}
			// Maybe empty/required? This shouldn't be counted as an
			// in-your-face error unless the field has been touched.
			else if (!$scope[name].blobFields[name][fieldName].touched) {
				validity = field.validity;
				if (validity.valueMissing) {
					valid = true;
					_resetValidity(field);
				}
			}

			// Email-specific validation.
			if (fieldValue.length && valid && ('email' === field.getAttribute('type'))) {
				valid = !!regexEmail.test(fieldValue);
				if (!valid) {
					field.setCustomValidity('Please enter a complete email address.');
				}
			}

			// Telephone-specific validation.
			if (
				('blobPhone' in window) &&
				fieldValue.length &&
				valid &&
				('tel' === field.getAttribute('type'))
			) {
				var lastValue = (field.dataset.blobPhoneValue) || '',
					lastValid = parseInt(field.dataset.blobPhoneValid, 10) || 0;

				// We need to reparse.
				if (lastValue !== fieldValue) {
					var country = (field.dataset.country || '').toUpperCase() || 'US';
					if (country.length !== 2) {
						country = 'US';
					}

					if (false !== blobPhone.parse(fieldValue, country)) {
						field.setAttribute('data-blob-phone-value', fieldValue);
						field.setAttribute('data-blob-phone-valid', 1);
					}
					else {
						field.setAttribute('data-blob-phone-value', fieldValue);
						field.setAttribute('data-blob-phone-valid', 0);
						valid = false;
					}
				}
				else {
					valid = (lastValid === 1);
				}

				if (!valid) {
					field.setCustomValidity('Please enter a valid phone number.');
				}
			}

			// Extra checks?
			if (valid) {
				// A custom callback can be specified by including a
				// validation-callback attribute on the element.
				var fieldCallback = field.dataset.validationCallback || field.getAttribute('validation-callback') || false;
				if (fieldCallback && (typeof $scope[name][fieldCallback] === 'function')) {
					var callbackResponse = $scope[name][fieldCallback](fieldValue);
					if (callbackResponse !== true) {
						valid = false;
						if (typeof callbackResponse === 'string' && callbackResponse.length) {
							field.setCustomValidity(callbackResponse);
						}
						else {
							field.setCustomValidity('This input is not valid.');
						}
					}
				}
			}

			// Clear the old error message, if any.
			if (valid) {
				_resetValidity(field);

				if ($scope[name].blobErrors[name][fieldName]) {
					Vue.delete($scope[name].blobErrors[name], fieldName);
				}
			}
			// Otherwise record the error.
			else {
				Vue.set($scope[name].blobErrors[name], fieldName, field.validationMessage);
			}

			if (valid !== $scope[name].blobFields[name][fieldName].valid) {
				Vue.set($scope[name].blobFields[name][fieldName], 'valid', valid);
			}

			// Update the field classes. These verbose conditions help
			// prevent unnecessary DOM mutations, cutting back on
			// overhead.
			if ($scope[name].blobFields[name][fieldName].valid) {
				if (field.classList.contains('is-invalid')) {
					field.classList.remove('is-invalid');
				}
				if (!field.classList.contains('is-valid')) {
					field.classList.add('is-valid');
				}
			}
			else {
				if (!field.classList.contains('is-invalid')) {
					field.classList.add('is-invalid');
				}
				if (field.classList.contains('is-valid')) {
					field.classList.remove('is-valid');
				}
			}

			if ($scope[name].blobFields[name][fieldName].touched) {
				if (!field.classList.contains('is-touched')) {
					field.classList.add('is-touched');
				}
			}
			else {
				if (field.classList.contains('is-touched')) {
					field.classList.remove('is-touched');
				}
			}

			if ($scope[name].blobFields[name][fieldName].changed) {
				if (!field.classList.contains('is-changed')) {
					field.classList.add('is-changed');
				}
			}
			else {
				if (field.classList.contains('is-changed')) {
					field.classList.remove('is-changed');
				}
			}

			// Remove the lock.
			Vue.set($scope[name].blobFields[name][fieldName], '$lock', false);

			// Update the form's classes?
			if (!$scope[name].blobForms[name].$lock) {
				Vue.nextTick(function() {
					_updateFormClasses(form);
				});
			}

			return valid;
		}

		/**
		 * Reset Field Validity Status
		 *
		 * This has to be called in a handful of places and try/catched
		 * to prevent errors in old browsers, so it is better to offload
		 * to its own function.
		 *
		 * @param DOMElement $el Field.
		 * @return bool True/false.
		 */
		function _resetValidity(el) {
			try {
				el.checkValidity();
				el.setCustomValidity('');
			} catch (Ex) {
				return false;
			}
		}

		/**
		 * Update Form Classes
		 *
		 * @param DOMElement $el Field.
		 * @return bool True/false.
		 */
		function _updateFormClasses(el) {
			var name = _isForm(el);
			if (!name) {
				return false;
			}

			var changed = false,
				valid = true,
				touched = false;

			// The form is its fields. Loop through each to see if a
			// status deviates from the natural state.
			var fields = Object.keys($scope[name].blobFields[name]);
			for (i=0; i<fields.length; i++) {
				if (!changed && $scope[name].blobFields[name][fields[i]].changed) {
					changed = true;
				}

				if (valid && !$scope[name].blobFields[name][fields[i]].valid) {
					valid = false;
				}

				if (!touched && $scope[name].blobFields[name][fields[i]].touched) {
					touched = true;
				}

				// Nothing else to detect.
				if (changed && !valid && touched) {
					break;
				}
			}

			// Update variables.
			if (valid !== $scope[name].blobForms[name].valid) {
				Vue.set($scope[name].blobForms[name], 'valid', valid);
			}
			if (changed !== $scope[name].blobForms[name].changed) {
				Vue.set($scope[name].blobForms[name], 'changed', changed);
			}
			if (touched !== $scope[name].blobForms[name].touched) {
				Vue.set($scope[name].blobForms[name], 'touched', touched);
			}

			// Update the form classes. These verbose conditions help
			// prevent unnecessary DOM mutations, cutting back on
			// overhead.
			if (valid) {
				if (el.classList.contains('is-invalid')) {
					el.classList.remove('is-invalid');
				}
				if (!el.classList.contains('is-valid')) {
					el.classList.add('is-valid');
				}
			}
			else {
				if (!el.classList.contains('is-invalid')) {
					el.classList.add('is-invalid');
				}
				if (el.classList.contains('is-valid')) {
					el.classList.remove('is-valid');
				}
			}

			if (touched) {
				if (!el.classList.contains('is-touched')) {
					el.classList.add('is-touched');
				}
			}
			else {
				if (el.classList.contains('is-touched')) {
					el.classList.remove('is-touched');
				}
			}

			if (changed) {
				if (!el.classList.contains('is-changed')) {
					el.classList.add('is-changed');
				}
			}
			else {
				if (el.classList.contains('is-changed')) {
					el.classList.remove('is-changed');
				}
			}

			// Force Vue to update as it doesn't tend to notice deep
			// object changes right away.
			$scope[name].$forceUpdate();
		}

		// ------------------------------------------------------------- end validation



		// -------------------------------------------------------------
		// Misc
		// -------------------------------------------------------------

		/**
		 * Get Form Name
		 *
		 * Make sure an element is in fact a form and return its name.
		 *
		 * @param DOMElement $el Element.
		 * @return string|bool Name or false.
		 */
		function _isForm(el) {
			if (!el.nodeName || (el.nodeName !== 'FORM')) {
				return false;
			}

			var name = el.getAttribute('name') || '';
			return name ? name : false;
		}

		/**
		 * Get Field Name
		 *
		 * Make sure an element is an INPUT, SELECT, or TEXTAREA and
		 * return its name.
		 *
		 * @param DOMElement $el Element.
		 * @return string|bool Name or false.
		 */
		function _isField(el) {
			if (
				!el.nodeName ||
				(
					(el.nodeName !== 'INPUT') &&
					(el.nodeName !== 'SELECT') &&
					(el.nodeName !== 'TEXTAREA')
				)
			) {
				return false;
			}

			var name = el.getAttribute('name') || '';
			return name ? name : false;
		}

		/**
		 * Get Form Fields
		 *
		 * Find form field elements belonging to a given form.
		 *
		 * @param DOMElement $el Form.
		 * @return array|false Field elements or false.
		 */
		function _getFields(el) {
			// Make sure the form is valid.
			if (false === _isForm(el)) {
				return false;
			}

			// Pull fields by searching DOM.
			var fields = el.querySelectorAll('input[name], select[name], textarea[name]');
			if (!fields) {
				return false;
			}

			// Add any fields with a name to our list.
			var out = [];
			for (var i=0; i<fields.length; i++) {
				var name = fields[i].getAttribute('name') || '';
				if (name) {
					out.push(fields[i]);
				}
			}

			return out.length ? out : false;
		}

		/**
		 * Load Form Fields
		 *
		 * This function scans the DOM to see what fields a form has,
		 * but also makes sure that there are corresponding data
		 * entries for whatever is found.
		 *
		 * Extraneous data, from e.g. removed nodes, will be cleaned.
		 *
		 * @param DOMElement $el Form.
		 * @return bool True/false.
		 */
		function _loadFields(el) {
			// Make sure the form is valid.
			var name = _isForm(el);
			if (false === name) {
				return false;
			}

			// Pull the fields.
			var fields = _getFields(el);
			if (false === fields) {
				Vue.set($scope[name].blobForms[name], 'fields', {});
				return false;
			}

			var changed = false;

			// Make sure each field is represented.
			var fieldNames = [],
				fieldKeys = Object.keys($scope[name].blobFields[name]),
				errorKeys = Object.keys($scope[name].blobFields[name]);

			for (i=0; i<fields.length; i++) {
				// Verify the field we found has a valid name.
				var fieldName = fields[i].getAttribute('name') || '';
				if (!fieldName) {
					continue;
				}

				// Add it if missing.
				if (fieldKeys.indexOf(fieldName) === -1) {
					changed = true;
					fieldKeys.push(fieldName);

					// Push the data.
					Vue.set($scope[name].blobFields[name], fieldName, {
						name: fieldName,
						el: fields[i],
						originalValue: _checksum(fields[i].value || ''),
						changed: false,
						touched: false,
						valid: true,
						$lock: false,
					});

					// Bind an input listener to monitor blur, AKA what
					// we're calling "touched".
					/* jshint ignore:start */
					fields[i].addEventListener('blur', function (e) {
						Vue.nextTick(function() {
							_validateField(el, e.target, true);
						});
					});
					/* jshint ignore:end */

					// And add to our running list.
					fieldNames.push(fieldName);
				}
			}

			// Remove any outmoded data.
			if (fieldKeys.length !== fieldNames.length) {
				for (i=0; i<fieldKeys.length; i++) {
					// Remove field.
					if (fieldNames.indexOf(fieldKeys[i]) === -1) {
						changed = true;

						// Unbind any events.
						try {
							var fieldEvents = getEventListeners($scope[name].blobFields[name].el);
							for (j=0; j<fieldEvents.length; j++) {
								fieldEvents[j].remove();
							}
						} catch (Ex) {}

						// Remove the field data.
						Vue.delete($scope[name].blobFields[name], fieldKeys[i]);

						// Remove error.
						if (errorKeys.indexOf(fieldKeys[i]) === -1) {
							changed = true;
							Vue.delete($scope[name].blobFields[name], fieldKeys[i]);
						}
					}
				}
			}

			// Force Vue to update as it doesn't tend to notice deep
			// object changes right away.
			if (changed) {
				$scope[name].$forceUpdate();
			}

			return true;
		}

		/**
		 * Simple Checksum
		 *
		 * The original value of each field is stored so that its change
		 * status can be detected.
		 *
		 * To make comparisons easier, and to cut down on memory waste,
		 * values are stored as a very simple checksum.
		 *
		 * @param mixed $value Value.
		 * @return string Hash.
		 */
		function _checksum(value) {
			// We need a string. For objects, JSON will suffice.
			if (typeof value === 'object') {
				try {
					value = JSON.stringify(value);
				} catch (Ex) {
					return 0;
				}
			}
			// For everything else, just try to cast it.
			else {
				try {
					value = value + '';
				} catch (Ex) {
					return 0;
				}
			}

			// Declare our variables.
			var hash = 0,
				strlen = value.length,
				i,
				c;

			for (i=0; i<strlen; i++) {
				c = value.charCodeAt(i);
				hash = ((hash << 5) - hash) + c;
				hash = hash & hash; // Convert to 32-bit integer.
			}

			return hash;
		}

		/**
		 * MD5 Hash
		 *
		 * This is a lightly-modified version of JK Meyers'
		 * implementation.
		 *
		 * @see http://www.myersdaily.org/joseph/javascript/md5-text.html
		 *
		 * @param string $str String.
		 * @return string Hash.
		 */
		function _md5(str){
			var md5cycle = function(x, k) {
				var a = x[0],
					b = x[1],
					c = x[2],
					d = x[3];

				a = ff(a, b, c, d, k[0], 7, -680876936);
				d = ff(d, a, b, c, k[1], 12, -389564586);
				c = ff(c, d, a, b, k[2], 17, 606105819);
				b = ff(b, c, d, a, k[3], 22, -1044525330);
				a = ff(a, b, c, d, k[4], 7, -176418897);
				d = ff(d, a, b, c, k[5], 12, 1200080426);
				c = ff(c, d, a, b, k[6], 17, -1473231341);
				b = ff(b, c, d, a, k[7], 22, -45705983);
				a = ff(a, b, c, d, k[8], 7, 1770035416);
				d = ff(d, a, b, c, k[9], 12, -1958414417);
				c = ff(c, d, a, b, k[10], 17, -42063);
				b = ff(b, c, d, a, k[11], 22, -1990404162);
				a = ff(a, b, c, d, k[12], 7, 1804603682);
				d = ff(d, a, b, c, k[13], 12, -40341101);
				c = ff(c, d, a, b, k[14], 17, -1502002290);
				b = ff(b, c, d, a, k[15], 22, 1236535329);

				a = gg(a, b, c, d, k[1], 5, -165796510);
				d = gg(d, a, b, c, k[6], 9, -1069501632);
				c = gg(c, d, a, b, k[11], 14, 643717713);
				b = gg(b, c, d, a, k[0], 20, -373897302);
				a = gg(a, b, c, d, k[5], 5, -701558691);
				d = gg(d, a, b, c, k[10], 9, 38016083);
				c = gg(c, d, a, b, k[15], 14, -660478335);
				b = gg(b, c, d, a, k[4], 20, -405537848);
				a = gg(a, b, c, d, k[9], 5, 568446438);
				d = gg(d, a, b, c, k[14], 9, -1019803690);
				c = gg(c, d, a, b, k[3], 14, -187363961);
				b = gg(b, c, d, a, k[8], 20, 1163531501);
				a = gg(a, b, c, d, k[13], 5, -1444681467);
				d = gg(d, a, b, c, k[2], 9, -51403784);
				c = gg(c, d, a, b, k[7], 14, 1735328473);
				b = gg(b, c, d, a, k[12], 20, -1926607734);

				a = hh(a, b, c, d, k[5], 4, -378558);
				d = hh(d, a, b, c, k[8], 11, -2022574463);
				c = hh(c, d, a, b, k[11], 16, 1839030562);
				b = hh(b, c, d, a, k[14], 23, -35309556);
				a = hh(a, b, c, d, k[1], 4, -1530992060);
				d = hh(d, a, b, c, k[4], 11, 1272893353);
				c = hh(c, d, a, b, k[7], 16, -155497632);
				b = hh(b, c, d, a, k[10], 23, -1094730640);
				a = hh(a, b, c, d, k[13], 4, 681279174);
				d = hh(d, a, b, c, k[0], 11, -358537222);
				c = hh(c, d, a, b, k[3], 16, -722521979);
				b = hh(b, c, d, a, k[6], 23, 76029189);
				a = hh(a, b, c, d, k[9], 4, -640364487);
				d = hh(d, a, b, c, k[12], 11, -421815835);
				c = hh(c, d, a, b, k[15], 16, 530742520);
				b = hh(b, c, d, a, k[2], 23, -995338651);

				a = ii(a, b, c, d, k[0], 6, -198630844);
				d = ii(d, a, b, c, k[7], 10, 1126891415);
				c = ii(c, d, a, b, k[14], 15, -1416354905);
				b = ii(b, c, d, a, k[5], 21, -57434055);
				a = ii(a, b, c, d, k[12], 6, 1700485571);
				d = ii(d, a, b, c, k[3], 10, -1894986606);
				c = ii(c, d, a, b, k[10], 15, -1051523);
				b = ii(b, c, d, a, k[1], 21, -2054922799);
				a = ii(a, b, c, d, k[8], 6, 1873313359);
				d = ii(d, a, b, c, k[15], 10, -30611744);
				c = ii(c, d, a, b, k[6], 15, -1560198380);
				b = ii(b, c, d, a, k[13], 21, 1309151649);
				a = ii(a, b, c, d, k[4], 6, -145523070);
				d = ii(d, a, b, c, k[11], 10, -1120210379);
				c = ii(c, d, a, b, k[2], 15, 718787259);
				b = ii(b, c, d, a, k[9], 21, -343485551);

				x[0] = add32(a, x[0]);
				x[1] = add32(b, x[1]);
				x[2] = add32(c, x[2]);
				x[3] = add32(d, x[3]);
			},

			cmn = function(q, a, b, x, s, t) {
				a = add32(add32(a, q), add32(x, t));
				return add32((a << s) | (a >>> (32 - s)), b);
			},

			ff = function(a, b, c, d, x, s, t) {
				return cmn((b & c) | ((~b) & d), a, b, x, s, t);
			},

			gg = function(a, b, c, d, x, s, t) {
				return cmn((b & d) | (c & (~d)), a, b, x, s, t);
			},

			hh = function(a, b, c, d, x, s, t) {
				return cmn(b ^ c ^ d, a, b, x, s, t);
			},

			ii = function(a, b, c, d, x, s, t) {
				return cmn(c ^ (b | (~d)), a, b, x, s, t);
			},

			md51 = function(s) {
				txt = '';
				var n = s.length,
					state = [1732584193, -271733879, -1732584194, 271733878],
					i;
				for (i = 64; i <= s.length; i += 64) {
					md5cycle(state, md5blk(s.substring(i - 64, i)));
				}
				s = s.substring(i - 64);
				var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
				for (i = 0; i < s.length; i++)
					tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
				tail[i >> 2] |= 0x80 << ((i % 4) << 3);
				if (i > 55) {
					md5cycle(state, tail);
					for (i = 0; i < 16; i++) tail[i] = 0;
				}
				tail[14] = n * 8;
				md5cycle(state, tail);
				return state;
			},

			md5blk = function(s) { /* I figured global was faster.   */
				var md5blks = [],
					i; /* Andy King said do it this way. */
				for (i = 0; i < 64; i += 4) {
					md5blks[i >> 2] = s.charCodeAt(i) +
						(s.charCodeAt(i + 1) << 8) +
						(s.charCodeAt(i + 2) << 16) +
						(s.charCodeAt(i + 3) << 24);
				}
				return md5blks;
			},

			hex_chr = '0123456789abcdef'.split(''),

			rhex = function(n) {
				var s = '',
					j = 0;
				for (; j < 4; j++)
					s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] +
					hex_chr[(n >> (j * 8)) & 0x0F];
				return s;
			},

			hex = function(x) {
				for (var i = 0; i < x.length; i++)
					x[i] = rhex(x[i]);
				return x.join('');
			},

			add32 = function(a, b) {
				return (a + b) & 0xFFFFFFFF;
			};

			return hex(md51(str));
		}

		/**
		 * Debounce
		 *
		 * @param function $fn Callback.
		 * @param bool $wait Wait.
		 * @param bool $no_postpone Do it now.
		 */
		var _debounce = function(fn, wait, no_postpone){
			var args, context, result, timeout;
			var executed = true;

			// Execute the callback function.
			function ping(){
				result = fn.apply(context || this, args || []);
				context = args = null;
				executed = true;
			}

			// Cancel the timeout.
			function cancel() {
				if(timeout){
					clearTimeout(timeout);
					timeout = null;
				}
			}

			// Generate a wrapper function to return.
			function wrapper() {
				context = this;
				args = arguments;
				if (!no_postpone) {
					cancel();
					timeout = setTimeout(ping, wait);
				}
				else if (executed) {
					executed = false;
					timeout = setTimeout(ping, wait);
				}
			}

			// Reset.
			wrapper.cancel = cancel;
			return wrapper;
		};

		/**
		 * Get Model Name
		 *
		 * Directives are no longer meant to write back to the model,
		 * but why should that stop us? This function will find the
		 * relevant model name so we can do something about it.
		 *
		 * @param Vue $vnode Vnode.
		 * @return string Name.
		 */
		function _getModelName(vnode) {
			try {
				return vnode.data.directives.find(function(o) {
					return o.name === 'model';
				}).expression;
			} catch (Ex) {
				return false;
			}
		}

		// ------------------------------------------------------------- end misc

	} ;

	// Hook the code into Vue.
	if (typeof window !== 'undefined' && window.Vue) {
		window.Vue.use(BlobFormsVue);
	}

})();