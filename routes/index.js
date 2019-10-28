var express = require('express');
var router = express.Router();


var logins = require("../controllers/loginsCtrl");

const razorPayWebHook = require("../webhooks/razorpay");

router.post("/register", logins.create);
router.post("/verify/email", logins.verifyEmail);
router.post("/login", logins.login);
router.post("/login/firebase", logins.loginWithFirebase);
router.post('/login/verifypan', logins.verifyPANCard); 
router.post('/login/verifybank', logins.bankVerification);
router.patch('/adminverification/pan', logins.markPanAsVerified);
router.patch('/adminverification/bank', logins.markBankAsVerified);
router.patch('/adminrejection/pan', logins.rejectPanVerification);
router.patch('/adminrejection/bank', logins.rejectBankVerification);

router.post("/rewardreferrer", logins.rewardReferrer);

router.get("/get/user/login/profile", logins.getProfileDataFromToken);

router.delete("/user", logins.delete);
router.post("/change/password", logins.changePassword);
router.post("/reset/password", logins.resetPassword);
router.post("/confirm/reset/password", logins.confirmResetPassword);
router.post("/profile", logins.updateProfile);
router.get("/users", logins.getAllProfiles);
router.get("/verificationRequests", logins.verificationRequests);
router.get('/user/matchHistory', logins.matchHistory);
router.patch('/user/resetTax', logins.resetTaxDue);

router.get("/otp/generate", logins.generateOTP);
router.get("/otp/verify", logins.verifyOTP);

router.get('/statistics/perdayusersignup', logins.getStatisticsOfUsersJoining);
router.get('/doesreferralexist', logins.doesReferralExist);

router.post("/razorpay", razorPayWebHook.webhook);

module.exports.router = router;
