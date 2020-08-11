const yargs = require('yargs');
const nodefetch = require('node-fetch');
const tough = require('tough-cookie');
let jar = new tough.CookieJar();
const fetch = require('fetch-cookie/node-fetch')(nodefetch, jar, true);
const prompts = require('prompts');
const puppeteer = require('puppeteer-core');

const options = yargs
	.usage('Usage: -u <username> -i <stream id>')
	.option('u', { alias: 'username', describe: 'Your username', type: 'string', demandOption: false })
	.option('i', { alias: 'id', describe: 'Your stream id', type: 'string', demandOption: false })
	.argv;

let username = options.username;
let id = options.id;
let password = null;
let user = null;

const questions = [
	{
		type: options.username ? null : 'text',
		name: 'username',
		message: 'Username: ',
	},
	{
		type: 'password',
		name: 'password',
		message: 'Password: ',
	},
	{
		type: options.id ? null : 'text',
		name: 'id',
		message: 'Stream ID: ',
	},
];

const signIn = async () => {
	const data = `username=${username}&password=${password}`;
	// Fetch call that is being made to the backend, should change the hardcoded URL to one that
	// is set in a .env or config file
	let results = await fetch('https://intense-wildwood-99025.herokuapp.com/auth/login', {
		method: 'POST',
		credentials: 'include',
		body: data,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json',
			'Access-Control-Allow-Credentials': true,
		},
	});
	let body = await results.json();
	console.log(body);
	if (body.message === 'Success') {
		user = body.user;
		return true;
	} else {
		return false;
	}
}
const getStreams = async () => {
	const data = `owner=${user._id}`;
	// Fetch call that is being made to the backend, should change the hardcoded URL to one that
	// is set in a .env or config file
	let results = await fetch('https://intense-wildwood-99025.herokuapp.com/streams/stream/getUserStreams', {
		method: 'POST',
		credentials: 'include',
		body: data,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json',
			'Access-Control-Allow-Credentials': true,
		},
	});
	let body = await results.json();
	console.log(body);
	if (body.message !== 'fail') {
		return body.data;
	} else {
		return null;
	}
}


(async () => {
	const response = await prompts(questions);
	if (response.username) {
		username = response.username;
	}
	if (response.id) {
		id = response.id;
	}
	password = response.password;
	console.log(`username: ${username}, password: ${password}  id: ${id}`);
	let auth = await signIn();
	console.log('auth: ', auth);
	let streams = await getStreams();
	console.log(streams);
	if (streams.find(found => found._id === id)) {
		console.log('oooh');
	}
	const browser = await  puppeteer.launch({executablePath: 'usr/bin/chromium-browser', args:['--use-fake-ui-for-media-server']});
	const context = await browser.defaultBrowserContext();
	await context.overridePermissions(`https://streamandgrow.herokuapp.com/streamerPage/${id}`, ['camera']);
	const page = await context.newPage();
	page.on('console', msg => {
		for (let i = 0; i < msg.args().length; ++i)
			console.log(`${i}: ${msg.args()[i]}`);
	});
	//page.setCookie(cookie);
	await page.goto(`https://streamandgrow.herokuapp.com/streamerPage/${id}`);

	//await browser.close();
})();

