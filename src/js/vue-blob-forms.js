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

				// Watch for element changes. Vue doesn't propagate
				// changes correctly if this huge block of code is moved
				// elsewhere. Oh well.
				var observer = new MutationObserver(function(mutations) {
					var fieldKeys = Object.keys(vnode.context.blobFields[name]),
						errorKeys = Object.keys(vnode.context.blobErrors[name]),
						fieldName,
						changed = false;
					for (i=0; i<mutations.length; i++) {
						// New fields?
						for (j=0; j<mutations[i].addedNodes.length; j++) {
							fieldName = _isField[mutations[i].addedNodes[j]];
							if (fieldName && fieldKeys.indexOf(fieldName) === -1) {
								changed = true;
								fieldKeys.push(fieldName);
								Vue.set($scope[name].blobFields[name], fieldName, {
									name: fieldName,
									el: fields[i],
									originalValue: _checksum(mutations[i].addedNodes[j]),
									changed: false,
									touched: false,
									valid: true,
									$lock: false,
								});
							}
						}

						// Removed fields?
						for (j=0; j<mutations[i].removedNodes.length; j++) {
							fieldName = _isField[mutations[i].removedNodes[j]];
							if (fieldName) {
								var fieldEvents = getEventListeners(mutations[i].removedNodes[j]);
								for (k=0; k<fieldEvents.length; k++) {
									fieldEvents[k].remove();
								}

								// Remove field.
								if (fieldKeys.indexOf(fieldName) !== -1) {
									changed = true;
									Vue.delete($scope[name].blobFields[name], fieldName);
								}
								// Remove error.
								if (errorKeys.indexOf(fieldName) !== -1) {
									changed = true;
									Vue.delete($scope[name].blobErrors[name], fieldName);
								}
							}
						}

						// Force Vue to update as it doesn't tend to
						// notice deep object changes right away.
						if (changed) {
							vnode.context.$forceUpdate();
						}
					}
				});
				observer.observe(el, {childList: true, subtree: true});

				// Bind an input listener to monitor changes.
				el.addEventListener('input', function (e) {
					Vue.nextTick(function() {
						if ((e.target.tagName !== 'SELECT') && (false !== _isField(e.target))) {
							_validateField(el, e.target, true);
						}
					});
				});

				// Use change events for SELECT fields as a workaround
				// for Chrome.
				el.addEventListener('change', function (e) {
					Vue.nextTick(function() {
						if ((e.target.tagName === 'SELECT') && (false !== _isField(e.target))) {
							_validateField(el, e.target, true);
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
			if (!name || (typeof this.blobForms[name] === 'undefined')) {
				return false;
			}

			var errors = this.blobErrors[name] || {},
				errorKeys = Object.keys(errors);

			if (!errorKeys.length) {
				return false;
			}

			if (fieldName) {
				if (errorKeys.indexOf(fieldName) === -1) {
					return false;
				}

				return errors[fieldName];
			}

			return errors;
		};

		/**
		 * Validate Form
		 *
		 * @param string $name Form name.
		 * @return bool|object True or errors.
		 */
		Vue.prototype.validateForm = function(name) {
			if (!name || (typeof this.blobForms[name] === 'undefined')) {
				return { other: 'Invalid form.' };
			}

			_validateForm(this.blobForms[name].el, true);

			var errors = this.blobErrors[name] || {},
				errorKeys = Object.keys(errors);

			return errorKeys.length ? errors : true;
		};

		/**
		 * Form/Field Touched
		 *
		 * @param string Form name.
		 * @param string Field name.
		 * @return bool True/false.
		 */
		Vue.prototype.formTouched = function(name, fieldName) {
			if (!name || (typeof this.blobForms[name] === 'undefined')) {
				return false;
			}

			// Field?
			if (fieldName) {
				return this.blobFields[name][fieldName] && this.blobFields[name][fieldName].touched;
			}

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
			if (!name || (typeof this.blobForms[name] === 'undefined')) {
				return false;
			}

			// Field?
			if (fieldName) {
				return this.blobFields[name][fieldName] && this.blobFields[name][fieldName].changed;
			}

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
			if (!name || (typeof this.blobForms[name] === 'undefined')) {
				return false;
			}

			// Field?
			if (fieldName) {
				return this.blobFields[name][fieldName] && this.blobFields[name][fieldName].valid;
			}

			return this.blobForms[name].valid;
		};

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
			var fieldKeys = Object.keys($scope[name].blobFields[name]);
			for (i=0; i<fieldKeys.length; i++) {
				_validateField(
					el,
					$scope[name].blobFields[name][fieldKeys[i]].el,
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

			var fieldValue = field.value || '',
				validity = false;

			// Are we locked?
			if ($scope[name].blobFields[name][fieldName].$lock) {
				return false;
			}
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

			// Probably good!
			if ((typeof field.willValidate === 'undefined') || field.checkValidity()) {
				valid = true;
			}
			// Maybe empty/required?
			else if (!$scope[name].blobFields[name][fieldName].touched) {
				validity = field.validity;
				if (validity.valueMissing) {
					valid = true;
					_resetValidity(field);
				}
			}

			if ($scope[name].blobFields[name][fieldName].touched && !fieldValue.length) {
				validity = field.validity;
				if (validity.valueMissing) {
					valid = false;
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

				if ($scope[name].blobErrors[name][fieldName]) {
					Vue.delete($scope[name].blobErrors[name], fieldName);
				}
			}
			// Or add the new error.
			else {
				Vue.set($scope[name].blobErrors[name], fieldName, field.validationMessage);
			}
			Vue.set($scope[name].blobFields[name][fieldName], 'valid', valid);

			// Update the field classes. This crazy long prevents
			// unnecessary DOM mutations, so ends up a performance win,
			// even if it is ugly.
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

			// Update form classes?
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

			// Update classes. Again, this crazy-ugly block helps to
			// limit needless DOM mutations.
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

			// Pull fields by searching DOM.
			var fields = el.querySelectorAll('input, select, textarea');
			if (!fields) {
				return false;
			}

			// Add the names.
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
			var fieldNames = [],
				fieldKeys = Object.keys($scope[name].blobFields[name]),
				errorKeys = Object.keys($scope[name].blobFields[name]);
			for (i=0; i<fields.length; i++) {
				var fieldName = fields[i].getAttribute('name') || '';
				if (!fieldName) {
					continue;
				}

				// Add it if missing.
				if (fieldKeys.indexOf(fieldName) === -1) {
					changed = true;
					fieldKeys.push(fieldName);

					Vue.set($scope[name].blobFields[name], fieldName, {
						name: fieldName,
						el: fields[i],
						originalValue: _checksum(fields[i].value),
						changed: false,
						touched: false,
						valid: true,
						$lock: false,
					});

					// Bind an input listener to monitor blur.
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
						var fieldEvents = getEventListeners($scope[name].blobFields[name].el);
						for (j=0; j<fieldEvents.length; j++) {
							fieldEvents[j].remove();
						}

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