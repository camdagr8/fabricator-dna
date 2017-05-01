'use strict';

const should    = require('chai').should(),
    dna       = require('../index.js'),
    data      = require('./data.json');


describe('#check', function () {

    it('check(btn-group, dependents -> true)', function () {
        dna.check('btn-group', data.helix, 'dependents').should.equal(true);
    });

    it('check(btn-group, dependencies -> true)', function () {
        dna.check('btn-group', data.helix, 'dependencies').should.equal(true);
    });

    it('check(btn, dependencies -> false)', function () {
        dna.check('btn', data.helix, 'dependencies').should.equal(false);
    });

    it('check(btn-active, dependents -> true)', function () {
        dna.check('btn-active', data.helix, 'dependents').should.equal(false);
    });
});
