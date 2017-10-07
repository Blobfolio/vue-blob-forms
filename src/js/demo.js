(function(){

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
			select: '',
			multiselect: [],
		},
		dateMin: '2015-01-01',
		dateMax: '2018-01-01',
		numMin: 1,
		numMax: 10,
	},
	methods: {
	},
});

})();