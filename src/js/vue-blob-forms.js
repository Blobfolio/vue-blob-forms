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

		// This will hold form states.
		Vue.prototype.blobForms = {};

		Vue.mixin({
			computed: {
				blobFormsStatuses: function() {
					console.log('calculating');
					var out = {
						changed: [],
						valid: [],
						touched: [],
					};

					var forms = Object.keys(this.blobForms);
					for (i=0; i<forms.length; i++) {
						var changed = false,
							valid = true,
							touched = false;

						var fields = Object.keys(this.blobForms[forms[i]].fields);
						for (j=0; j<fields.length; j++) {
							if (!changed && this.blobForms[forms[i]].fields[fields[j]].changed) {
								changed = true;
								out.changed.push(forms[i]);
							}

							if (valid && !this.blobForms[forms[i]].fields[fields[j]].valid) {
								valid = false;
							}

							if (!touched && this.blobForms[forms[i]].fields[fields[j]].touched) {
								touched = true;
								out.touched.push(forms[i]);
							}

							// Nothing else to detect.
							if (changed && !valid && touched) {
								j = fields.length;
							}
						}

						if (valid) {
							out.valid.push(forms[i]);
						}
					}

					return out;
				}
			},
		});

		// ------------------------------------------------------------- end setup



		// -------------------------------------------------------------
		// Directive
		// -------------------------------------------------------------

		/**
		 * v-blob-forms
		 *
		 * Apply this directive to a form element to engage validation
		 * helpers.
		 */
		Vue.directive('blobForms', {
			id: 'blobForms',
			priority: 50000,
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
					fields: {},
					errors: {},
					changed: false,
					touched: false,
					valid: true,
					$lock: false,
				});

				// Watch for element changes.
				var observer = new MutationObserver(function(mutations) {
					Vue.nextTick(function() {
						_loadFields(el);
					});
				});
				observer.observe(el, {childList: true, subtree: true});

				// Bind an input listener to monitor changes.
				el.addEventListener('input', function (e) {
					Vue.nextTick(function() {
						if (false !== _isField(e.target)) {
							_validateField(el, e.target);
						}
					});
				});

				// And go ahead and get the ball rolling now.
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

		// ------------------------------------------------------------- end directive



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
			var name = _isForm(el);
			if (
				!name ||
				typeof $scope[name] === 'undefined' ||
				$scope[name].blobForms[name].$lock
			) {
				return false;
			}

			// Lock the form to prevent redundant changes.
			Vue.set($scope[name].blobForms[name], '$lock', true);

			touch = !!touch;
			var fieldKeys = Object.keys($scope[name].blobForms[name].fields);
			for (i=0; i<fieldKeys.length; i++) {
				_validateField(
					el,
					$scope[name].blobForms[name].fields[fieldKeys[i]].el,
					touch
				);
			}

			// And unlock.
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
			var name = _isForm(form);
			if (
				!name ||
				typeof $scope[name] === 'undefined'
			) {
				return false;
			}

			var fieldName = _isField(field);
			if (!field) {
				return false;
			}

			touch = !!touch;

			var fieldValue = field.value || field.getAttribute('value') || '',
				validity = false,
				data = $scope[name].blobForms[name].fields[fieldName];

			// Are we locked?
			if (data.$lock) {
				return false;
			}
			Vue.set($scope[name].blobForms[name].fields[fieldName], '$lock', true);

			// Mark it touched?
			if (touch && !data.touched) {
				Vue.set($scope[name].blobForms[name].fields[fieldName], 'touched', true);
			}

			// Mark it changed?
			var changed = (_checksum(fieldValue) !== data.originalValue);
			if (changed !== data.changed) {
				Vue.set($scope[name].blobForms[name].fields[fieldName], 'changed', changed);
			}

			// Start checking validity!
			var valid = false;
			_resetValidity(field);

			// Probably good!
			if ((typeof field.willValidate === 'undefined') || field.checkValidity) {
				valid = true;
			}
			// Maybe empty/required?
			else if (!data.touched) {
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

				if ($scope[name].blobForms[name].errors[fieldName]) {
					Vue.delete($scope[name].blobForms[name].errors, fieldName);
				}
			}
			// Or add the new error.
			else {
				Vue.set($scope[name].blobForms[name].errors, fieldName, field.validationMessage);
			}
			Vue.set($scope[name].blobForms[name].fields[fieldName], 'valid', valid);

			// Update the field classes.
			field.classList.toggle('is-valid', data.valid);
			field.classList.toggle('is-invalid', !data.valid);
			field.classList.toggle('is-touched', data.touched);
			field.classList.toggle('is-changed', data.changed);

			// Remove the lock.
			Vue.set($scope[name].blobForms[name].fields[fieldName], '$lock', false);

			// Update form classes?
			if (!$scope[name].blobForms[name].$lock) {
				Vue.nextTick(function() {
					_updateFormClasses(form);
				});
			}

			return data.valid;
		}

		/**
		 * Reset Field Validity Status
		 *
		 * @param DOMElement $el Field.
		 * @return bool True/false.
		 */
		function _resetValidity(el) {
			try {
				field.checkValidity();
				field.setCustomValidity('');
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

			el.classList.toggle('is-valid', $scope[name].blobFormsStatuses.valid.indexOf(name) !== -1);
			el.classList.toggle('is-invalid', $scope[name].blobFormsStatuses.valid.indexOf(name) === -1);
			el.classList.toggle('is-touched', $scope[name].blobFormsStatuses.touched.indexOf(name) !== -1);
			el.classList.toggle('is-changed', $scope[name].blobFormsStatuses.changed.indexOf(name) !== -1);
		}

		// ------------------------------------------------------------- end validation



		// -------------------------------------------------------------
		// Misc
		// -------------------------------------------------------------

		/**
		 * Get Form Name
		 *
		 * Make sure an element is a form, and that it has a name.
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
		 * Make sure an element is a field, and that it has a name.
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
		 * Find all named fields under a form.
		 *
		 * @param DOMElement $el Form.
		 * @return array|false Field elements or false.
		 */
		function _getFields(el) {
			if (false === _isForm(el)) {
				return false;
			}

			var fields = el.querySelectorAll('input, select, textarea');

			if (!fields) {
				return false;
			}

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
		 * @param DOMElement $el Form.
		 * @return bool True/false.
		 */
		function _loadFields(el) {
			var name = _isForm(el);
			if (false === name) {
				return false;
			}

			var fields = _getFields(el);
			if (false === fields) {
				Vue.set($scope[name].blobForms[name], 'fields', {});
				return false;
			}

			var changed = false;

			// Make sure each field is represented.
			var fieldNames = [];
			for (i=0; i<fields.length; i++) {
				var fieldName = fields[i].getAttribute('name') || '';
				if (!fieldName) {
					continue;
				}

				// Add it if missing.
				if (typeof $scope[name].blobForms[name].fields[fieldName] === 'undefined') {
					changed = true;

					Vue.set($scope[name].blobForms[name].fields, fieldName, {
						name: fieldName,
						el: fields[i],
						originalValue: _checksum(fields[i].value),
						changed: false,
						touched: false,
						valid: true,
						$lock: false,
					});

					// And add to our running list.
					fieldNames.push(fieldName);
				}
			}

			// Remove any outmoded data.
			var fieldKeys = Object.keys($scope[name].blobForms[name].fields);
			if (fieldKeys.length !== fieldNames.length) {
				for (i=0; i<fieldKeys.length; i++) {
					if (fieldNames.indexOf(fieldKeys[i]) === -1) {
						changed = true;
						Vue.delete($scope[name].blobForms[name].fields, fieldKeys[i]);
					}
				}
			}

			return true;
		}

		/**
		 * Simple Checksum
		 *
		 * This will generate a simple hash key to aid with change
		 * tracking, etc.
		 *
		 * @param mixed $value Value.
		 * @return string Hash.
		 */
		function _checksum(value) {
			// Stringify objects.
			if (typeof value === 'object') {
				try {
					value = JSON.stringify(value);
				} catch (Ex) {
					return 0;
				}
			}

			var hash = 0,
				strlen = value.length,
				i,
				c;

			if (!strlen) return hash;

			for (i=0; i<strlen; i++) {
				c = value.charCodeAt(i);
				hash = ((hash << 5) - hash) + c;
				hash = hash & hash; // Convert to 32-bit integer.
			}

			return hash;
		}

		// ------------------------------------------------------------- end misc

	} ;

	// Hook the code into Vue.
	if (typeof window !== 'undefined' && window.Vue) {
		window.Vue.use(BlobFormsVue);
	}

})();