/*jshint -W083*/
const list = require("./../../Modules/Events/InteractiveLoop.js");
const EventViewer = require("./../../Modules/Events/EventsViewer");
const IDHelper = require('../../Modules/Events/IDHelper');
const QueryHelper = require('../../Modules/Events/EventsQueryHelper');
const auth = require('../../Modules/Events/EventsAuth');
const moment = require('moment');

module.exports = (bot, db, config, winston, userDocument, serverDocument, channelDocument, memberDocument, msg, suffix) => {

    let viewer;
    const page_size = 5;

    if (suffix) {
        if (suffix.toLowerCase() == "add") {
            // chained promise statements to generate a new event id number for the server
            IDHelper.newServerEventNumber(db, serverDocument._id).then((no) => {
                db.events.create({
                    _id: IDHelper.computeID(no, msg.author.id, serverDocument._id, null),
                    _no: no,
                    _author: msg.author.id,
                    _server: serverDocument._id,
                    _clan: null,
                    start: moment(Date.now()).add(1, "hour"),
                    end: moment(Date.now()).add(2, "hour")
                }, (err) => {
                    if (err) {
                        winston.info(err.stack);
                    } else {
                        QueryHelper.findServerEvents(db, serverDocument._id).then((eventDocuments) => {
                            let viewer = new EventViewer(bot, msg, db,  winston, serverDocument, eventDocuments, userDocument, msg.member, page_size);
                            if (viewer.setEvent(no)) {
                                list(bot, db, winston, serverDocument, msg, viewer, viewer.getEventEditView(true));
                            } else {
                                list(bot, db, winston, serverDocument, msg, viewer, viewer.getErrorView());
                            }
                        });
                    }
                });
            });
        } else if (suffix.toLowerCase().startsWith("show")) {
            QueryHelper.findServerEvents(db, serverDocument._id).then((eventDocuments) => {
                let tmp = suffix.toLowerCase().split("show")[1].trim();
                viewer = new EventViewer(bot, msg, db,  winston, serverDocument, eventDocuments, userDocument, msg.member, page_size);

                if (viewer.setEvent(tmp)) {
                    list(bot, db, winston, serverDocument, msg, viewer, viewer.getEventView());
                } else {
                    list(bot, db, winston, serverDocument, msg, viewer, viewer.getErrorView(2, tmp));
                }
            });
        } else if (suffix.toLowerCase().startsWith("edit")) {
            let tmp = suffix.toLowerCase().split("edit")[1].trim();
            QueryHelper.findServerEvents(db, serverDocument._id).then((eventDocuments) => {
                viewer = new EventViewer(bot, msg, db,  winston, serverDocument, eventDocuments, userDocument, msg.member, page_size);

                if (viewer.setEvent(tmp)) {
                    if (auth.toDeleteOrEdit(viewer.server, viewer.event, viewer.member)) {
                        list(bot, db, winston, serverDocument, msg, viewer, viewer.getEventEditView());
                    } // else exit silently
                } else {
                    list(bot, db, winston, serverDocument, msg, viewer, viewer.getErrorView(2, tmp));
                }
            });
        } else if (suffix.toLowerCase().startsWith("search")) {
            // create a filter from the args passed in
            let filter = {};
            let args = suffix.toLowerCase().split("search")[1].trim().split("|");
            for (let i = 0; i < args.length; i++) {
                let arg = args[i].trim();

                let attribute = arg.split(":")[0].trim();
                let instance = arg.split(":")[1].trim();
                switch (attribute) {
                    case "a":
                        if (instance) {
                            filter._author = instance.replace("<@", "").replace(">", "");
                        }
                        break;
                    case "t":
                        if (instance) {
                            let tags = [];
                            let tmp = instance.split(" ");
                            for (let i = 0; i < tmp.length; i++) {
                                tags.push(tmp[i]);
                            }
                            filter.tags = tags;
                        }
                        break;
                }
            }
            // setup the menu
            QueryHelper.findFilteredServerEvents(db, serverDocument._id, filter).then((eventDocuments) => {
                viewer = new EventViewer(bot, msg, db,  winston, serverDocument, eventDocuments, userDocument, msg.member, page_size);
                list(bot, db, winston, serverDocument, msg, viewer, viewer.getPageView(1, winston));
            });
        }
        // suffixes which do not trigger the interactive loop
        else if (suffix.toLowerCase().startsWith("remove")) {
            QueryHelper.findServerEvents(db, serverDocument._id).then((eventDocuments) => {
                let tmp = suffix.toLowerCase().split("remove")[1].trim();
                viewer = new EventViewer(bot, msg, db,  winston, serverDocument, eventDocuments, userDocument, msg.member, page_size);

                if (viewer.setEvent(tmp)) {
                    if (auth.toDeleteOrEdit(viewer.server, viewer.event, viewer.member)) {
                        msg.channel.createMessage(viewer.deleteEvent(viewer.event, true));
                    } // else exit silently
                } else {
                    msg.channel.createMessage(viewer.getErrorView(2, tmp, true));
                }
            });
        } else if (suffix.toLowerCase().startsWith("join")) {
            let tmp = suffix.toLowerCase().split("join")[1].trim();
            QueryHelper.findServerEvents(db, serverDocument._id).then((eventDocuments) => {
                viewer = new EventViewer(bot, msg, db,  winston, serverDocument, eventDocuments, userDocument, msg.member, page_size);

                if (viewer.setEvent(tmp)) {
                    msg.channel.createMessage(viewer.joinEvent(viewer.event, msg));
                } else {
                    msg.channel.createMessage(viewer.getErrorView(2, tmp, true));
                }
            });
        } else if (suffix.toLowerCase().startsWith("leave")) {
            let tmp = suffix.toLowerCase().split("leave")[1].trim();
            QueryHelper.findServerEvents(db, serverDocument._id).then((eventDocuments) => {
                viewer = new EventViewer(bot, msg, db,  winston, serverDocument, eventDocuments, userDocument, msg.member, page_size);

                if (viewer.setEvent(tmp)) {
                    msg.channel.createMessage(viewer.leaveEvent(viewer.event, msg));
                } else {
                    msg.channel.createMessage(viewer.getErrorView(2, tmp, true));
                }
            });
        }
    } else {
        QueryHelper.findServerEvents(db, serverDocument._id).then((eventDocuments) => {
            let viewer = new EventViewer(bot, msg, db, winston, serverDocument, eventDocuments, userDocument, msg.member, page_size);
            list(bot, db, winston, serverDocument, msg, viewer, viewer.getPageView(1, winston));
        });
    }
};