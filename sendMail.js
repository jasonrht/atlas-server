"use strict";
require('dotenv').config()
const { v4: uuidv4 } = require('uuid')
const nodemailer = require("nodemailer");

// async..await is not allowed in global scope, must use a wrapper
async function sendMail(emailData) {
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: "smtp-mail.outlook.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL, // generated ethereal user
            pass: process.env.EMAIL_PW, // generated ethereal password
        },
    });

    // `<p>Beste [Kelly / Trust Marketing],<br/><br/>Graag zou ik namens Atlas Sales Agency [vestiging] aan de [adres] te [plaatsnaam] een gepersonaliseerde werverspas van [project(en)] (dikgedrute weglaten als het om SVHK gaat) willen bestellen voor [werver]. De geboortedatum van [voornaam werver] is [geboortedatum].<br/><br/>Een foto van [voornaam werver] is toegevoegd als bijlage.<br/><br/>Bij voorbaat dank.<br/><br/>Met vriendelijke groet,<br/>Nino Retel Helmrich<br/>Atlas Sales Agency</p>`


    const emailBody = `<p>Beste ${emailData.receiver},<br/><br/>Graag zou ik namens Atlas Sales Agency ${emailData.atlasLocation} aan de ${emailData.address} te ${emailData.city} een gepersonaliseerde werverspas ${emailData.projects === 'svhk' ? 'van Stichting van het Kind' : `<b>van ${emailData.projects}</b>`} willen bestellen voor ${emailData.firstName + ' ' + emailData.lastName}. De geboortedatum van ${emailData.firstName} is ${emailData.birthday}.<br/><br/>Een foto van ${emailData.firstName} is toegevoegd als bijlage.<br/><br/>Bij voorbaat dank.<br/><br/>Met vriendelijke groet,<br/>Nino Retel Helmrich<br/>Atlas Sales Agency</p>`

    const subjects = {}

    const receiverAdressess = {
        'Kelly': 'kelly@stichtingvanhetkind.nl',
        'Trust Marketing': 'bestellingen@trustmarketing.nl'
    }


    let info = await transporter.sendMail({
        from: '"jasonraefon@hotmail.com', // sender address
        to: "jasonraefon@hotmail.com", // list of receivers
        subject: "Hello ✔", // Subject line
        // text: "Hello world?", // plain text body
        html: emailBody, // html body
        attachments: emailData.photo ? [
            {
                filename: `${emailData.photo.originalname}`,
                path: `./uploads/images/${emailData.photo.originalname}`,
                cid: uuidv4(),
            }
        ] : ''
    });

    console.log("Message sent: %s", info.messageId);
    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

    // Preview only available when sending through an Ethereal account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
}

exports.sendMail = (data) => sendMail(data)