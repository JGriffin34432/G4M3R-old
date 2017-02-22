const moment = require("moment-timezone");
const config = require("../../Configuration/config.json");
const auth = require("./EventsAuth");

/// events viewer constructor
function Viewer(bot, msg, db, serverDocument, eventDocuments, userDocument, memberObject, page_size, filter) {
    this.bot = bot;
    this.msg = msg;
    this.db = db;
    this.server = serverDocument;
    this.events = eventDocuments;
    this.user = userDocument;
    this.member = memberObject;
    this.page_size = page_size ? page_size : 5;

    this.mode = 0;
    this.previous_mode = 0;
    this.edit_mode = 0;
    this.edits_made = {};
    this.add_not_edit = false;
    this.timezone = (this.user.timezone ? this.user.timezone : config.moment_timezone);

    // set the filter display
    this.filter_disp = "";
    if (filter) {
        if (filter._author) {
            this.filter_disp += " | author: <@" + filter._author + ">";
        }
        if (filter.tags) {
            this.filter_disp += " | tags: " + filter.tags;
        }
    }
}

/// set the viewer's current event
Viewer.prototype.setEvent = function(event_no) {
    let event;
    for (let i = 0; i < this.events.length; i++) {
        if (this.events[i]._no == event_no) {
            event = this.events[i];
        }
    }

    if (event) {
        this.event = event;
        return true;
    }
};

/// generate a list view embed
Viewer.prototype.getPageView = function(page_no) {
    this.mode = 1;

    let embed = {};
    embed.color = parseInt(config.colors.blue, 16);
    embed.description = "";
    embed.author = {
        name: `EVENT OVERVIEW`,
        url: "http://frid.li/lrR-u"
    };

    if ((page_no - 1) * this.page_size < this.events.length) {
        let start_index = (page_no - 1) * this.page_size;
        let end_index = (start_index + this.page_size) > this.events.length ? this.events.length : start_index + this.page_size;

        for (let i = start_index; i < end_index; i++) {
            embed.description += `**[${this.events[i]._no}]** **|** **${this.events[i].title}**\n` +
                `**by** \`${this.bot.getUserOrNickname(this.events[i]._author, this.msg.channel.guild)}\`` +
                ` **//** \`[${this.events[i].attendees.length}/${this.events[i].attendee_max}]\`` +
                (moment(this.events[i].start).isAfter(moment.now()) ?
                    ` **//** **starts** \`${moment(this.events[i].start).fromNow()}\`` : ` **//** **ends** \`${moment(this.events[i].end).fromNow()}\``) +
                "\n\n";
        }

        if (this.events.length > end_index || page_no > 1) {
            embed.description += `\n## `;
        }
        if (this.events.length > end_index) {
            embed.description += `\`\`[+]\`\` next page`;
        }
        if (this.events.length > end_index && page_no > 1) {
            embed.description += ` | `;
        }
        if (page_no > 1) {
            embed.description += `\`\`[-]\`\` previous page\n`;
        }
        embed.footer = {text: `page (${page_no}/${Math.ceil(this.events.length / this.page_size)})`};
        embed.title = `Type the Event 🆔 to show details`;
    } else {
        embed.title = `There are no events scheduled on this server.`;
        embed.footer = {text: "page (1/1)"};
    }
    embed.footer.text += ` | type [Q]uit to leave` + this.filter_disp;

    return {embed: embed};
};

/// generate a view of a single event
Viewer.prototype.getEventView = function() {
    this.mode = 2;
    let attendeesNames = "";
    let hasAttendees = false;
    let username = this.bot.getUserOrNickname(this.event._author, this.msg.channel.guild);
    let tag_content = "";

    let embed = {};
    embed.title = `\`${this.event.title}\``;
    embed.color = parseInt(config.colors.blue,16);
    embed.author = {
        name: `[${this.event._no}] created by ${username}`,
        icon_url: "http://frid.li/sSVIJ"
    };

    if (this.event.attendees.length > 0) {
        for (let i = 0; i < this.event.attendees.length; i++) {
            if (i > 14) { //showing max 15 attendees
                break;
            } else {
                if (i % 2 === 1) {
                    attendeesNames += `\`${this.bot.getUserOrNickname(this.event.attendees[i]._id, this.msg.channel.guild)}\`\n`;
                } else {
                    attendeesNames += `\`${this.bot.getUserOrNickname(this.event.attendees[i]._id, this.msg.channel.guild)}\`, `;
                }
                //attendeesNames += `<@`+this.event.attendees[i]._id+`>, `;
                hasAttendees = true;
            }
        }
    }

    if(this.event.tags.length > 0) {
        tag_content = "" +
            `${this.event.tags.join(`, `)}`;
    } else {
        tag_content = "" +
            `no tags defined`;
    }

    embed.fields = [{
        name: `Start`,
        value: `${moment(this.event.start).tz(this.timezone).format(`${config.moment_date_format}`)}`,
        inline: true
    }, {
        name: `End`,
        value: `${moment(this.event.end).tz(this.timezone).format(`${config.moment_date_format}`)}`,
        inline: true
    }, {
        name: `Description`,
        value: `${this.event.description}`,
        inline: false
    }, {
        name: `Attendees`,
        value: `[${this.event.attendees.length}/${this.event.attendee_max}]`,
        inline: true
    }, {
        name: `Attendees joined`,
        value: `${hasAttendees ? `${attendeesNames}` : `(no attendees)`}`,
        inline: true
    }, {
        name: `Tags`,
        value: `${tag_content}`,
        inline: false
    }];

    embed.footer = {text: `## Options: [J]oin, [L]eave, ` +
    (hasAttendees ? `[A]ttendees, ` : "") +
    (auth.toDeleteOrEdit(this.server, this.event, this.member)?`[E]dit, [D]elete, `:"") +
    `[B]ack, [Q]uit`};

    return {embed: embed};
};

/// generate the main editor view for the currently set event
Viewer.prototype.getEventEditView = function(add) {
    this.mode = 3;
    this.edit_mode = 0;

    //check if view comes from add or from edit command
    if (add) {
        this.add_not_edit = true;
    }

    let embed = {};
    embed.color = parseInt(config.colors.blue,16);
    embed.title = `Event #⃣ ${this.event._no}`;

    if (this.add_not_edit) {
        embed.author = {name: `CREATION PROCESS`};
        embed.footer = {text: `## Options: [S]ave, [Q]uit`};
    } else {
        embed.author = {name: `EDIT PROCESS`};
        embed.footer = {text: `## Options: [S]ave, [C]ancel, [Q]uit`};
    }

    embed.description = "" +
        `\`\`[1]\`\` **Event Title** ` +
        (this.edits_made.title ? ": \`" + this.edits_made.title + "\`\n" :
            "\`" + this.event.title + "\`\n") +
        `\`\`[2]\`\` **Start Time**` +
        (this.edits_made.start ? ": \`" + moment(this.edits_made.start).tz(this.timezone).format(`${config.moment_date_format}`) + "\`\n" :
            ": \`" + moment(this.event.start).tz(this.timezone).format(`${config.moment_date_format}`) + "\`\n") +
        `\`\`[3]\`\` **End Time** ` +
        (this.edits_made.end ? ": \`" + moment(this.edits_made.end).tz(this.timezone).format(`${config.moment_date_format}`) + "\`\n" :
            ": \`" + moment(this.event.end).tz(this.timezone).format(`${config.moment_date_format}`) + "\`\n") +
        `\`\`[4]\`\` **Description** ` +
        (this.edits_made.description ? "```md\n" + this.edits_made.description + "```\n" :
            ": \`" + this.event.description + "\`\n") +
        `\`\`[5]\`\` **Max Attendees** ` +
        (this.edits_made.attendee_max ? ": \`" + this.edits_made.attendee_max + "\`\n" :
            ": \`" + this.event.attendee_max + "\`\n") +
        `\`\`[6]\`\` **Tags** ` +
        (this.edits_made.tags ? ": \`" + this.edits_made.tags.join(", ") + "\`\n" :
            ": \`" + this.event.tags + "\`\n");

    return {embed: embed};
};

/// generate the edit [attribute] prompt
Viewer.prototype.getEditorView = function() {
    if (this.mode != 3) {
        return false; // something is wrong!
    }

    let embed = {};
    embed.color = parseInt(config.colors.blue,16);
    embed.title = `Event #⃣ ${this.event._no}`;
    embed.footer = {text: `## Options: [C]ancel, [Q]uit`};

    if (this.add_not_edit) {
        embed.author = {name: `CREATION PROCESS`};
    } else {
        embed.author = {name: `EDIT PROCESS`};
    }

    switch (this.edit_mode) {
        case 1:
            embed.description = "" +
                `Current title: \n\`\`${this.event.title}\`\`\n\n` +
                `Enter the new title for the event`;
            break;
        case 2:
            let start = moment(this.event.start).tz(this.timezone).format(`${config.moment_date_format}`);
            embed.description = "" +
                `Current start: \n\`\`${start}\`\`\n\n` +
                `Enter the start end time for the event.\n\n` +
                `# Format: YYYY/MM/DD hh:mm`;
            break;
        case 3:
            let end = moment(this.event.end).tz(this.timezone).format(`${config.moment_date_format}`);
            embed.description = "" +
                `Current end: \n\`\`${end}\`\`\n\n` +
                `Enter the new end time for the event.\n\n` +
                `# Format: YYYY/MM/DD hh:mm`;
            break;
        case 4:
            embed.description = "" +
                `Current Description: \n\`\`\`md\n${this.event.description}\n\`\`\`\n` +
                "Enter a new description for the event.";
            break;
        case 5:
            embed.description = "" +
                `Current maximum member count: \`\`${this.event.attendee_max}\`\`\n\n` +
                "Enter a new maximum member count for the event.";
            break;
        case 6:
            embed.description = "" +
                `Current set tags: ${(this.event.tags.length ? "``" + this.event.tags.join(", ") + "``" : "")}\n\n` +
                "Enter a new set of tags for the event.";
            break;
        default:
            embed.description = `Something went wrong if this is being read!`;
            break;
    }

    return {embed: embed};
};

/// remove an event and return an event removed prompt
Viewer.prototype.deleteEvent = function(event, silent) {
    this.mode = 4;

    // delete the eventDocument and return to main page
    this.db.events.remove({_id: event._id}, (err)=>{
        if(err) {
            console.log(err.stack);
        }
    });
    for(let i=0; i<this.events.length; i++){
        if(this.events[i]._id===event._id) {
            this.events.splice(i,1);
        }
    }

    let embed = {};
    embed.color = parseInt(config.colors.green,16);
    embed.description = `ℹ Event #⃣${event._no} is queued for removal.`;
    embed.author = {name: `EVENT DELETION PROCESS`};

    if(silent) {
        return {embed: embed};
    } else {
        embed.footer = {text: `## Options: [B]ack, [Q]uit`};
        return {embed: embed};
    }
};

/// add a user to an event and generate a prompt
Viewer.prototype.joinEvent = function(event, msg) {
    // check if msgAuthor is already an Attendee
    let alreadyMember = false;
    for (let i = 0; i < event.attendees.length; i++) {
        if (event.attendees[i]._id === msg.author.id) {
            alreadyMember = true;
            break;
        }
    }

    let embed = {};

    if (alreadyMember) {
        embed.color = parseInt(config.colors.yellow,16);
        embed.title = `⚠ ${msg.author.username} __already__ joined the Event #⃣${event._no}.`;
        embed.description =  "" +
            `**Title:** \`${event.title}\`\n` +
            `**Author:** \`${this.bot.getUserOrNickname(event._author, this.msg.channel.guild)}\`\n` +
            `**Attendees:** \`[${event.attendees.length}/${event.attendee_max}]\``;

        return {embed: embed};

    //if user is not already an attendee of the event
    } else {
        // Event attendee_max limit is not reached yet
        if (event.attendees.length < event.attendee_max) {

            event.attendees.push({_id: msg.author.id, timestamp: Date.now()});
            event.save(err => {
                if(err) {
                    console.log(err.stack);
                }
            });
            embed.color = parseInt(config.colors.green);
            embed.title = `ℹ ${msg.author.username} just joined Event #⃣${event._no}.`;
            embed.description =  "" +
                `**Title:** \`${event.title}\`\n` +
                `**Author:** \`${this.bot.getUserOrNickname(event._author, this.msg.channel.guild)}\`\n` +
                `**Attendees:** \`[${event.attendees.length}/${event.attendee_max}]\``;

            return {embed: embed};
        }
        // Event attendee_max limit is already reached
        else {
            embed.color = parseInt(config.colors.yellow);
            embed.title = `⚠ ${msg.author.username} cannot join Event #⃣${event._no} because there is no open slot left.`;
            embed.description =  "" +
                `**Title:** \`${event.title}\`\n` +
                `**Author:** \`${this.bot.getUserOrNickname(event._author, this.msg.channel.guild)}\`\n` +
                `**Attendees:** \`[${event.attendees.length}/${event.attendee_max}]\``;

            return {embed: embed};
        }
    }
};

/// remove a user from an event and generate a prompt
Viewer.prototype.leaveEvent = function(event, msg) {
    // check if msgAuthor is an Attendee and delete that entry
    let wasMember = false;
    for (let i = 0; i < event.attendees.length; i++) {
        if (event.attendees[i]._id === msg.author.id) {
            wasMember = true;
            event.attendees.splice(i,1);
            
            event.save(err => {
                if(err) {
                    console.log(err.stack);
                }
            });
            break;
        }
    }

    let embed = {};

    // msgAuthor was an attendee of the event
    if (wasMember) {
        embed.color = parseInt(config.colors.green,16);
        embed.title = `ℹ ${msg.author.username} left the Event #⃣${event._no}.`;
        embed.description =  "" +
            `**Title:** \`\`${event.title}\`\`\n` +
            `**Author:** \`${this.bot.getUserOrNickname(event._author, this.msg.channel.guild)}\`\n` +
            `**Attendees:** \`[${event.attendees.length}/${event.attendee_max}]\``;

        return {embed: embed};

    // msgAuthor was not an attendee of the event
    } else {
        embed.color = parseInt(config.colors.yellow,16);
        embed.title = `⚠ ${msg.author.username} is not an attendee of the Event #⃣${event._no}.`;
        embed.description = "" +
            `**Title:** \`${event.title}\`\n` +
            `**Author:** \`${this.bot.getUserOrNickname(event._author, this.msg.channel.guild)}\`\n` +
            `**Attendees:** \`[${event.attendees.length}/${event.attendee_max}]\``;

        return {embed: embed};
    }
};

Viewer.prototype.getErrorView = function(error, bad_input, silent) {
    this.previous_mode = this.mode;
    this.mode = 5;

    let embed = {};
    embed.title = `⚠ There was an error! `;
    embed.color = parseInt(config.colors.yellow,16);

    switch (error) {
        case 1:
            embed.description = `Your input ${bad_input} is not a number from the list!`;
            break;
        case 2:
            embed.description = `Event #${bad_input} does not exists!`;
            break;
        case 3:
            embed.description = `\"${bad_input}\" is not a valid start time!`;
            break;
        case 4:
            embed.description = `\"${bad_input}\" is not a valid end time!`;
            break;
        case 5:
            embed.description = `\"${bad_input}\" is not valid amount!`;
            break;
        default:
            embed.description = `Unknown error!`;
            break;
    }

    if (silent) {
        return {embed: embed};
    } else {
        embed.description += `\n\nYou can return to the edit menu, or quit`;
        embed.title = {text: `## Options: [B]ack, [Q]uit`};
        return {embed: embed};
    }

};

Viewer.prototype.getEventAttendeesView = function(event) {
    this.previous_mode = this.mode;
    this.mode = 6;

    let embed = {};
    embed.title = `ℹ List of attendees for Event #⃣ ${event._no}`;
    embed.description = "";
    embed.color = parseInt(config.colors.blue, 16);
    embed.footer = {text: `## Options: [B]ack, [Q]uit`};

    if (typeof event.attendees !== "undefined" && event.attendees.length > 0) {
        for (let i = 0; i < this.event.attendees.length; i++) {
            embed.description += `\`${this.bot.getUserOrNickname(this.event.attendees[i]._id, this.msg.channel.guild)}\`, `;
            //embed.description += `<@`+this.event.attendees[i]._id+`>, `;
        }
    }

    return {embed: embed};
};

module.exports = Viewer;