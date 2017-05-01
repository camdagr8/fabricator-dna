'use strict';

/**
 * @description Fabricator module that creates a dependency tracker.
 * @author Cam Tullos cam@tullos.ninja
 */

/**
 * Required dependencies
 */
const globby         = require('globby');
const fs             = require('fs');
const path           = require('path');
const _              = require('lodash');
const matter         = require('gray-matter');
const yaml           = require('js-yaml');
const beautify_js    = require('js-beautify');


const dna = {
    dependencies: function (key, helix, block) {
        return dna.get(key, helix, 'dependencies', block);
    },

    dependents: function (key, helix, block) {
        return dna.get(key, helix, 'dependents', block);
    },

    get: function (key, helix, field, block) {
        let output    = '';
        key           = (typeof key === 'string') ? key : key[0];
        block         = block || {
            fn: function () {
                return arguments[arguments.length - 1];
            }
        };

        for (let prop in helix) {
            if (helix[prop]['id'] === key) {
                let deps    = helix[prop][field];
                let i       = -1;

                for (let p in deps) {
                    let data = {};
                    i++;

                    deps[p].sort();

                    data['count']        = deps[p].length;
                    data['selectors']    = deps[p];
                    data['link']         = dna.link(p);
                    data['file']         = p;
                    data['index']        = i;

                    output += block.fn(data);
                }
            }
        }

        return output;
    },

    getName: function (filePath, preserveNumbers) {
        // get name; replace spaces with dashes
        let name = path.basename(filePath, path.extname(filePath)).replace(/\s/g, '-');
        return (preserveNumbers) ? name : name.replace(/^[0-9|\.\-]+/, '');
    },

    getMatter: function (file) {
        return matter.read(file, {
            parser: require('js-yaml').safeLoad
        });
    },

    check: function (key, helix, field) {
        key = (typeof key === 'string') ? key : key[0];

        for (let prop in helix) {
            if (helix[prop]['id'] === key) {
                let deps = helix[prop][field];
                for (let p in deps) {
                    if (deps[p].length > 0) {
                        return true;
                    }
                }
            }
        }

        return false;
    },

    hasDependencies: function (key, helix, options) {
        options = options || {
                fn: function () {
                    return arguments[arguments.length - 1];
                }
            };
        let status = dna.check(key, helix, 'dependencies');
        if (status === true) {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
    },

    hasDependents: function (key, helix, options) {
        options = options || {
                fn: function () {
                    return arguments[arguments.length - 1];
                }
            };
        let status = dna.check(key, helix, 'dependents');
        if (status === true) {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
    },

    link: function (str) {

        let a = str.split('.');
        let e = a.pop();
        let l;

        a = a.join('.').split('/');

        l = [a[2], '.', e];

        if (a[3]) {
            l.push('#', a[3]);
        }

        if (a[4]) {
            l.push('.', a[4]);
        }

        l = l.join('');

        return l;
    },

    scan: function (config) {
        let defaults = {
            dna          : 'src/data/dependencies.json',
            materials    : ['src/materials/**/*'],
            views        : ['src/views/**/*', '!src/views/+(layouts)/**']
        };

        config = config || {};

        for (let prop in defaults) {
            if (!config.hasOwnProperty(prop)) {
                config[prop] = defaults[prop];
            }
        }

        let files    = [];
        let res      = {helix: {}};

        let dirs = [
            config.materials,
            config.views
        ];

        // Get partials (HTML files)
        dirs.forEach(function (dir) {
            let read    = globby.sync(dir, {nodir: true});
            files       = files.concat(read);
        });


        files.forEach(function (file) {
            // Get dna
            let fm             = dna.getMatter(file);
            res.helix[file]    = {dna: [], id: null, dependents: {}, dependencies: {}};

            if (fm.data.dna) {
                res.helix[file]['dna']    = (typeof fm.data.dna === 'string') ? [fm.data.dna] : fm.data.dna;
                res.helix[file]['id']     = _.head(res.helix[file]['dna']);
            }

            let props = res.helix[file]['dna'];

            // Get dependents
            let others = _.without(files, file);
            others.forEach(function (ofile) {
                let content     = String(fs.readFileSync(ofile, 'utf-8'));
                let elements    = [];
                let findTag     = /<[^\/].*?>/g;
                let element     = findTag.exec(content);
                let matches     = [];

                while (element) {
                    element = element[0];

                    // Match id attribute
                    let id = (element.match(/id s=["|'](.*?)["|']/i) || [, ""])[1];
                    if (id) {
                        let p    = '#';
                        let i    = _.intersection([id], props);

                        i.forEach(function (m) {
                            matches.push(p + m);
                        });
                    }

                    // Match data-dna attribute
                    let cmp = (element.match(/data-dna=["|'](.*?)["|']/i) || [, ""])[1];
                    if (cmp) {
                        let p    = 'data-dna=';
                        let i    = _.intersection([cmp], props);

                        i.forEach(function (m) {
                            matches.push(p + m);
                        });
                    }

                    // Match class attribute
                    let classes = (element.match(/class=["|'](.*?)["|']/i) || [, ""])[1].split(' ');
                    classes = _.compact(classes);
                    if (classes.length > 0) {
                        let p    = '.';
                        let i    = _.intersection(_.compact(classes), props);

                        i.forEach(function (m) {
                            matches.push(p + m);
                        });
                    }

                    element = findTag.exec(content);
                }

                matches = _.uniq(matches);

                if (matches.length > 0) {
                    res.helix[file]['dependents'][ofile] = matches;
                }
            });
        });

        files.forEach(function (file) {
            let others = _.without(files, file);
            others.forEach(function (ofile) {
                let d = res.helix[ofile]['dependents'][file];
                if (d) {
                    res.helix[file]['dependencies'][ofile] = d;
                }
            });
        });

        let output    = JSON.stringify(res);
        output        = beautify_js(output, {indent_size: 2});

        fs.writeFileSync(config.dna, output);
    }

};


/**
 * Exports
 */
module.exports = {
    check              : dna.check,
    dependencies       : dna.dependencies,
    dependents         : dna.dependents,
    hasDependencies    : dna.hasDependencies,
    hasDependents      : dna.hasDependents,
    link               : dna.link,
    scan               : dna.scan
};
