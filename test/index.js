var should 	= require('chai').should(),
    dna 	= require('../index.js'),
	data 	= require('./data.json');


describe('#check', function() {

	it('hasDependents(btn-group->true)', function () {
		dna.hasDependents('btn-group', data.helix).should.equal(true);
	});

	it('hasDependencies(btn-group->true)', function () {
		dna.hasDependencies('btn-group', data.helix).should.equal(true);
	});

	it('hasDependencies(btn->false)', function () {
		dna.hasDependencies('btn', data.helix).should.equal(false);
	});

	it('hasDependents(btn-active->true)', function () {
		dna.hasDependents('btn-active', data.helix).should.equal(false);
	});
});
