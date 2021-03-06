const domain = require("domain");
const getRSS = require("feed-read");

// Fetch n entries from an RSS feed
module.exports = (winston, url, num, callback) => {
	if(typeof(callback)=="function") {
		const handleError = err => {
			winston.error("Failed to process RSS feed request", err);
			callback(err);
		};
		try {
			/* RSS DISABLED
			const rssDomain = domain.create();
			rssDomain.run(() => {
				getRSS(url, (err, articles) => {
					if(err) {
						handleError(err);
					} else {
						callback(err, articles.slice(0, num));
					}
				});
			});
			rssDomain.on("error", handleError);
			*/
		} catch(err) {
			handleError(err);
		}
	}
};
