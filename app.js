const yargs = require('yargs');
const nodefetch = require('node-fetch');
const tough = require('tough-cookie');
let jar = new tough.CookieJar();
const fetch = require('fetch-cookie/node-fetch')(nodefetch, jar, true);
const prompts = require('prompts');
const puppeteer = require('puppeteer-core');
const mqtt = require('mqtt');
const frontURL = 'https://streamandgrow.herokuapp.com';
const backURL = 'https://intense-wildwood-99025.herokuapp.com';
const mqttURL = '';

// options to start app
const options = yargs
	.usage('Usage: -u <username> -i <stream id>')
	.option('u', { alias: 'username', describe: 'Your username', type: 'string', demandOption: false })
	.option('i', { alias: 'id', describe: 'Your stream id', type: 'string', demandOption: false })
	.argv;

let username = options.username;
let id = options.id;
let password = null;
let user = null;
let streaming = false;
// questions to start application
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
// signs in a user
const signIn = async () => {
	const data = `username=${username}&password=${password}`;
	// Fetch call that is being made to the backend
	let results = await fetch(`${backURL}/auth/login`, {
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
	if (body.message === 'Success') {
		user = body.user;
		return true;
	} else {
		return false;
	}
}
// gets a list of the user's streams
const getStreams = async () => {
	const data = `owner=${user.username}`;
	// Fetch call that is being made to the backend
	let results = await fetch(`${backURL}/streams/stream/getUserStreams`, {
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
	if (body.message !== 'fail') {
		return body.data;
	} else {
		return null;
	}
}


(async () => {
	// prompt user to sign in and provide stream id
	const response = await prompts(questions);
	if (response.username) {
		username = response.username;
	}
	if (response.id) {
		id = response.id;
	}
	password = response.password;
	// check credentials
	let auth = await signIn();
	if (auth) {
		console.log('authentication successful');
	} else {
		console.log('authentication failed');
	}
	// check to see if the authenticated user owns the stream
	let streams = await getStreams();
	if (streams.find(found => found._id === id)) {
		console.log('found stream')
	} else {
		console.log(`you do not have access to the stream ${id}`);
		return;
	}
	// connect to the mqtt protocol
	const client = mqtt.connect(mqttURL);

	client.on('connect', () => {
		client.subscribe('streamstatus');
	});
	client.on('message', (topic, message) => {
		if (topic === 'streamstatus') {
			if (message === `${id} on`) {
				streaming = true;
				stream();
			}
			if (message === `${id} off`) {
				streaming = false;
			}
		}
	});
})();

const stream = async () => {
	// launch camera
	const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--use-fake-ui-for-media-stream'] });
	const context = await browser.defaultBrowserContext();
	await context.overridePermissions(`${frontURL}/streamerPage/${id}`, ['camera']);
	const page = await context.newPage();
	page.on('console', msg => {
		for (let i = 0; i < msg.args().length; ++i)
			console.log(`${i}: ${msg.args()[i]}`);
	});
	await page.goto(`${frontURL}/streamerPage/${id}`);
	// check to see if the stream is stopped every 2 seconds
	setInterval(async () => {
		if (!streaming) {
			await browser.close();
			return;
		}
	}, 2000);
}