/**
 * Demo: vue-blob-forms
 *
 * This is a quick little demonstration of different field types and
 * methods.
 *
 * @see https://blobfolio.com
 * @see https://github.com/Blobfolio/vue-blob-forms
 */
(function(){

// Set up Vue with some basic data.
var app = new Vue({
	el: '#vue-app',
	data: {
		fields: {
			date: '2020-01-01',
			email: '',
			number: 0,
			tel: '',
			text: '',
			textarea: '',
			toggled: '',
			select: '',
			multiselect: [],
		},
		dateMin: '2015-01-01',
		dateMax: '2018-01-01',
		numMin: 1,
		numMax: 10,
		showingToggle: false,
	},
	methods: {
	},
});

})();