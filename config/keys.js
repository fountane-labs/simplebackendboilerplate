const keys = {
    razorpay: {
        webhook_secret: process.env.RAZORPAY_SECRET || "",
        key_id: process.env.KEY_ID || "",
        key_secret: process.env.KEY_SECRET || ""
    },
    "2factor":{
        api_key: ""
    }
}

module.exports = keys;
