const Sequelize = require('sequelize');
const Discord = require('discord.js');
const prefix = '!';

// Bot
const client = new Discord.Client({
	allowedMentions: {
		parse: ['users', 'roles'],
		repliedUser: true,
	},
	intents: [
		"GUILDS",
		"GUILD_MESSAGES",
		"GUILD_PRESENCES",
		"GUILD_MEMBERS",
		"GUILD_MESSAGE_REACTIONS"
	],
});

client.on("ready", () => {
	console.log("I am ready to go");
})

client.on("messageCreate", async message => {
	if(!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).trim().split(' ');
	const command = args.shift().toLowerCase();
	console.log("COMMAND: " + command);
	switch(command){
		case "in":
			checkin(message);
			break;
		case "out":
			checkout(message);
			break;
		
	}

	if(message.member.roles.cache.some(role => role.name === 'Management')) {
		switch(command) {
			case "checkedin":
				checkedin(message);
				break;
			case "recordsof":
				if(!args.length){
					return message.channel.send('Did you forget to provide a user? Yes you did!');
				}
				var userId = extractIdFromArgs(args);
				getRecordsForUser(message, userId);
				break;
			case "management":
				message.channel.send('You have the managament role');
				break;
			case "printcheckedin":
				printCheckedIn(message);
				break;
			case "printrecords":
				printRecords(message);
				break;
			case "clearcheckedin":
				clearCheckedIn(message);
				break;
			case "clearrecords":
				clearUserRecords(message);
				break;
			case "report":
				listReport(message);
				break;
			case "checkout":
				var userId = extractIdFromArgs(args);
				checkoutUser(message, userId);
				break;
			case "checkoutall":
				checkoutAll(message);
				break;
		}
	}
	
})
client.login("Add token here");

const sequelize = new Sequelize('database','user','password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

const CheckedIn = sequelize.define('checkedIn', {
	id: {
		type: Sequelize.STRING,
		primaryKey: true,
		unique: true,
	},
	in: Sequelize.DATE
}, {timestampts: false});

const UserRecords = sequelize.define('userRecords', {
	discordid: {
		type: Sequelize.STRING,
		primaryKey: false
	},
	in: Sequelize.DATE,
	out: Sequelize.DATE,
	hours: Sequelize.NUMBER,
	minutes: Sequelize.NUMBER,
	totalminutes: Sequelize.NUMBER
}, {timestampts: false});

//Create table in database
CheckedIn.sync();
UserRecords.sync();

function clearCheckedIn(message){
	message.delete();
	console.log("Clearing CheckedIn");
	CheckedIn.destroy({
		where: {},
		truncate: true
	})
}

function clearUserRecords(message){
	message.delete();
	console.log("Clearing UserRecords");
	UserRecords.destroy({
		where: {},
		truncate: true
	})
}

async function printCheckedIn(message){
	message.delete();
	const checkedInList = await CheckedIn.findAll({});
	if(checkedInList){
		for(let i = 0; i<checkedInList.length; i++){
			console.log('List: ' + checkedInList[i].id + " " + checkedInList[i].in);
		}
	}
}

async function printRecords(){
	message.delete();
	const userRecordList = await UserRecords.findAll({});
	const userRecordString = userRecordList.map(t => t.name + " " + t.in + " " + t.out).join('\n') || 'no records.';
	console.log('records: ' + userRecordString);
}

async function checkin(message) {
	message.delete();
	var checkinUser = message.author.id;
	var date = new Date();
	//date.setHours(date.getHours() - 1);
	//date.setMinutes(date.getMinutes() -30);
	var time = printTime(date);
	try{
		const checkedinValue = await CheckedIn.findOne({ where: { id: checkinUser}});
		if(!checkedinValue){
			message.channel.send(time + " - <@" + checkinUser + "> checked in!");
			const checkin = await CheckedIn.create({
				id: checkinUser,
				in: date,
			});
		}else{
			message.channel.send("<@" + checkinUser + ">, you are already checked in!").then(msg => {setTimeout(() => msg.delete(), 5000)});
		}
	}catch(error){
		console.log("Checkin-error " + error);
	}
}

async function checkout(message) {
	message.delete();
	var checkoutUser = message.author.id;
	var date = new Date();
	var time = printTime(date);
	try{
		const checkedinValue = await CheckedIn.findOne({ where: { id: checkoutUser}});
		if(checkedinValue){
			let [totalHours, totalMinutes] = calculateHoursAndMinutes(checkedinValue.in, date);
			var durationInMinutes = calculateMinutes(checkedinValue.in, date);
			if(durationInMinutes >= 15){
				message.channel.send(time + " - <@" + checkoutUser + "> checked out! - total: " + totalHours + "h " + totalMinutes + "minutes");
				const userRecord = await UserRecords.create({
					discordid: checkoutUser,
					in: checkedinValue.get('in'),
					out: date,
					hours: totalHours,
					minutes: totalMinutes,
					totalminutes: durationInMinutes
				})
			}else{
				message.channel.send(time + " - <@" + checkoutUser + ">, you are now checked out. Your shift only lasted " + totalMinutes + " minutes, but a minimum of 15 minutes is required.");
			}
			await CheckedIn.destroy({where: {id: checkoutUser}});
		}else{
			message.channel.send("<@" + checkoutUser + ">, you are already checked out!");
		}
	}catch(error){
		message.channel.send("Something went wrong during checkout");
		console.log("Checkout-error: " + error);
	}
}

function calculateHoursAndMinutes(inTime, outTime) {
	var minutes = (outTime - inTime)/60000;
	console.log("CalculateHours: " + minutes + "minutes");
	var hours =  Math.trunc(minutes/60);
	minutes = Math.round(minutes - hours*60);
	console.log("CalculateHours: " + hours + "hours " +  minutes + "minutes");
	return [hours, minutes];
}

function calculateMinutes(inTime, outTime) {
	var minutes = Math.round((outTime - inTime)/60000);
	return minutes;
}

async function checkedin(message) {
	message.delete();
	const checkedInList = await CheckedIn.findAll({});
	var checkedInCount = checkedInList.length;
	if(!checkedInCount){
		message.channel.send("No users are currently checked in.");
	}else{	
		message.channel.send("Currently checked in:");
		let userListString = "";
		for(let i = 0; i < checkedInCount; i++) {
			var username = checkedInList[i].id;
			userListString += "<@" + username + "> - " + printTime(checkedInList[i].in) + "\n";
		}
		message.channel.send(userListString);
	}
}

function extractIdFromArgs(args) {
	return args.toString().substring(3,21);
}

async function getRecordsForUser(message, userId) {
	message.delete();
	message.channel.send('Getting records for <@' + userId + '>:');
	const recordsOffUser = await UserRecords.findAll({ where: { discordid: userId}});
	let totalTime = 0;
	if(recordsOffUser.length > 0){
		let records = "";
		for(let i = 0; i < recordsOffUser.length ; i++){
			var timeInMinutes = minutesBetweenDates(recordsOffUser[i].in, recordsOffUser[i].out);
			totalTime += timeInMinutes;
			records += "<@" + recordsOffUser[i].discordid + "> *" + 
			 printDate(recordsOffUser[i].in) + "* | **" +
			 printTime(recordsOffUser[i].in) + "**  -  **" + 
			 printTime(recordsOffUser[i].out) + "** | *" + 
			 printDate(recordsOffUser[i].out) + "* | ***" + timeInMinutes + " minutes***\n";
		}
		records += "<@" + userId + "> has checked in for a total of **" + totalTime + " minutes** = **" + Math.trunc(totalTime/60) + "h " + totalTime%60 + "minutes**";
		message.channel.send(records);
	}else{
		message.channel.send("<@" + userId + "> has no records");
	}
}

async function listReport(message) {
	message.delete();
	message.channel.send('Here are the totals of all users: ');
	const records =  await UserRecords.findAll({ 
		attributes: ['discordid', [sequelize.fn('sum', sequelize.col('totalminutes')), 'total']],
		group: ['discordid'],
		raw: true,
		order: sequelize.literal('total DESC')
	});
	let recordString = "";
	for(let i = 0; i < records.length; i++) {
		recordString += "<@" + records[i].discordid + "> - " + minutesToHourString(records[i].total) + "\n";
	}
	message.channel.send(recordString);
}

function minutesBetweenDates(inTime, outTime) {
	return Math.round((outTime - inTime)/60000);
}

function printDate(date) {
	return date.toLocaleDateString("en-GB", { month: "2-digit", day:"2-digit"});
}

function printTime(date) {
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function minutesToHourString(minutes) {
	var hours =  Math.trunc(minutes/60);
	minutes = Math.round(minutes - hours*60);
	console.log("CalculateHours: " + hours + "hours " +  minutes + "minutes");
	return hours + "h " + minutes + "minutes";
}

async function checkoutUser(message, userid) {
	message.delete();
	const record = await CheckedIn.findAll({ where: { id: userid}});
	if(record){
		CheckedIn.destroy({ 	
			where: { id: userid},
			truncate: true
		})
		message.channel.send("<@" + userid + "> is now checked out.");
	}else{
		message.channel.send("<@" + userid + "> is not checked in.");
	}
}

async function checkoutAll(message) {
	message.delete();
	const record = await CheckedIn.findAll();
	if(record.length){
		let checkedinList = "";
		for(let i = 0; i<record.length; i++){
			checkedinList += "<@" + record[i].id + "> has checked out.\n";
			CheckedIn.destroy({ 	
				where: { id: record[i].id},
				truncate: true
			})
		}
		message.channel.send(checkedinList);
	}else{
		message.channel.send("Everyone is checked out.");
	}
}

/* TODO
	*checkoutAll -> save hours ==> Use this in !report
	*checkoutdelete @user
	*checkout @user -> save hours
	*On checkout check after 2A.M.
	*Report order by DESC



*/