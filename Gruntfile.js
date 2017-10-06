/*global module:false*/
module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		// Metadata.
		pkg: grunt.file.readJSON('package.json'),

		// SCSS.
		sass: {
			dist: {
				options: {
					style: 'compressed'
				},
				files: {
					'demo/assets/demo.css': 'src/scss/demo.scss'
				}
			}
		},

		// CSS Processing.
		postcss: {
			options: {
				map: true,
				processors: [
					require('postcss-fixes')(),
					require('autoprefixer')( { browsers: 'last 3 versions' } ), // vendor prefixes
					require('cssnano')({
						safe: true,
						calc: false,
						zindex : false
					})
				]
			},

			dist: {
				src: 'demo/assets/*.css'
			}
		},

		// Javascript processing.
		jshint: {
			all: ['src/js/vue-blob-forms.js']
		},

		uglify: {
			options: {
				mangle: false
			},
			my_target: {
				files: {
					'dist/vue-blob-forms.min.js': ['src/js/vue-blob-forms.js'],
					'demo/assets/demo.min.js': ['src/js/demo.js'],
					'demo/assets/vue-blob-forms.min.js': ['src/js/vue-blob-forms.js'],
				}
			}
		},

		// File watcher.
		watch: {
			styles: {
				files: ['src/scss/*.scss', 'dist/css/*.css'],
				tasks: ['css', 'notify:css'],
				options: {
					spawn: false
				},
			},

			scripts: {
				files: ['src/js/*.js'],
				tasks: ['javascript', 'notify:js'],
				options: {
					spawn: false
				},
			}
		},

		// Notifications.
		notify: {
			css: {
				options:{
					title: "CSS Files built",
					message: "SASS and Post CSS task complete"
				}
			},

			js: {
				options: {
					title: "JS Files built",
					message: "Uglify and JSHint task complete"
				}
			}
		}
	});

	// These plugins provide necessary tasks.
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-sass');
	grunt.loadNpmTasks('grunt-postcss');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-notify');

	// Tasks.
	grunt.registerTask('default', ['css', 'javascript']);
	grunt.registerTask('css', ['sass', 'postcss']);
	grunt.registerTask('javascript', ['jshint', 'uglify']);

	grunt.event.on('watch', function(action, filepath, target) {
		grunt.log.writeln(target + ': ' + filepath + ' has ' + action);
	});
};