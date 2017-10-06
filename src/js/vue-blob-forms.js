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
		var regex_email = new RegExp(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);

		// It is too easy to lose the vnode context with Vue directives.
		var $scope = {};

		// This will hold form states.
		Vue.prototype.blobForms = {};

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
			bind: function(el, binding, vnode) {
				var name = _isForm(el);
				if (name) {
					if (typeof $scope[name] !== 'undefined') {
						return false;
					}
				}

				// Save the scope so we have it later.
				$scope[name] = vnode.context;

				vnode.context.blobForms[name] = {
					name: name,
					el: el,
					fields: {},
					errors: {},
					changed: false,
					touched: false,
					valid: true,
				};
			},
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
				if (!name || (typeof $scope[name] === 'undefined')) {
					return;
				}

				// How are the fields looking?
				var fields = _getFields(el),
					fieldNames = [];
				if (false !== fields) {
					for (i=0; i<fields.length; i++) {
						var fieldName = fields[i].getAttribute('name') || '';
						if (!name) {
							continue;
						}

						fieldNames.push(fieldName);
						if (typeof $scope[name].blobForms[name].fields[fieldName] === 'undefined') {
							$scope[name].blobForms[name].fields[fieldName] = {
								name: name,
								el: fields[i],
								error: '',
								originalValue: fields[i].val,
								touched: false,
								valid: true,
							};
						}
					}
				}

				// Anything to remove?
				var fieldKeys = Object.keys($scope[name].blobForms[name].fields);
				for (i=0; i<fieldKeys.length; i++) {
					if (fieldNames.indexOf(fieldKeys[i]) === -1) {
						delete($scope[name].blobForms[name].fields[fieldKeys[i]]);
					}
				}

				// Go ahead and run validations.
				Vue.nextTick(function(){
					$scope[name].validateForm(name);
				});
			},
		});

		// ------------------------------------------------------------- end directive



		// -------------------------------------------------------------
		// Validation
		// -------------------------------------------------------------
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
		 * Get Form Fields
		 *
		 * Find all named fields under a form.
		 *
		 * @param DOMElement $el Form.
		 * @return array|false Field elements or false.
		 */
		function _getFields(el) {
			if (false === _isForm) {
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

		// ------------------------------------------------------------- end misc

	};

	// Hook the code into Vue.
	if (typeof window !== 'undefined' && window.Vue) {
		window.Vue.use(BlobFormsVue);
	}

})();