module.exports = function (grunt) {
  const buildDir = "dist";
  const dockerImageName = "clems4ever/authelia";
  const clientDirectory = "src/client";
  const serverDirectory = "src/server";
  const clientResourcesDirectory = `${clientDirectory}/resources`;

  grunt.initConfig({
    run: {
      options: {},
      "build": {
        cmd: "./node_modules/.bin/tsc",
        args: []
      },
      "tslint": {
        cmd: "./node_modules/.bin/tslint",
        args: ['-c', 'tslint.json', '-p', 'tsconfig.json']
      },
      "cover": {
        cmd: "npm",
        args: ["run-script", "cover"]
      },
      "test": {
        cmd: "npm",
        args: ['run', 'test']
      },
      "docker-build": {
        cmd: "docker",
        args: ['build', '-t', dockerImageName, '.']
      },
      "docker-restart": {
        cmd: "docker-compose",
        args: ['-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml', 'restart', 'auth']
      },
      "minify": {
        cmd: "./node_modules/.bin/uglifyjs",
        args: [`${buildDir}/src/server/public_html/js/authelia.js`, '-o', `${buildDir}/src/server/public_html/js/authelia.min.js`]
      },
      "apidoc": {
        cmd: "./node_modules/.bin/apidoc",
        args: ["-i", "src/server", "-o", "doc"]
      },
      "make-dev-views": {
        cmd: "sed",
        args: ["-i", "s/authelia\.min/authelia/", `${buildDir}/src/server/views/layout/layout.pug`]
      }
    },
    copy: {
      resources: {
        expand: true,
        cwd: 'src/server/resources/',
        src: '**',
        dest: `${buildDir}/${serverDirectory}/resources/`
      },
      views: {
        expand: true,
        cwd: 'src/server/views/',
        src: '**',
        dest: `${buildDir}/${serverDirectory}/views/`
      },
      images: {
        expand: true,
        cwd: `${clientResourcesDirectory}/img`,
        src: '**',
        dest: `${buildDir}/${serverDirectory}/public_html/img/`
      }
    },
    browserify: {
      dist: {
        src: [`${buildDir}/${clientDirectory}/lib/index.js`],
        dest: `${buildDir}/${serverDirectory}/public_html/js/authelia.js`,
        options: {
          browserifyOptions: {
            standalone: 'authelia'
          },
        },
      },
    },
    watch: {
      views: {
        files: [`${serverDirectory}/views/**/*.pug`],
        tasks: ['copy:views'],
        options: {
          interrupt: false,
          atBegin: true
        }
      },
      resources: {
        files: [`${serverDirectory}/resources/*.ejs`],
        tasks: ['copy:resources'],
        options: {
          interrupt: false,
          atBegin: true
        }
      },
      images: {
        files: [`${clientResourcesDirectory}/img/**`],
        tasks: ['copy:images'],
        options: {
          interrupt: false,
          atBegin: true
        }
      },
      css: {
        files: [`${clientResourcesDirectory}/css/*.css`],
        tasks: ['concat:css', 'cssmin'],
        options: {
          interrupt: true,
          atBegin: true
        }
      },
      client: {
        files: [`${clientDirectory}/lib/**/*.ts', 'test/client/lib/**/*.ts`],
        tasks: ['build-dev'],
        options: {
          interrupt: true,
          atBegin: true
        }
      },
      server: {
        files: [`${serverDirectory}/**/*.ts`, 'test/server/**/*.ts'],
        tasks: ['build', 'run:make-dev-views', 'run:docker-restart'],
        options: {
          interrupt: true,
        }
      }
    },
    concat: {
      css: {
        src: [`${clientResourcesDirectory}/css/*.css`],
        dest: `${buildDir}/${serverDirectory}/public_html/css/authelia.css`
      },
    },
    cssmin: {
      target: {
        files: {
          [`${buildDir}/${serverDirectory}/public_html/css/authelia.min.css`]: [`${buildDir}/${serverDirectory}/public_html/css/authelia.css`]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-run');

  grunt.registerTask('default', ['build-dist']);

  grunt.registerTask('build-resources', ['copy:resources', 'copy:views', 'copy:images', 'concat:css']);

  grunt.registerTask('build-dev', ['run:tslint', 'run:build', 'browserify:dist', 'build-resources', 'run:make-dev-views']);
  grunt.registerTask('build-dist', ['build-dev', 'run:minify', 'cssmin']);

  grunt.registerTask('docker-build', ['run:docker-build']);
  grunt.registerTask('docker-restart', ['run:docker-restart']);

  grunt.registerTask('test', ['run:test']);
};
