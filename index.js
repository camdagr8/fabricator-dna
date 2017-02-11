/**
 * @description Fabricator module that creates a dependency tracker.
 * @author Cam Tullos cam@tullos.ninja
 */

/**
 * Required dependencies
 */
const globby = require('globby');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const matter = require('gray-matter');
const yaml = require('js-yaml');
const beautify_js = require('js-beautify');


const dna = {
	dependencies: function(key, helix, block) {
		block = block || {fn: function () { return arguments[0]; }};

		key = (typeof key === 'string') ? key : key[0];

		var output = '';

		for (let prop in helix) {
			if (helix[prop]['id'] === key) {
				var deps = helix[prop]['dependencies'];

				var i = -1;
				for (let p in deps) {
					let data = {};
					i++;
					data['count'] = deps[p].length;
					data['selectors'] = deps[p];
					data['link'] = dna.link(p);
					data['file'] = p;
					data['index'] = i;

					output += block.fn(data);
				}
			}
		}

		return output;
	},

	dependents: function(key, helix, block) {
		block = block || {fn: function () { return arguments[0]; }};

		key = (typeof key === 'string') ? key : key[0];

		var output = '';

		for (let prop in helix) {
			if (helix[prop]['id'] === key) {
				var deps = helix[prop]['dependents'];

				var i = -1;
				for (let p in deps) {
					let data = {};
					i++;
					data['count'] = deps[p].length;
					data['selectors'] = deps[p];
					data['link'] = dna.link(p);
					data['file'] = p;
					data['index'] = i;

					output += block.fn(data);
				}
			}
		}

		return output;
	},

	getName: function (filePath, preserveNumbers) {
		// get name; replace spaces with dashes
		var name = path.basename(filePath, path.extname(filePath)).replace(/\s/g, '-');
		return (preserveNumbers) ? name : name.replace(/^[0-9|\.\-]+/, '');
	},

	getMatter: function (file) {
		return matter.read(file, {
			parser: require('js-yaml').safeLoad
		});
	},

	link: function (str) {

		var a = str.split('.');
		var e = a.pop();
		var l;

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
		var files = [];
		var res = {helix: {}};

		var dirs = [
			config.materials,
			config.views
		];

		// Get partials (HTML files)
		dirs.forEach(function (dir) {
			var read = globby.sync(dir, {nodir: true});
			files = files.concat(read);
		});


		files.forEach(function (file) {
			// Get dna
			var fm = dna.getMatter(file);

			res.helix[file] = {dna: [], id: null, dependents: {}, dependencies: {}};
			if (fm.data.dna) {
				res.helix[file]['dna'] = (typeof fm.data.dna === 'string') ? [fm.data.dna] : fm.data.dna;
				res.helix[file]['id'] = _.head(res.helix[file]['dna']);
			}

			var props = res.helix[file]['dna'];

			// Get dependents
			var others = _.without(files, file);
			others.forEach(function (ofile) {
				let content = String(fs.readFileSync(ofile, 'utf-8'));
				let elements = [];
				let findTag = /<[^\/].*?>/g;
				let element = findTag.exec(content);
				let matches = [];

				while (element) {
					element = element[0];

					// Match id attribute
					let id = (element.match(/id s=["|'](.*?)["|']/i) || [, ""])[1];
					if (id) {
						let p = '#';
						let i = _.intersection([id], props);
						i.forEach(function (m) { matches.push(p + m); });
					}

					// Match data-dna attribute
					let cmp = (element.match(/data-dna=["|'](.*?)["|']/i) || [, ""])[1];
					if (cmp) {
						let p = 'data-dna=';
						let i = _.intersection([cmp], props);
						i.forEach(function (m) { matches.push(p + m); });
					}

					// Match class attribute
					let classes = (element.match(/class=["|'](.*?)["|']/i) || [,""])[1].split(' ');
					classes = _.compact(classes);
					if (classes.length > 0) {
						let p = '.';
						let i = _.intersection(_.compact(classes), props);
						i.forEach(function (m) { matches.push(p + m); });
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
		  var others = _.without(files, file);
		  others.forEach(function (ofile) {
			let d = res.helix[ofile]['dependents'][file];
			if (d) {
			  res.helix[file]['dependencies'][ofile] = d;
			}
		  });
		});

		var output = JSON.stringify(res);
			output = beautify_js(output, {indent_size:2});

		fs.writeFileSync(config.dna, output);
	}

};




/**
 * Exports
 */
module.exports = {
	dependencies: dna.dependencies,
	dependents: dna.dependents,
	link: dna.link,
	scan: dna.scan
}