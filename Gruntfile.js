module.exports = function(grunt) {

	// Configurations
	grunt.initConfig({
		// Read the package.json
		pkg: grunt.file.readJSON('package.json'),

		// grunt-electron
		electron: {
			linux64: {
				options: {
					name: 'odenwlan',
					dir: '.',
					out: 'dist',
					ignore: '(dist/|node_modules/grunt.*|\.git.*|Gruntfile\.js)',
					version: '0.29.2',
					platform: 'linux',
					arch: 'x64',
					icon: 'img/icon.png'
				}
			},
			win32: {
				options: {
					name: 'odenwlan',
					dir: '.',
					out: 'dist',
					ignore: '(dist/|node_modules/grunt.*|\.git.*|Gruntfile\.js)',
					version: '0.29.2',
					platform: 'win32',
					arch: 'ia32',
					icon: 'img/icon.png',
					'version-string.CompanyName': '<%= pkg.author %>',
					'version-string.LegalCopyright': '(C) <%= pkg.author %>',
					'version-string.ProductName': 'odenwlan-node',
					'version-string.ProductVersion': '<%= pkg.version %>',
					'version-string.FileDescription': '<%= pkg.description %>',
					'version-string.FileVersion': '<%= grunt.template.today("yyyymmdd") %>'
				}
			}
		}
	});

	// Load tasks
	grunt.loadNpmTasks('grunt-electron');

	// Register tasks
	grunt.registerTask('default', ['electron']);

};
