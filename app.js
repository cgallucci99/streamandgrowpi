const yargs = require('yargs');
const nodefetch = require('node-fetch');
const tough = require('tough-cookie');
let jar = new tough.CookieJar();
const fetch = require('fetch-cookie/node-fetch')(nodefetch, jar, true);
const prompts = require('prompts');
const puppeteer = require('puppeteer-core');
const mqtt = require('mqtt');
const chalk = require('chalk');
require('dotenv').config();
const frontURL = 'https://streamandgrow.herokuapp.com';
const backURL = 'https://intense-wildwood-99025.herokuapp.com';
const mqttURL = 'mqtt://mqtt.gameclient.me';

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
		console.log(chalk.greenBright('✔ Authentication successful'));
	} else {
		console.log(chalk.redBright.bold('✘ Authentication failed'));
		return;
	}
	// check to see if the authenticated user owns the stream
	let streams = await getStreams();
	if (streams.find(found => found._id === id)) {
		console.log(chalk.greenBright('✔ Found stream'))
	} else {
		console.log(`${chalk.redBright('✘ You do not have access to the stream')} ${chalk.cyanBright.bold(id)}`);
		return;
	}
	// connect to the mqtt protocol
	const client = mqtt.connect(mqttURL, { username: 'tcsRead', password: process.env.MQTTPWD });

	client.on('connect', () => {
		console.log(chalk.green('connected to mqtt'));
		client.subscribe('streamstatus');
	});
	client.on('message', (topic, message) => {
		if (topic === 'streamstatus') {
			if (message.toString() === `${id} on`) {
				streaming = true;
				console.log(chalk.yellow('Starting stream...'));
				stream();
			}
			if (message.toString() === `${id} off`) {
				streaming = false;
				console.log(chalk.yellow('Stopping stream...'));
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