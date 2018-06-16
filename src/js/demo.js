/**
 * Demo: vue-blob-forms
 *
 * This is a quick little demonstration of different field types and
 * methods.
 *
 * @see https://blobfolio.com
 * @see https://github.com/Blobfolio/vue-blob-forms
 */

/* global Vue */

(function() {

	// Set up Vue with some basic data.
	new Vue({
		el: '#vue-app',
		data: {
			fields: {
				beatle: 'Yellow Submarine',
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
			beatlesMovies: [
				'aharddaysnight',
				'help',
				'magicalmysterytour',
				'yellowsubmarine',
				'letitbe',
			],
		},
		methods: {
			/**
			 * Validate Beatles Movie
			 *
			 * @param {string} film Film.
			 * @returns {mixed} True or error.
			 */
			validateBeatlesMovie: function(film) {
				film = (film + '').trim().toLowerCase().replace(/[^a-z]/g, '');
				if (-1 !== this.beatlesMovies.indexOf(film)) {
					return true;
				}

				return 'A valid Beatles movie title is required.';
			},
			/**
			 * Arbitrary Error
			 *
			 * @returns {void} Nothing.
			 */
			otherError: function() {
				this.setFormErrors('demo', {miscError: 'This is a random non-field error.'});
			},
		},
	});

})();
