/**
 * Form Validation
 *
 * This is a Vue plugin for providing form validation.
 *
 * @version 0.7.0
 * @author Blobfolio, LLC <hello@blobfolio.com>
 * @package vue-blob-forms
 * @license WTFPL <http://www.wtfpl.net>
 *
 * @see https://blobfolio.com
 * @see https://github.com/Blobfolio/vue-blob-forms
 */

/* global blobPhone */
/* global getEventListeners */
/* global Vue */
(function() {

	// The plugin!
	const BlobFormsVue = {
		/**
		 * Install
		 *
		 * @param {Vue} Vue Vue.
		 * @param {object} options Options.
		 * @returns {void} Nothing.
		 */
		install: function(Vue) {

			// ---------------------------------------------------------
			// Setup
			// ---------------------------------------------------------

			// Improved validation patterns.
			/* eslint-disable */
			const regexEmail = new RegExp(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
			/* eslint-enable */

			// Gravatar base URL.
			const gravatar = 'https://www.gravatar.com/avatar/';

			// --------------------------------------------------------- end setup



			// ---------------------------------------------------------
			// Directives
			// ---------------------------------------------------------

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
				 * @param {DOMElement} el Element.
				 * @param {object} binding Vue data.
				 * @param {object} vnode Vue node.
				 * @returns {void} Nothing.
				 */
				inserted: function(el, binding, vnode) {
					const name = _isForm(el);
					if (!name) {
						return;
					}

					// Don't want to validate the form the usual way.
					if (!el.getAttribute('novalidate')) {
						el.setAttribute('novalidate', true);
					}

					// Store our data on the form element directly.
					el.__blobForm__ = {
						changed: false,
						touched: false,
						valid: true,
						fieldCount: 0,
						errors: {},
						$lock: false,
					};

					// Watch for element changes. This code block is largely
					// a duplicate of _loadFields(), but Vue has trouble
					// setting data correctly when this particular piece is
					// passed to another function.
					const observer = new MutationObserver(_debounce(function() {
						Vue.nextTick(function() {
							if (!el.__blobForm__.$lock) {
								_getFields.call(vnode.context, el);
							}
						});
					}, 50));
					observer.observe(el, {childList: true, subtree: true});

					// Bind an input listener to monitor changes, but only
					// act if we have an INPUT or TEXTAREA field.
					el.addEventListener('input', _debounce(function(e) {
						Vue.nextTick(function() {
							if (('SELECT' !== e.target.tagName) && (false !== _isField(e.target))) {
								_validateField.call(vnode.context, el, e.target, true);
							}
						});
					}, 100));

					// For SELECT fields, we'll use a change listener
					// instead. This fixes a bug with Vue + Chrome.
					el.addEventListener('change', _debounce(function(e) {
						Vue.nextTick(function() {
							if (('SELECT' === e.target.tagName) && (false !== _isField(e.target))) {
								// The timeout fixes another SELECT bug,
								// this one affecting Edge. Haha.
								setTimeout(function() {
									_validateField.call(vnode.context, el, e.target, true);
								}, 50);
							}
						});
					}, 100));

					// Let's assume we have no fields yet and load our data.
					vnode.context.$forceUpdate();
					Vue.nextTick(function() {
						_getFields.call(vnode.context, el);
						Vue.nextTick(function() {
							_validateForm.call(vnode.context, el);
						});
					});

					// And done!
					return true;
				},
			});

			/**
			 * V-gravatar
			 *
			 * Find the Gravatar icon associated with an email address.
			 *
			 * @param {int} size Icon size.
			 */
			Vue.directive('gravatar', {
				id: 'gravatar',
				priority: 50000,
				/**
				 * Element with this directive has fully landed in the DOM.
				 *
				 * @param {DOMElement} el Element.
				 * @param {object} binding Vue data.
				 * @returns {void} Nothing.
				 */
				inserted: function(el, binding) {
					// This must be an email field.
					if (
						el.nodeName &&
						('INPUT' === el.nodeName) &&
						('email' === el.getAttribute('type'))
					) {
						let size = parseInt(binding.value, 10) || 0;

						// Make sure the size makes sense.
						if (0 >= size) {
							size = 80;
						}

						const updateEmail = _debounce(function() {
							// Make sure the field value makes sense.
							let email = (el.value || '').trim().toLowerCase();
							let hash = '334c4a4c42fdb79d7ebc3e73b517e6f8';
							let oldHash = el.dataset.hash || '';

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
						Vue.nextTick(function() {
							el.addEventListener('input', updateEmail);
							updateEmail();
						});
					}
				},
			});

			/**
			 * V-phone
			 *
			 * Extended handling for telephone numbers. This requires the
			 * blob-phone.js library.
			 *
			 * @see https://github.com/Blobfolio/blob-phone
			 *
			 * @param {string} country Country code.
			 */
			Vue.directive('phone', {
				id: 'phone',
				priority: 50000,
				/**
				 * Element with this directive has fully landed in the DOM.
				 *
				 * @param {DOMElement} el Element.
				 * @param {object} binding Vue data.
				 * @param {object} vnode Vue node.
				 * @returns {void} Nothing.
				 */
				inserted: function(el, binding, vnode) {
					// This must be a telephone field.
					if (
						!el.nodeName ||
						('INPUT' !== el.nodeName) ||
						('tel' !== el.getAttribute('type'))
					) {
						return;
					}

					// The blob-phone library must be loaded.
					if (!('blobPhone' in window)) {
						console.warn('v-phone requires the blob-phone Javascript library.\nhttps://github.com/Blobfolio/blob-phone#javascript');
						return;
					}

					// Sort out the default country.
					let defaultCountry = (binding.value || '').toUpperCase() || 'US';
					if (2 !== defaultCountry.length) {
						defaultCountry = 'US';
					}

					// Our update handler.
					const updatePhone = _debounce(function() {
						// Make sure the field value makes sense.
						let value = (el.value || '').trim();
						let valueNew = '';
						let valid = false;
						let country = el.dataset.country || '';
						let countryNew = '';

						// First, come up with a formatted value, if
						// possible.
						if (value.length) {
							let parsed = blobPhone.parse(value, defaultCountry);
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
								let model = _getModelName(vnode);
								model = ('vnode.context.' + model).split('.');
								let modelTop = model.pop();
								/* eslint-disable */
								model = eval(model.join('.'));
								/* eslint-enable */

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
						let lastValid = parseInt(el.dataset.blobPhoneValid, 10) || 0;
						if (valid !== lastValid) {
							el.setAttribute('data-blob-phone-valid', valid);
						}

					}, 2000);

					// If libphonenumber-js is already here, let's just
					// do what needs doing.
					Vue.nextTick(function() {
						el.addEventListener('input', updatePhone);
						Vue.nextTick(function() {
							updatePhone();
						});
					});
				},
			});

			/**
			 * V-blobselect
			 *
			 * Wrapper for blob-select.
			 *
			 * @see https://github.com/Blobfolio/blob-phone
			 *
			 * @param {string} country Country code.
			 */
			Vue.directive('blobselect', {
				id: 'blobselect',
				priority: 50000,
				/**
				 * Element with this directive has fully landed in the DOM.
				 *
				 * @param {DOMElement} el Element.
				 * @param {object} binding Vue data.
				 * @param {object} vnode Vue node.
				 * @returns {void} Nothing.
				 */
				inserted: function(el, binding) {
					// This must be a select field.
					if (
						!el.nodeName ||
						('SELECT' !== el.nodeName)
					) {
						return;
					}

					// The blob-phone library must be loaded.
					if (!('blobSelect' in HTMLSelectElement.prototype)) {
						console.warn('v-blobselect requires the blob-select Javascript library.\nhttps://github.com/Blobfolio/blob-select');
						return;
					}

					// Figure out the arguments.
					let args = binding.value || null;
					if ('object' !== typeof args) {
						args = null;
					}

					Vue.nextTick(function() {
						el.blobSelect.init(args);
					});
				},
			});

			// --------------------------------------------------------- end directive



			// ---------------------------------------------------------
			// Public Methods
			// ---------------------------------------------------------

			/**
			 * Form/Field Errors
			 *
			 * @param {string} name Form name.
			 * @param {string} fieldName Field name.
			 * @returns {mixed} Errors or false.
			 */
			Vue.prototype.formErrors = function(name, fieldName) {
				// Get our object back.
				const el = _getFormByName(name);
				if (!el) {
					return false;
				}

				const errorKeys = Object.keys(el.__blobForm__.errors);

				// We have no errors.
				if (!errorKeys.length) {
					return false;
				}

				// Looking for a specific field's error?
				if (fieldName) {
					if (-1 === errorKeys.indexOf(fieldName)) {
						return false;
					}

					return el.__blobForm__.errors[fieldName];
				}

				// Return all errors.
				return el.__blobForm__.errors;
			};

			/**
			 * Unattached Form Errors
			 *
			 * Return any form errors whose keys do not directly correspond
			 * to a field name.
			 *
			 * @param {string} name Form name.
			 * @returns {mixed} Errors or false.
			 */
			Vue.prototype.formOtherErrors = function(name) {
				// Get our object back.
				const el = _getFormByName(name);
				if (!el) {
					return false;
				}

				const errorKeys = Object.keys(el.__blobForm__.errors);

				// We have no errors.
				if (!errorKeys.length) {
					return false;
				}

				const fields = _getFields.call(this, el);
				const fieldKeys = [];

				for (let i = 0; i < fields.length; ++i) {
					const fieldName = fields[i].getAttribute('name') || '';
					if (fieldName) {
						fieldKeys.push(fieldName);
					}
				}

				let out = {};
				let found = false;
				for (let i = 0; i < errorKeys.length; ++i) {
					if (-1 === fieldKeys.indexOf(errorKeys[i])) {
						out[errorKeys[i]] = el.__blobForm__.errors[errorKeys[i]];
						found = true;
					}
				}

				return found ? out : false;
			};

			/**
			 * Form/Field Touched
			 *
			 * @param {string} name Form name.
			 * @param {string} fieldName Field name.
			 * @returns {bool} True/false.
			 */
			Vue.prototype.formTouched = function(name, fieldName) {
				// Get our object back.
				const el = _getFormByName(name);
				if (!el) {
					return false;
				}

				// Looking for a specific field's status?
				if (fieldName) {
					const fieldEl = _getFormFieldByName.call(this, el, fieldName);
					return fieldEl && fieldEl.__blobForm__.touched;
				}

				// Return the form's status.
				return el.__blobForm__.touched;
			};

			/**
			 * Form/Field Changed
			 *
			 * @param {string} name Form name.
			 * @param {string} fieldName Field name.
			 * @returns {bool} True/false.
			 */
			Vue.prototype.formChanged = function(name, fieldName) {
				// Get our object back.
				const el = _getFormByName(name);
				if (!el) {
					return false;
				}

				// Looking for a specific field's status?
				if (fieldName) {
					const fieldEl = _getFormFieldByName.call(this, el, fieldName);
					return fieldEl && fieldEl.__blobForm__.changed;
				}

				// Return the form's status.
				return el.__blobForm__.changed;
			};

			/**
			 * Form/Field Valid
			 *
			 * @param {string} name Form name.
			 * @param {string} fieldName Field name.
			 * @returns {bool} True/false.
			 */
			Vue.prototype.formValid = function(name, fieldName) {
				// Get our object back.
				const el = _getFormByName(name);
				if (!el) {
					return false;
				}

				// Looking for a specific field's status?
				if (fieldName) {
					const fieldEl = _getFormFieldByName.call(this, el, fieldName);
					return fieldEl && fieldEl.__blobForm__.valid;
				}

				// Return the form's status.
				return el.__blobForm__.valid;
			};

			/**
			 * Validate Form
			 *
			 * @param {string} name Form name.
			 * @returns {bool|object} True or errors.
			 */
			Vue.prototype.validateForm = function(name) {
				// Get our object back.
				const el = _getFormByName(name);
				if (!el) {
					console.warn('Invalid vue-blob-form: ', name);
					return false;
				}

				// Force (re)check all fields.
				_validateForm.call(this, el, true);

				// See if we have any errors and report accordingly.
				return Object.keys(el.__blobForm__.errors).length ? el.__blobForm__.errors : true;
			};

			/**
			 * Set Errors
			 *
			 * Pass arbitrary errors to a form. These do not necessarily
			 * have to correspond to fields, but they must correspond to
			 * a v-form.
			 *
			 * @param {string} name Form name.
			 * @param {object} errors Errors.
			 * @returns {bool} True/false.
			 */
			Vue.prototype.setFormErrors = function(name, errors) {
				// Get our object back.
				const el = _getFormByName(name);
				if (!el) {
					console.warn('Invalid vue-blob-form: ', name);
					return false;
				}

				// This should be a keyed object.
				if (
					('object' !== typeof errors) ||
					(null === errors) ||
					Array.isArray(errors)
				) {
					return false;
				}

				const errorKeys = Object.keys(errors);
				let changed = false;

				// Again, exit if the data is bad.
				if (!errorKeys.length) {
					return false;
				}

				// Loop through everything!
				for (let i = 0; i < errorKeys.length; ++i) {
					// Bad error?
					if (!errors[errorKeys[i]] || ('string' !== typeof errors[errorKeys[i]])) {
						continue;
					}

					// Record the main error.
					el.__blobForm__.errors[errorKeys[i]] = errors[errorKeys[i]];
					changed = true;
				}

				// Post work.
				if (changed) {
					// Update any literal fields accordingly.
					const fields = _getFields.call(this, el);
					for (let i = 0; i < fields.length; ++i) {
						let fieldName = fields[i].getAttribute('name') || '';
						if (
							fieldName &&
							('string' === typeof el.__blobForm__.errors[fieldName])
						) {
							if (fields[i].__blobForm__.valid) {
								// The validity is invalid, duh.
								fields[i].__blobForm__.valid = false;

								// Make sure the constraint is set.
								fields[i].setCustomValidity(el.__blobForm__.errors[fieldName]);

								_toggleClasses(
									fields[i],
									['is-valid', 'is:valid'],
									['is-invalid', 'is:invalid'],
									false
								);
							}
						}
					}

					// Update the form as a whole.
					this.$forceUpdate();
					let vue = this;
					Vue.nextTick(function() {
						_updateFormClasses.call(vue, el);
					});
				}

				return true;
			};

			/**
			 * Clear Errors
			 *
			 * Reset form errors.
			 *
			 * @param {string} name Form name.
			 * @returns {bool} True/false.
			 */
			Vue.prototype.clearFormErrors = function(name) {
				// Get our object back.
				const el = _getFormByName(name);
				if (!el) {
					console.warn('Invalid vue-blob-form: ', name);
					return false;
				}

				// Reset the form errors.
				el.__blobForm__.errors = {};

				// Strip any constraints from the fields.
				const fields = _getFields.call(this, el);
				for (let i = 0; i < fields.length; ++i) {
					if (!fields[i].__blobForm__.valid) {
						fields[i].__blobForm__.valid = true;
						fields[i].setCustomValidity('');

						_toggleClasses(
							fields[i],
							['is-valid', 'is:valid'],
							['is-invalid', 'is:invalid'],
							true
						);
					}
				}

				// Update the form as a whole.
				this.$forceUpdate();
				let vue = this;
				Vue.nextTick(function() {
					_updateFormClasses.call(vue, el);
				});

				return true;
			};

			/**
			 * Gravatar URL
			 *
			 * Get a gravatar URL given an email address.
			 *
			 * @param {string} email Email.
			 * @param {int} size Size.
			 * @returns {string} URL.
			 */
			Vue.prototype.gravatarURL = function(email, size) {
				// Make sure the data makes sense.
				email = email ? email + '' : '';
				email = email.trim().toLowerCase();
				size = parseInt(size, 10) || 0;
				if (0 >= size) {
					size = 80;
				}

				// A default hash.
				let hash = '334c4a4c42fdb79d7ebc3e73b517e6f8';

				// Calculate the hash if the email seems email-like.
				if (email && !!regexEmail.test(email)) {
					hash = _md5(email);
				}

				return gravatar + hash + '?s=' + size + '&d=blank';
			};

			Vue.mixin({
				filters: {
					/**
					 * Format A Phone Number
					 *
					 * @param {string} phone Phone.
					 * @param {string} country Country.
					 * @returns {string} Phone number.
					 */
					phone: function(phone, country) {
						if (!('blobPhone' in window)) {
							console.warn('This filter requires the blob-phone Javascript library.\nhttps://github.com/Blobfolio/blob-phone#javascript');
							return phone;
						}

						const parsed = blobPhone.parse(phone, country);
						if (false !== parsed) {
							return parsed.number;
						}

						return phone;
					},
				},
			});

			// --------------------------------------------------------- end public



			// ---------------------------------------------------------
			// Validation
			// ---------------------------------------------------------

			/**
			 * Validate Form
			 *
			 * @param {DOMElement} el Form.
			 * @param {bool} touch Force touch.
			 * @returns {bool} True/false.
			 */
			function _validateForm(el, touch) {
				// Get our object back.
				if ('undefined' === typeof el.__blobForm__) {
					console.warn('Invalid vue-blob-form.');
					return false;
				}

				// Don't allow overlapping requests.
				if (el.__blobForm__.$lock) {
					return false;
				}
				el.__blobForm__.$lock = true;

				// Cast $touch to a boolean.
				touch = !!touch;

				// Before we start validating, let's reset the error holder
				// to clear any arbitrary messages a user might have
				// injected.
				el.__blobForm__.errors = {};

				// Loop and validate each field.
				const fields = _getFields.call(this, el);
				for (let i = 0; i < fields.length; ++i) {
					_validateField.call(
						this,
						el,
						fields[i],
						touch
					);
				}

				// Remove our lock.
				el.__blobForm__.$lock = false;

				// Update form classes.
				let vue = this;
				Vue.nextTick(function() {
					_updateFormClasses.call(vue, el);
				});

				return true;
			}

			/**
			 * Validate Field
			 *
			 * @param {DOMElement} form Form.
			 * @param {DOMElement} field Field.
			 * @param {bool} touch Force touch.
			 * @returns {bool} True/false.
			 */
			function _validateField(form, field, touch) {
				const name = _isForm(form);
				const fieldName = _isField(field);

				// If this is locked, get out of here.
				if (field.__blobForm__.$lock) {
					return false;
				}
				field.__blobForm__.$lock = true;

				// Cast $touch to a boolean.
				touch = !!touch;

				let fieldValue = field.value || '';
				let validity = false;

				// Mark it touched?
				if (touch && !field.__blobForm__.touched) {
					field.__blobForm__.touched = true;
				}

				// Mark it changed?
				let changed = (_checksum(fieldValue) !== field.__blobForm__.originalValue);
				if (changed !== field.__blobForm__.changed) {
					field.__blobForm__.changed = changed;
				}

				// Start checking validity!
				let valid = false;
				_resetValidity(field);

				// Either good or maybe the browser doesn't support the API.
				if (('undefined' === typeof field.willValidate) || field.checkValidity()) {
					valid = true;
				}
				// Maybe empty/required? This shouldn't be counted as an
				// in-your-face error unless the field has been touched.
				else if (!field.__blobForm__.touched) {
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
					const lastValue = (field.dataset.blobPhoneValue) || '';
					const lastValid = parseInt(field.dataset.blobPhoneValid, 10) || 0;

					// We need to reparse.
					if (lastValue !== fieldValue) {
						let country = (field.dataset.country || '').toUpperCase() || 'US';
						if (2 !== country.length) {
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
						valid = (1 === lastValid);
					}

					if (!valid) {
						field.setCustomValidity('Please enter a valid phone number.');
					}
				}

				// Extra checks?
				if (valid) {
					// A custom callback can be specified by including a
					// validation-callback attribute on the element.
					const fieldCallback = field.dataset.validationCallback || field.getAttribute('validation-callback') || false;
					if (fieldCallback && ('function' === typeof this[fieldCallback])) {
						let callbackResponse = this[fieldCallback](fieldValue);
						if (true !== callbackResponse) {
							valid = false;
							if (('string' === typeof callbackResponse) && callbackResponse.length) {
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

					if ('undefined' !== typeof form.__blobForm__.errors[fieldName]) {
						delete form.__blobForm__.errors[fieldName];
					}
				}
				// Otherwise record the error.
				else {
					form.__blobForm__.errors[fieldName] = field.validationMessage;
				}

				if (valid !== field.__blobForm__.valid) {
					field.__blobForm__.valid = valid;
				}

				// Update the field classes. These verbose conditions help
				// prevent unnecessary DOM mutations, cutting back on
				// overhead.
				_toggleClasses(
					field,
					['is-valid', 'is:valid'],
					['is-invalid', 'is:invalid'],
					field.__blobForm__.valid
				);

				_toggleClasses(
					field,
					['is-touched', 'is:touched'],
					[],
					field.__blobForm__.touched
				);

				_toggleClasses(
					field,
					['is-changed', 'is:changed'],
					[],
					field.__blobForm__.changed
				);

				// Remove the lock.
				field.__blobForm__.$lock = false;

				// Update the form's classes?
				if (
					!form.__blobForm__.$lock &&
					(
						(field.__blobForm__.valid !== form.__blobForm__.valid) ||
						(field.__blobForm__.touched !== form.__blobForm__.touched) ||
						(field.__blobForm__.changed !== form.__blobForm__.changed)
					)
				) {
					let vue = this;
					Vue.nextTick(function() {
						_updateFormClasses.call(vue, form);
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
			 * @param {DOMElement} el Field.
			 * @returns {bool} True/false.
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
			 * @param {DOMElement} el Field.
			 * @returns {bool} True/false.
			 */
			function _updateFormClasses(el) {
				const name = _isForm(el);
				if (!name) {
					return false;
				}

				let changed = false;
				let valid = !Object.keys(el.__blobForm__.errors).length;
				let touched = false;

				// The form is its fields. Loop through each to see if a
				// status deviates from the natural state.
				const fields = _getFields.call(this, el, false);
				for (let i = 0; i < fields.length; ++i) {
					if (!changed && fields[i].__blobForm__.changed) {
						changed = true;
					}

					if (valid && !fields[i].__blobForm__.valid) {
						valid = false;
					}

					if (!touched && fields[i].__blobForm__.touched) {
						touched = true;
					}

					// Nothing else to detect.
					if (changed && !valid && touched) {
						break;
					}
				}

				// Update variables.
				if (valid !== el.__blobForm__.valid) {
					el.__blobForm__.valid = valid;
				}
				if (changed !== el.__blobForm__.changed) {
					el.__blobForm__.changed = changed;
				}
				if (touched !== el.__blobForm__.touched) {
					el.__blobForm__.touched = touched;
				}

				// Update the form classes. These verbose conditions help
				// prevent unnecessary DOM mutations, cutting back on
				// overhead.
				_toggleClasses(
					el,
					['is-valid', 'is:valid'],
					['is-invalid', 'is:invalid'],
					valid
				);

				_toggleClasses(
					el,
					['is-touched', 'is:touched'],
					[],
					touched
				);

				_toggleClasses(
					el,
					['is-changed', 'is:changed'],
					[],
					changed
				);

				// Force Vue to update as it doesn't tend to notice deep
				// object changes right away.
				this.$forceUpdate();
			}

			// --------------------------------------------------------- end validation



			// ---------------------------------------------------------
			// Misc
			// ---------------------------------------------------------

			/**
			 * Get Form Name
			 *
			 * Make sure an element is in fact a form and return its name.
			 *
			 * @param {DOMElement} el Element.
			 * @returns {string|bool} Name or false.
			 */
			function _isForm(el) {
				if (
					!el ||
					!el.nodeName ||
					('FORM' !== el.nodeName) ||
					!el.getAttribute('name')
				) {
					return false;
				}

				return el.getAttribute('name');
			}

			/**
			 * Get Field Name
			 *
			 * Make sure an element is an INPUT, SELECT, or TEXTAREA and
			 * return its name.
			 *
			 * @param {DOMElement} el Element.
			 * @returns {string|bool} Name or false.
			 */
			function _isField(el) {
				if (
					!el ||
					!el.nodeName ||
					(
						('INPUT' !== el.nodeName) &&
						('SELECT' !== el.nodeName) &&
						('TEXTAREA' !== el.nodeName)
					) ||
					el.disabled ||
					!el.getAttribute('name') ||
					('button' === el.getAttribute('type')) ||
					('submit' === el.getAttribute('type')) ||
					('reset' === el.getAttribute('type'))
				) {
					return false;
				}

				// One last check: disregard any "ignored" field.
				if (
					el.hasAttribute('novalidate-field') ||
					el.hasAttribute('data-novalidate-field')
				) {
					return false;
				}

				return el.getAttribute('name');
			}

			/**
			 * Get Form By Name
			 *
			 * @param {string} name Name.
			 * @return {DOMElement|bool} Element or false.
			 */
			function _getFormByName(name) {
				// Make sure the form is valid.
				if (!name) {
					return false;
				}

				// Get our object back.
				const el = document.querySelector('form[name="' + name + '"]');
				if (!el || !_isForm(el) || ('undefined' === typeof el.__blobForm__)) {
					return false;
				}

				return el;
			}

			/**
			 * Get Form Field Name
			 *
			 * @param {DOMElement} el Form element.
			 * @param {string} name Field Name.
			 * @return {DOMElement|bool} Element or false.
			 */
			function _getFormFieldByName(el, name) {
				const fields = _getFields.call(this, el);
				if (false !== fields) {
					for (let i = 0; i < fields.length; ++i) {
						let name2 = fields[i].getAttribute('name') || '';
						if (name2 === name) {
							return fields[i];
						}
					}
				}

				return false;
			}

			/**
			 * Get Form Fields
			 *
			 * Find form field elements belonging to a given form.
			 *
			 * @param {DOMElement} el Form.
			 * @returns {array|false} Field elements or false.
			 */
			function _getFields(el) {
				// Make sure the form is valid.
				if (false === _isForm(el)) {
					return false;
				}

				// Add any fields with a name to our list.
				let out = [];
				let vue = this;
				let changed = false;
				let fieldNames = [];

				for (let i = 0; i < el.elements.length; ++i) {
					let fieldName = _isField(el.elements[i]);

					if (fieldName) {
						// We might have to initialize it.
						if ('undefined' === typeof el.elements[i].__blobForm__) {
							/* eslint-disable */
							// console.warn('Missing Field Data: ' + fieldName);
							/* eslint-enable */

							el.elements[i].__blobForm__ = {
								originalValue: _checksum(el.elements[i].value || ''),
								changed: false,
								touched: false,
								valid: true,
								$lock: false,
							};

							// Bind an input listener to monitor blur,
							// AKA what we're calling "touched".
							el.elements[i].addEventListener('blur', function(e) {
								Vue.nextTick(function() {
									_validateField.call(vue, el, e.target, true);
								});
							});

							changed = true;
						}

						fieldNames.push(fieldName);
						out.push(el.elements[i]);
					}
				}

				// Keep track of the fieldCount to prevent ghost errors.
				const fieldLength = out.length;
				if (el.__blobForm__.fieldCount !== fieldLength) {
					// If the form used to have more fields than it does
					// now, let's remove any "other" errors to prevent
					// ghost weirdness.
					if (
						el.__blobForm__.fieldCount > fieldLength &&
						!el.__blobForm__.$lock
					) {
						if (!fieldLength) {
							el.__blobForm__.errors = {};
						}
						else {
							const errorKeys = Object.keys(el.__blobForm__.errors);

							for (let i = 0; i < errorKeys.length; ++i) {
								if (-1 === fieldNames.indexOf(errorKeys[i])) {
									delete el.__blobForm__.errors[errorKeys[i]];
								}
							}
						}
					}

					el.__blobForm__.fieldCount = out.length;
					changed = true;
				}

				// Force Vue to update as it doesn't tend to notice deep
				// object changes right away.
				if (changed) {
					this.$forceUpdate();

					Vue.nextTick(function() {
						_updateFormClasses.call(vue, el);
					});
				}

				return out.length ? out : false;
			}

			/**
			 * Toggle Element Classes
			 *
			 * If the condition passes, add the good and remove the bad
			 * classes. Otherwise, do the reverse.
			 *
			 * @param {DOMElement} el Element.
			 * @param {mixed} good Good classes.
			 * @param {mixed} bad Bad classes.
			 * @param {bool} test Condition.
			 * @returns {bool} True/false.
			 */
			function _toggleClasses(el, good, bad, test) {
				if (!el.getAttribute('name')) {
					return false;
				}

				// We want an array of good classes.
				if ('string' === typeof good) {
					good = good.split(' ');
				}
				if (!Array.isArray(good)) {
					return false;
				}

				// We want an array of bad classes.
				if ('string' === typeof bad) {
					bad = bad.split(' ');
				}
				if (!Array.isArray(bad)) {
					return false;
				}

				test = !!test;
				let hasClass;

				// Loop through the good.
				for (let i = 0; i < good.length; ++i) {
					if (!good[i]) {
						continue;
					}

					hasClass = el.classList.contains(good[i]);

					// Add it.
					if (test && !hasClass) {
						el.classList.add(good[i]);
					}
					// Remove it.
					else if (!test && hasClass) {
						el.classList.remove(good[i]);
					}
				}

				// Loop through the bad.
				for (let i = 0; i < bad.length; ++i) {
					if (!bad[i]) {
						continue;
					}

					hasClass = el.classList.contains(bad[i]);

					// Add it.
					if (!test && !hasClass) {
						el.classList.add(bad[i]);
					}
					// Remove it.
					else if (test && hasClass) {
						el.classList.remove(bad[i]);
					}
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
			 * @param {mixed} value Value.
			 * @returns {string} Hash.
			 */
			function _checksum(value) {
				// We need a string. For objects, JSON will suffice.
				if ('object' === typeof value) {
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
				let hash = 0;
				const strlen = value.length;

				for (let i = 0; i < strlen; ++i) {
					let c = value.charCodeAt(i);
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
			 * @param {string} str String.
			 * @returns {string} Hash.
			 */
			function _md5(str) {
				/* eslint-disable */
				const md5cycle = function(x, k) {
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
						for (i = 0; i < s.length; ++i)
						{tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);}
						tail[i >> 2] |= 0x80 << ((i % 4) << 3);
						if (55 < i) {
							md5cycle(state, tail);
							for (i = 0; 16 > i; ++i) tail[i] = 0;
						}
						tail[14] = n * 8;
						md5cycle(state, tail);
						return state;
					},

					md5blk = function(s) {
						var md5blks = [],
							i; // Andy King said do it this way.
						for (i = 0; 64 > i; i += 4) {
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
						for (; 4 > j; j++)
						{s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] +
						hex_chr[(n >> (j * 8)) & 0x0F];}
						return s;
					},

					hex = function(x) {
						for (var i = 0; i < x.length; ++i)
						{x[i] = rhex(x[i]);}
						return x.join('');
					},

					add32 = function(a, b) {
						return (a + b) & 0xFFFFFFFF;
					};

				return hex(md51(str));
				/* eslint-enable */
			}

			/**
			 * Debounce
			 *
			 * @param {function} fn Callback.
			 * @param {bool} wait Wait.
			 * @param {bool} no_postpone Do it now.
			 * @returns {callback} Wrapper function.
			 */
			const _debounce = function(fn, wait, no_postpone) {
				let args;
				let context;
				let result;
				let timeout;
				let executed = true;

				/**
				 * Ping
				 *
				 * @returns {void} Nothing.
				 */
				function ping() {
					result = fn.apply(context || this, args || []);
					context = args = null;
					executed = true;
				}

				/**
				 * Cancel Timeout
				 *
				 * @returns {void} Nothing.
				 */
				function cancel() {
					if (timeout) {
						clearTimeout(timeout);
						timeout = null;
					}
				}

				/**
				 * Wrapper
				 *
				 * @returns {void} Nothing.
				 */
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
			 * @param {Vue} vnode Vnode.
			 * @returns {string} Name.
			 */
			function _getModelName(vnode) {
				try {
					return vnode.data.directives.find(function(o) {
						return ('model' === o.name);
					}).expression;
				} catch (Ex) {
					return false;
				}
			}

			// --------------------------------------------------------- end misc

		},
	};

	// Hook the code into Vue.
	if ('undefined' !== typeof window && window.Vue) {
		window.Vue.use(BlobFormsVue);
	}

})();
