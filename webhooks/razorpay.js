var db = require("../models/db");
var utilities = require("../utilities/utilities");
const env = require('../models/env');
const Razorpay = require("razorpay");
const razorpay_keys = require("../config/keys").razorpay;
const CONSTANTS = require("../models/constants");

const razorpay = new Razorpay({
    key_id: razorpay_keys.key_id,
    key_secret: razorpay_keys.key_secret
});

const sendEmailPromisified = (to, subject, message) => {
    return new Promise((resolve, reject) => {
        utilities.sendEmail(to, subject, message, (err, data)=>{
            if(err){
                reject(err);
            }else{
                resolve(data);
            }
        })
    });
}

module.exports.webhook = async (req, res) => {
    try{
        let signature = req.get("x-razorpay-signature");
        console.log("signature: ", signature);
        let result = Razorpay.validateWebhookSignature(JSON.stringify(req.body), signature, razorpay_keys.webhook_secret);
        console.log("result from razorpay webhook validation: ", result);
        console.log("req.body: ", JSON.stringify(req.body));
        if(result){
            let payload = req.body.payload.payment.entity;
            let amount = payload.amount;
            amount = amount/100;
            // amount = amount.toString();
            let order_id = payload.description.split(':')[1];
            if(payload){
                if(req.body.event == "payment.authorized"){
                    let transaction = await db.transactions.findOne({
                        where: {
                            id: order_id,
                            amount:  amount
                        }
                    });
                    if(transaction && transaction.amount){
                        let dbTrans;
                        try{
                            dbTrans = await db.sequelize.transaction();
                            let amount = Number(transaction.amount);
                            if( amount == transaction.amount){
                                let updateObj = {
                                    checksum: payload.id,
                                    status: CONSTANTS.transactions.status.PROCESSING
                                }
                                let result = await db.transactions.update(updateObj,{
                                    where: {
                                        id: order_id,
                                        amount: amount
                                    },
                                    transaction: dbTrans
                                });
                                console.log("result obtained: ",JSON.stringify({result}));
                                if(!(result && result[0])){
                                    console.error("the transaction couldnt be updated");
                                    throw new Error("the transaction couldnt be updated");
                                }
                                let razorResponse = await razorpay.payments.capture(payload.id, amount*100);
                                console.log("response from razorpay.payment.capture: ", razorResponse);
                                await dbTrans.commit();
                            }else{
                                console.log("payment amounts differ from that in request");
                                console.log("payload: ", JSON.stringify(payload.a));
                                console.log("transaction: ", JSON.stringify(transaction));
                                throw new Error("payment amount differ from that in request");
                            }
                        }catch(error){
                            console.error("error occured: ", error);
                            await dbTrans.rollback();
                            await db.transactions.update({
                                status: CONSTANTS.transactions.status.FAILED
                            }, {
                                where:{
                                    id: transaction.id
                                }
                            });
                            try{
                                let message = `Failed to change status of the transaction ${order_id} to PROCESSING, ERROR MESSAGE: ${error.message}`;
                                await sendEmailPromisified({ email: "appmail@appdomain.com", name: "The App" }, "Authorised Transaction Failed", message);
                            }catch(err){
                                console.error("error occured in sending email: ", err)
                            }
                        }
                    }else{
                        console.log("transaction not found: ", JSON.stringify(transaction));
                        console.log("payload: ", JSON.stringify(payload));
                    }
                }else if(req.body.event == "payment.captured"){
                    let dbTrans;
                    try{
                        dbTrans = await db.sequelize.transaction();
                        let query = `UPDATE logins 
                            SET un_withdrawable_wallet_balance=CAST((CAST(COALESCE(un_withdrawable_wallet_balance, '0') AS DECIMAL)+transactions.amount) AS DECIMAL),
                                bonus_wallet_balance=CAST((CAST(COALESCE(bonus_wallet_balance, '0') AS DECIMAL)+transactions.bonus) AS DECIMAL)
                            FROM transactions
                            WHERE logins.id=transactions.login_id AND transactions.id=:transaction_id AND transactions.status='${CONSTANTS.transactions.status.PROCESSING}'`;
                        let result = await db.sequelize.query(query, {
                            replacements: {
                                transaction_id: order_id
                            },
                            type: db.sequelize.QueryTypes.UPDATE,
                            transaction: dbTrans
                        });
                        console.log("result obtained: ", JSON.stringify(result));
                        let result2 = await db.transactions.update({
                            status: CONSTANTS.transactions.status.PAID,
                            amount_at_transaction_time: db.sequelize.literal(`CAST((CAST(COALESCE(amount_at_transaction_time, '0') AS DECIMAL)+ ${amount}) AS TEXT)`)
                        },{
                            where: {
                                id: order_id,
                                status: CONSTANTS.transactions.status.PROCESSING,
                                amount
                            },
                            returning: true,
                            transaction: dbTrans
                        });
                        console.log("result obtained: ", JSON.stringify(result2));
                        let bonusTransaction = result2[1][0];
                        if(Number(bonusTransaction.bonus)>0){
                            let bonusTransactionResult = await db.transactions.create({
                                login_id: bonusTransaction.login_id,
                                league_id: bonusTransaction.league_id,
                                amount: bonusTransaction.bonus,
                                type: CONSTANTS.transactions.type.REWARD_TO_WALLET,
                                status: CONSTANTS.transactions.status.PAID,
                                transaction_time: new Date(),
                                tax: bonusTransaction.tax,
                                amount_at_transaction_time: Number(bonusTransaction.amount_at_transaction_time) + Number(bonusTransaction.bonus)
                            }, {
                                transaction: dbTrans
                            });
                            console.log("bonusTransactionResult: ", JSON.stringify({bonusTransactionResult}));
                        }
                        await dbTrans.commit();
                    }catch(error){
                        console.error("error occured: ", error);
                        await dbTrans.rollback();
                        await db.transactions.update({
                            status: CONSTANTS.transactions.status.FAILED
                        }, {
                            where:{
                                id: order_id
                            }
                        });
                        try{
                            let message = `Failed to change status of the transaction ${order_id} to PAID, ERROR MESSAGE: ${error.message}`;
                            await sendEmailPromisified({ email: "appmail@appdomain.com", name: "The App" }, "Captured Transaction Failed", message);
                        }catch(err){
                            console.error("error occured in sending email: ", err)
                        }
                    }
                }else if(req.body.event == "payment.failed"){
                    db.transactions.update({
                        status: CONSTANTS.transactions.status.FAILED
                    }, {
                        where: {
                            id: order_id
                        }
                    }).then(result=>{
                        console.log("result obtained from updating the transactions to failed: ", JSON.stringify({result}));
                    }).catch(error=>{
                        console.error("Error occured in updating failed transaction status to failed: ", error);
                        console.log("payload: ", JSON.stringify(payload));
                    });
                }else{
                    console.log("unhandled event: ", req.body.event);
                    console.log("body: ", JSON.stringify(req.body));
                }
                res.status(200).json({status:true});
                return;
            }else{
                res.status(500).json({status: false});
                console.error("payload missing: ", JSON.stringify(req.body));
                return;
            }
        }else{
            console.log("webhook request validation failed");
            res.status(200).json({status: false, message: 'validation failed'});
            return;
        }
    }catch(error){
        console.log("error occured: ", error);
        res.status(500).json({status:false, error: error.message});
        return;
    }
}