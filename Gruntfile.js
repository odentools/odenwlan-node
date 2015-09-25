module.exports = function(grunt) {

	// Configurations
	grunt.initConfig({

		// Read the package.json
		pkg: grunt.file.readJSON('package.json'),

		// Make a distribution package with using grunt-electron
		electron: {
			linux64: {
				options: {
					name: 'odenwlan',
					dir: '.',
					out: 'dists',
					ignore: '(dists/|node_modules/grunt.*|\.git.*|Gruntfile\.js)',
					version: '0.29.2',
					platform: 'linux',
					arch: 'x64',
					icon: 'images/icon.png',
					overwrite: true
				}
			},
			win32: {
				options: {
					name: 'odenwlan',
					dir: '.',
					out: 'dists',
					ignore: '(dists/|node_modules/grunt.*|\.git.*|Gruntfile\.js)',
					version: '0.29.2',
					platform: 'win32',
					arch: 'ia32',
					icon: 'images/icon.png',
					overwrite: true,
					'version-string.CompanyName': '<%= pkg.author %>',
					'version-string.LegalCopyright': '(C) <%= pkg.author %>',
					'version-string.ProductName': 'odenwlan-node',
					'version-string.ProductVersion': '<%= pkg.version %>',
					'version-string.FileDescription': '<%= pkg.description %>',
					'version-string.FileVersion': '<%= grunt.template.today("yyyymmdd") %>'

				}
			}
		},

		// Lint with using grunt-eslint
		eslint: {
			target: '.'
		},

		// Test with using grunt-mocha-test
		mochaTest: {
			test: {
				src: ['tests/*.js'],
			}
		}

	});

	// Load tasks
	grunt.loadNpmTasks('grunt-electron');
	grunt.loadNpmTasks('grunt-eslint');
	grunt.loadNpmTasks('grunt-mocha-test');

	// Register tasks
	grunt.registerTask('test', ['eslint', 'mochaTest']);
	grunt.registerTask('default', ['test', 'electron']);

};
